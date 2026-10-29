import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';

import Section from './Section';
import Default from './Default';
import {useExamDraftStore} from '../../stores/examDraftStore';
import {backendProblems, examProblems} from './examRules';

// Plain textarea instead of TipTap: these tests are about the block structure, not rich text.
vi.mock('../../components/Editor', () => ({
    Editor: ({text, onChange, placeholder}: {text?: string; onChange: (v: string) => void; placeholder?: string}) =>
        <textarea aria-label={placeholder} value={text || ''} onChange={e => onChange(e.target.value)}/>,
}));

const store = () => useExamDraftStore.getState();
const questions = () => store().exam!.sections[0].questions;

function Host() {
    useExamDraftStore(s => s.version);
    return <Section section={store().exam!.sections[0]}/>;
}

function start(initial = (_s: ReturnType<typeof Default.section>) => {}) {
    const exam = Default.exam();
    const section = Default.section(exam.id);
    initial(section);
    exam.sections = [section];
    store().setExam(exam);
    return render(<Host/>);
}

const addTrueFalse = (c: HTMLElement) =>
    fireEvent.click(c.querySelector('i.checkmark.icon')!.closest('.item')!);

beforeEach(() => store().setExam(Default.exam()));

describe('editor: a Đúng/Sai question is a block of 4 ý', () => {
    it('"add Đúng/Sai" stores 4 consecutive TrueFalse sharing one passageId', () => {
        const {container} = start();
        addTrueFalse(container);
        const qs = questions();
        expect(qs.map(q => q.type)).toEqual(['TrueFalse', 'TrueFalse', 'TrueFalse', 'TrueFalse']);
        expect(new Set(qs.map(q => q.data.passageId)).size).toBe(1);
        expect(qs[0].data.passageId).toBeTruthy();
        expect(container.querySelectorAll('.tf-statement')).toHaveLength(4);
        expect(store().exam!.sections[0].question_type).toBe('TrueFalse');
    });

    it('saving is blocked until every ý has Đúng/Sai, and names the ý', () => {
        const {container} = start();
        addTrueFalse(container);
        expect(examProblems(store().exam!.sections)).toHaveLength(4);
        // radio inputs come in pairs per ý: [Đúng, Sai]
        const radios = () => container.querySelectorAll('input[type=radio]');
        [0, 2, 6].forEach(i => fireEvent.click(radios()[i]));
        expect(examProblems(store().exam!.sections)).toEqual(['Câu 1: ý c) chưa đặt Đúng/Sai']);
        fireEvent.click(radios()[5]);
        expect(examProblems(store().exam!.sections)).toEqual([]);
        expect(questions().map(q => q.data.correctAnswer)).toEqual([true, true, false, true]);
    });

    it('the shared lead-in is written into all 4 ý', () => {
        const {container} = start();
        addTrueFalse(container);
        fireEvent.change(screen.getByLabelText('Nhập đề dẫn chung của câu Đúng/Sai...'), {target: {value: 'Cho hàm số'}});
        expect(questions().map(q => q.data.passage)).toEqual(Array(4).fill('Cho hàm số'));
    });

    it('✕ removes the whole block, not one ý', () => {
        const {container} = start();
        addTrueFalse(container);
        fireEvent.click(screen.getByRole('button', {name: 'Xoá câu này'}));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Xoá câu'}));
        expect(questions()).toHaveLength(0);
    });

    it('an old 1-ý question still renders and is reported', () => {
        const {container} = start(s => { s.questions = [Default.question('TrueFalse', s.exam, s.id)]; });
        expect(container.querySelectorAll('.tf-statement')).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toContain('có 1 ý');
        expect(examProblems(store().exam!.sections)[0]).toBe('Câu 1: câu Đúng/Sai có 1 ý (cần đúng 4 ý)');
    });
});

describe('examProblems / backendProblems', () => {
    it('numbers a Đúng/Sai block once and flags a choice question without a key', () => {
        const exam = Default.exam();
        const s = Default.section(exam.id);
        const mc = Default.question('MultipleChoice', exam.id, s.id);
        mc.data = {answers: [{id: 'a'}], correctAnswerId: ''};
        const tf = Default.trueFalseGroup(exam.id, s.id);
        tf.forEach(q => { q.data.correctAnswer = true; });
        const bad = Default.question('MultipleChoice', exam.id, s.id);
        bad.data = {answers: [{id: 'a'}], correctAnswerId: 'zzz'};
        s.questions = [mc, ...tf, bad];
        expect(examProblems([s])).toEqual([
            'Câu 1: chưa chọn đáp án đúng',
            'Câu 3: đáp án đúng trỏ tới phương án không tồn tại',
        ]);
    });

    it('reads the messages of a 400 invalid_questions error', () => {
        expect(backendProblems({code: 400, invalid_questions: [{message: 'Câu 4: ý b) chưa đặt Đúng/Sai'}]}))
            .toEqual(['Câu 4: ý b) chưa đặt Đúng/Sai']);
        expect(backendProblems({code: 500})).toBeNull();
    });
});
