import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';

import MultipleChoice from './MultipleChoice';
import ErrorIdentify from './ErrorIdentify';
import Default from '../Default';

// These two question types are nearly one: same "pick 1 of N options", same
// answer UI, same parsing of "A. ... B. ..." pasted from Word. They differ in
// exactly THREE things, all of which the teacher sees right away:
//   - ErrorIdentify has a "turn selection into answer" button (MC does not)
//   - ErrorIdentify inserts a check box, MC inserts a "______" underline
//   - different CSS class -> only ErrorIdentify gets the A/B/C numbers from the CSS counter
// This test pins all three, so merging the two files cannot silently lose one.

const exam = Default.exam();
const section = Default.section(exam.id);

function renderQuestion(Comp: any, data: Record<string, unknown> = {}) {
    const q = Default.question('MultipleChoice', exam.id, section.id);
    Object.assign(q.data, data);
    section.questions = [q];
    const touch = vi.fn();
    render(<Comp question={q} section={section} setSectionState={touch}/>);
    return {q, touch};
}

beforeEach(() => vi.restoreAllMocks());

describe('MultipleChoice vs ErrorIdentify: three differences that must be kept', () => {
    it('only ErrorIdentify has the turn-selection-into-answer button', () => {
        renderQuestion(MultipleChoice);
        expect(screen.queryByTitle('Chuyển vùng chọn thành đáp án')).toBeNull();
    });

    it('ErrorIdentify MUST have that button — without it teachers cannot create check boxes', () => {
        renderQuestion(ErrorIdentify);
        expect(screen.getByTitle('Chuyển vùng chọn thành đáp án')).toBeTruthy();
    });

    it('different CSS classes: only .ErrorIdentify runs the CSS counter numbering check boxes', () => {
        const {container: a} = render(
            <MultipleChoice question={Default.question('MultipleChoice', exam.id, section.id)}
                            section={section} setSectionState={vi.fn()}/>);
        expect(a.querySelector('form.multiple-choice')).toBeTruthy();
        expect(a.querySelector('form.ErrorIdentify')).toBeNull();

        const {container: b} = render(
            <ErrorIdentify question={Default.question('ErrorIdentify', exam.id, section.id)}
                           section={section} setSectionState={vi.fn()}/>);
        expect(b.querySelector('form.ErrorIdentify')).toBeTruthy();
        expect(b.querySelector('form.multiple-choice')).toBeNull();
    });
});

describe('Shared part: options render identically', () => {
    it.each([['MultipleChoice', MultipleChoice], ['ErrorIdentify', ErrorIdentify]])(
        '%s shows all existing options and marks the correct answer',
        (_name, Comp: any) => {
            const {container} = render(
                <Comp question={(() => {
                    const q = Default.question('MultipleChoice', exam.id, section.id);
                    q.data.answers = [{id: 'A1', value: 'Hà Nội'}, {id: 'A2', value: 'Huế'}];
                    q.data.correctAnswerId = 'A2';
                    section.questions = [q];
                    return q;
                })()} section={section} setSectionState={vi.fn()}/>);

            const radio = container.querySelectorAll('input[type=radio]');
            expect(radio.length).toBe(2);
            // The correct answer is the SECOND one. Without asserting the first is NOT
            // checked, the test would stay green even if every radio were checked.
            expect((radio[0] as HTMLInputElement).checked).toBe(false);
            expect((radio[1] as HTMLInputElement).checked).toBe(true);
        });

    it.each([['MultipleChoice', MultipleChoice], ['ErrorIdentify', ErrorIdentify]])(
        '%s notifies the store to re-render when an option is removed',
        (_name, Comp: any) => {
            const q = Default.question('MultipleChoice', exam.id, section.id);
            q.data.answers = [{id: 'A1', value: 'Hà Nội'}, {id: 'A2', value: 'Huế'}];
            section.questions = [q];
            const touch = vi.fn();
            const {container} = render(
                <Comp question={q} section={section} setSectionState={touch}/>);

            fireEvent.click(container.querySelector('button[aria-label^="Xoá đáp án"]')!);

            expect(q.data.answers.map((a: any) => a.id)).toEqual(['A2']);
            // Mutating data without calling setSectionState freezes the screen:
            // the teacher clicks delete, sees the option still there, clicks again.
            expect(touch).toHaveBeenCalled();
        });
});

describe('7px offset of the remove icon — a fourth difference, easy to lose when merging', () => {
    const renderWithOption = (Comp: any) => {
        const q = Default.question('MultipleChoice', exam.id, section.id);
        q.data.answers = [{id: 'A1', value: 'x'}];
        section.questions = [q];
        return render(<Comp question={q} section={section} setSectionState={vi.fn()}/>).container;
    };

    it('MultipleChoice pushes the icon down 7px to line up with the answer box', () => {
        const i = renderWithOption(MultipleChoice).querySelector('button[aria-label^="Xoá đáp án"]') as HTMLElement;
        expect(i.style.marginTop).toBe('7px');
    });

    it('ErrorIdentify does NOT push — its row is taller, pushing more would misalign', () => {
        const i = renderWithOption(ErrorIdentify).querySelector('button[aria-label^="Xoá đáp án"]') as HTMLElement;
        expect(i.style.marginTop).toBe('');
    });
});

describe('editorType: insert check box or underline (the easiest difference to lose)', () => {
    // The three tests above catch the class, the button and the 7px offset — but
    // dropping `editorType` would leave the whole net green, even though it is
    // what decides whether ErrorIdentify inserts a CHECK BOX or a "______" like
    // multiple choice. A teacher writing an error-identification question who
    // gets an underline has the wrong question type entirely.
    //
    // Selecting text must go through Tiptap: toAnswer reads `editor.state.selection`,
    // not window.getSelection. Ctrl+A in the editor area is the path a real user
    // takes, and ProseMirror handles that key itself.
    const editThenTurnIntoAnswer = (container: HTMLElement) => {
        const area = container.querySelector('.ProseMirror') as HTMLElement;
        fireEvent.focus(area);
        fireEvent.keyDown(area, {key: 'a', code: 'KeyA', ctrlKey: true});
        fireEvent.click(screen.getByTitle('Chuyển vùng chọn thành đáp án'));
        return area;
    };

    it('ErrorIdentify inserts <span class=check-item>, not an underline', () => {
        const q = Default.question('ErrorIdentify', exam.id, section.id);
        q.data.question = '<p>Câu có lỗi sai ở đây</p>';
        section.questions = [q];
        const {container} = render(
            <ErrorIdentify question={q} section={section} setSectionState={vi.fn()}/>);

        const area = editThenTurnIntoAnswer(container);

        expect(area.querySelector('span.check-item')).toBeTruthy();
        expect(area.textContent).not.toMatch(/_____/);
    });
});
