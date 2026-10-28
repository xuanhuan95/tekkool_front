import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';

import Section from './Section';
import Default from './Default';
import {useExamDraftStore} from '../../stores/examDraftStore';

vi.mock('../../components/Editor', () => ({
    Editor: ({text, onChange, placeholder}: {text?: string; onChange: (v: string) => void; placeholder?: string}) =>
        <textarea aria-label={placeholder} value={text || ''} onChange={e => onChange(e.target.value)}/>,
}));

const store = () => useExamDraftStore.getState();

function Host() {
    useExamDraftStore(s => s.version);
    return <Section section={store().exam!.sections[0]}/>;
}

function start(type: string, data: Record<string, unknown>) {
    const exam = Default.exam();
    const section = Default.section(exam.id);
    section.questions = [{...Default.question(type, exam.id, section.id), data}];
    section.question_type = type;
    exam.sections = [section];
    store().setExam(exam);
    return render(<Host/>);
}

beforeEach(() => store().setExam(Default.exam()));

describe('editor: ShortAnswer and unknown question types', () => {
    it('a ShortAnswer question (seed demo exam) renders its question and answer', () => {
        start('ShortAnswer', {question: 'Tính 3+4', correctAnswer: '7', max_score: 0.25});
        expect((screen.getByLabelText('Nhập câu hỏi trả lời ngắn...') as HTMLTextAreaElement).value).toBe('Tính 3+4');
        expect((screen.getByLabelText(/Nhập đáp án/) as HTMLTextAreaElement).value).toBe('7');
    });

    it('editing the answer writes correctAnswer, the field the grader reads first', () => {
        start('ShortAnswer', {question: 'Q', correctAnswer: '7'});
        fireEvent.change(screen.getByLabelText(/Nhập đáp án/), {target: {value: '8|tám'}});
        expect(store().exam!.sections[0].questions[0].data.correctAnswer).toBe('8|tám');
    });

    it('an unknown type shows a notice instead of crashing the page', () => {
        start('Mystery', {question: 'Q'});
        expect(screen.getByRole('alert').textContent).toContain('Mystery');
    });
});
