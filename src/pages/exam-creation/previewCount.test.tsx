import {beforeEach, describe, expect, it} from 'vitest';
import {render} from '@testing-library/react';

import PreviewExam from './PreviewExam';
import PreviewAnswer from './PreviewAnswer';
import {useExamDraftStore} from '../../stores/examDraftStore';
import type {Question} from './Default';

const mc = (id: string): Question => ({id, type: 'MultipleChoice', data: {question: id, answers: [{id: id + 'a', value: 'x'}], correctAnswerId: id + 'a'}} as unknown as Question);
const tf = (id: string, pid: string, k: number): Question =>
    ({id, type: 'TrueFalse', data: {question: `ý ${k}`, passage: '<p>Cho hàm số</p>', passageId: pid, correctAnswer: k % 2 === 0}} as unknown as Question);
const chum = (id: string, label: string): Question =>
    ({id, type: 'FillBlank', data: {question: 'ý ' + id, label, answer: '1,44', passage: '<p>Dẫn liệu</p>', passageId: 'G', block_type: 'ChumTLN'}} as unknown as Question);

function load(questions: Question[]) {
    useExamDraftStore.getState().setExam({
        id: 'E', name: 'Đề', sections: [{id: 'S', name: 'Phần I', questions}],
    } as never);
}

// Hoá-like: 2 TN + 1 Đúng/Sai (4 ý) + 1 chùm (4 ý) = 4 numbered questions, 10 stored questions.
const HOA = () => [mc('A'), mc('B'), tf('T1', 'P', 0), tf('T2', 'P', 1), tf('T3', 'P', 2), tf('T4', 'P', 3),
    chum('C1', 'a)'), chum('C2', 'b)'), chum('C3', 'c)'), chum('C4', 'd)')];

describe('SPT-97: Xem đề / In / Xem đáp án count questions like the exam page', () => {
    beforeEach(() => load(HOA()));

    it('Xem đề: Câu 1..4, ý of Đúng/Sai and chùm carry their labels, dẫn liệu printed once', () => {
        const {container} = render(<PreviewExam/>);
        const heads = [...container.querySelectorAll('b, span')].map(e => e.textContent || '').filter(t => /^Câu \d+:$/.test(t));
        expect(heads).toEqual(['Câu 1:', 'Câu 2:', 'Câu 3:', 'Câu 4:']);
        const text = container.textContent || '';
        for (const l of ['a)', 'b)', 'c)', 'd)']) expect(text).toContain(l);
        expect(text.match(/Dẫn liệu/g)).toHaveLength(1);
        expect(text.match(/Cho hàm số/g)).toHaveLength(1);
    });

    it('Xem đáp án: 4 numbered answers, Đúng/Sai and chùm list their ý', () => {
        const {container} = render(<PreviewAnswer/>);
        const text = container.textContent || '';
        expect(text).toContain('3. a) Đúng · b) Sai · c) Đúng · d) Sai');
        expect(text).toContain('4. ');
        expect(text).not.toMatch(/\b5\. /);
    });

    it('a Văn-style exam (no grouping) keeps one number per question', () => {
        load([mc('A'), mc('B'), mc('C')]);
        const {container} = render(<PreviewExam/>);
        expect((container.textContent || '').match(/Câu \d+:/g)).toEqual(['Câu 1:', 'Câu 2:', 'Câu 3:']);
    });
});
