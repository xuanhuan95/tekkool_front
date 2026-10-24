import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';

import Section from './Section';
import Default from './Default';
import {useExamDraftStore} from '../../stores/examDraftStore';
import {defaultScore, examTotal, publishProblems, reviewHints, unitScore, withDefaultScores} from './examRules';

vi.mock('../../components/Editor', () => ({
    Editor: ({text, onChange, placeholder}: {text?: string; onChange: (v: string) => void; placeholder?: string}) =>
        <textarea aria-label={placeholder} value={text || ''} onChange={e => onChange(e.target.value)}/>,
}));

const store = () => useExamDraftStore.getState();
const questions = () => store().exam!.sections[0].questions;

function Host({subject}: {subject?: string}) {
    useExamDraftStore(s => s.version);
    return <Section section={store().exam!.sections[0]} subject={subject}/>;
}

function start(fill: (s: ReturnType<typeof Default.section>) => void = () => {}, subject?: string) {
    const exam = Default.exam();
    const section = Default.section(exam.id);
    fill(section);
    exam.sections = [section];
    store().setExam(exam);
    return render(<Host subject={subject}/>);
}

beforeEach(() => store().setExam(Default.exam()));

describe('default scores', () => {
    it('SPT defaults per type, Ngữ văn trắc nghiệm 0,3, tự luận none', () => {
        expect(defaultScore('MultipleChoice', 'Toán')).toBe(0.25);
        expect(defaultScore('MultipleChoice', 'Ngữ văn')).toBe(0.3);
        expect(defaultScore('TrueFalse')).toBe(1);
        expect(defaultScore('FillBlank', 'Ngữ văn')).toBe(0.25);
        expect(defaultScore('FreeAnswer')).toBeUndefined();
    });

    it('withDefaultScores fills Đúng/Sai as 0,25 per ý (total 1) and leaves edited scores', () => {
        const s = Default.section('E');
        s.questions = [...Default.trueFalseGroup('E', s.id), {...Default.question('MultipleChoice', 'E', s.id), data: {max_score: 0.5}}];
        const out = withDefaultScores([s])[0].questions;
        expect(out.slice(0, 4).map(q => q.data.max_score)).toEqual([0.25, 0.25, 0.25, 0.25]);
        expect(out[4].data.max_score).toBe(0.5);
        expect(examTotal([s])).toBe(1.5);
    });

    it('total ≠ 10 is only a hint, an essay without a score blocks publishing', () => {
        const s = Default.section('E');
        s.questions = [Default.question('FreeAnswer', 'E', s.id)];
        expect(publishProblems([s])).toContain('Câu 1: tự luận chưa nhập điểm');
        s.questions[0].data.max_score = 2;
        expect(publishProblems([s])).toEqual([]);
        expect(reviewHints([s]).some(h => h.includes('khác 10'))).toBe(true);
    });
});

describe('editor: score field and + Thêm ý', () => {
    it('editing the score shows "đã chỉnh"; reset restores the default', () => {
        start(s => { s.questions = [{...Default.question('MultipleChoice', 'E', s.id), data: {answers: []}}]; s.question_type = 'MultipleChoice'; });
        const input = screen.getByLabelText('Điểm câu') as HTMLInputElement;
        expect(input.value).toBe('0.25');
        expect(screen.queryByText('đã chỉnh')).toBeNull();
        fireEvent.change(input, {target: {value: '0.5'}});
        expect(questions()[0].data.max_score).toBe(0.5);
        expect(screen.getByText('đã chỉnh')).toBeTruthy();
        fireEvent.click(screen.getByText('↺ mặc định'));
        expect(questions()[0].data.max_score).toBeUndefined();
        expect(unitScore(questions())).toBe(0.25);
    });

    it('Đúng/Sai score is for the whole question, split over the 4 ý', () => {
        start(s => { s.questions = Default.trueFalseGroup('E', s.id); });
        fireEvent.change(screen.getByLabelText('Điểm câu'), {target: {value: '2'}});
        expect(questions().map(q => q.data.max_score)).toEqual([0.5, 0.5, 0.5, 0.5]);
    });

    it('a block with 3 ý gets "+ Thêm ý d)" which appends the missing ý', () => {
        start(s => { s.questions = Default.trueFalseGroup('E', s.id).slice(0, 3); });
        fireEvent.click(screen.getByText('+ Thêm ý d)'));
        expect(questions()).toHaveLength(4);
        expect(new Set(questions().map(q => q.data.passageId)).size).toBe(1);
        expect(screen.queryByText(/Thêm ý/)).toBeNull();
    });

    it('essay without a score says it blocks publishing', () => {
        start(s => { s.questions = [Default.question('FreeAnswer', 'E', s.id)]; });
        expect(screen.getByText(/Chưa nhập điểm/)).toBeTruthy();
    });
});
