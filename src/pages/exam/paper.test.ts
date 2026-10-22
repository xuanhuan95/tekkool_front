import {describe, expect, it} from 'vitest';

import {
    buildPaper, choiceKey, choiceWrites, formatDecimal, initialAnswers, isAnswered, kindOf, textValue,
    trueFalseValue, trueFalseWrites,
} from './paper';
import type {TestExam, TestQuestion} from '../../types/exam';

const mc = (id: string, extra: Partial<TestQuestion> = {}): TestQuestion => ({
    id, type: 'MultipleChoice',
    data: {question: `<p>${id}?</p>`, answers: [{id: id + 'a', value: '2'}, {id: id + 'b', value: '3'}]},
    ...extra,
});
const tf = (id: string, pid: string, extra: Partial<TestQuestion> = {}): TestQuestion => ({
    id, type: 'TrueFalse', data: {question: 'ý ' + id, passage: '<p>Cho hàm số</p>', passageId: pid}, ...extra,
});

const EXAM: TestExam = {
    id: 'E1', name: 'Đề 3', remaining_sec: 600,
    sections: [
        {id: 'S1', name: 'Trắc nghiệm', questions: [mc('Q1'), mc('Q2', {markedAnswer: '3'}), {id: 'X', type: 'MultipleChoice', data: {}}]},
        {id: 'S2', name: 'PHẦN II. Đúng sai', questions: [
            tf('T1', 'P1', {markedAnswer: 'true'}), tf('T2', 'P1', {markedAnswer: 'false'}), tf('T3', 'P1'), tf('T4', 'P1'),
            tf('U1', 'P2'), tf('U2', 'P2'), tf('U3', 'P2'), tf('U4', 'P2'),
        ]},
        {id: 'S3', name: '', questions: [{id: 'F1', type: 'FillBlank', data: {question: 'x?', max_score: 0.25}, markedAnswer: '<p>2,5</p>'},
            {id: 'F2', type: 'ShortAnswer', data: {question: 'y?', max_score: 0.25}}]},
        {id: 'S4', name: null, questions: [{id: 'E', type: 'FreeAnswer', data: {question: 'Giải', max_score: '1,5'}}]},
    ],
};

describe('buildPaper', () => {
    const paper = buildPaper(EXAM);

    it('numbers questions continuously and groups 4 Đúng/Sai statements into ONE question', () => {
        expect(paper.questions.map(q => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        const q3 = paper.questions[2];
        expect(q3.kind).toBe('truefalse');
        expect(q3.questionIds).toEqual(['T1', 'T2', 'T3', 'T4']);
        expect(q3.statements.map(s => s.key)).toEqual(['a', 'b', 'c', 'd']);
        expect(q3.prompt).toContain('Cho hàm số');
        expect(paper.questions[3].questionIds).toEqual(['U1', 'U2', 'U3', 'U4']);
    });

    it('skips empty placeholder questions like the old screen', () => {
        expect(paper.questions.some(q => q.questionIds.includes('X'))).toBe(false);
    });

    it('titles parts "Phần I · …", keeps a teacher title that already starts with "Phần"', () => {
        expect(paper.parts.map(p => p.title)).toEqual([
            'Phần I · Trắc nghiệm', 'PHẦN II. Đúng sai', 'Phần III · Trả lời ngắn', 'Phần IV · Tự luận']);
    });

    it('notes the question range, points when known and the SPT Đúng/Sai ladder', () => {
        expect(paper.parts[0].note).toBe('Câu 1–2 · chọn 1 đáp án');
        expect(paper.parts[1].note).toContain('Câu 3–4');
        expect(paper.parts[1].note).toContain('4 ý 1đ');
        expect(paper.parts[2].note).toBe('Câu 5–6 · 0,25 điểm/câu · chỉ ghi kết quả');
        expect(paper.parts[3].note).toBe('Câu 7 · 1,5 điểm/câu · trình bày lời giải');
        expect(paper.questions[6].maxScore).toBe(1.5);
    });

    it('a lone TrueFalse without passage stays a one-statement question', () => {
        const p = buildPaper({id: 'E', sections: [{id: 'S', questions: [{id: 'L', type: 'TrueFalse', data: {question: 'Trời xanh'}}]}]});
        expect(p.questions[0].statements).toHaveLength(1);
        expect(p.questions[0].prompt).toBe('');
    });

    it('maps legacy types to the 4 SPT kinds', () => {
        expect(['MultipleChoice', 'ErrorIdentify', 'TrueFalse', 'FillBlank', 'ShortAnswer', 'FreeAnswer'].map(kindOf))
            .toEqual(['choice', 'choice', 'truefalse', 'short', 'short', 'essay']);
    });
});

describe('answers after F5 come from the server (markedAnswer)', () => {
    const paper = buildPaper(EXAM);
    const answers = initialAnswers(EXAM);

    it('choice: stored VALUE (old screen) or id both select the option', () => {
        expect(choiceKey(paper.questions[1], answers)).toBe('B');
        expect(choiceKey(paper.questions[1], {Q2: 'Q2a'})).toBe('A');
        expect(choiceKey(paper.questions[0], answers)).toBeNull();
    });

    it('Đúng/Sai: per statement, unanswered = null', () => {
        expect(trueFalseValue(paper.questions[2], answers)).toEqual({a: true, b: false, c: null, d: null});
    });

    it('short answer saved as editor HTML by the old screen reads back as text', () => {
        expect(textValue(paper.questions[4], answers)).toBe('2,5');
    });

    it('answered flags', () => {
        expect(paper.questions.map(q => isAnswered(q, answers))).toEqual([false, true, true, false, true, false, false]);
        expect(isAnswered(paper.questions[5], {F2: '   '})).toBe(false);
        expect(isAnswered(paper.questions[6], {E: '<p></p>'})).toBe(false);
    });
});

describe('writes sent to save_answer', () => {
    const paper = buildPaper(EXAM);

    it('choice saves the option value', () => {
        expect(choiceWrites(paper.questions[0], 'B')).toEqual({Q1: '3'});
    });

    it('Đúng/Sai writes only changed statements; pressing again clears to ""', () => {
        const q = paper.questions[2];
        expect(trueFalseWrites(q, {a: true, b: false}, {a: true, b: false, c: true})).toEqual({T3: 'true'});
        expect(trueFalseWrites(q, {a: true}, {a: null})).toEqual({T1: ''});
    });
});

it('formatDecimal uses the Vietnamese comma', () => {
    expect(formatDecimal(0.25)).toBe('0,25');
    expect(formatDecimal(7.256)).toBe('7,26');
    expect(formatDecimal(2)).toBe('2');
});

it('imported labels ("Câu 1.", "a)") are not shown twice (QC B3)', () => {
    const p = buildPaper({id: 'E', sections: [{id: 'S', questions: [
        ...['a', 'b', 'c', 'd'].map(k => ({id: 'T' + k, type: 'TrueFalse',
            data: {question: `<p>${k}) ý ${k}</p>`, passage: '<p>Câu 1. Cho hàm số f</p>', passageId: 'P'}})),
        {id: 'M', type: 'MultipleChoice', data: {question: '<p><b>Câu 2:</b> Tính</p>', answers: []}},
    ]}]});
    expect(p.questions[0].prompt).toBe('<p>Cho hàm số f</p>');
    expect(p.questions[0].statements.map(s => s.html)).toEqual(['<p>ý a</p>', '<p>ý b</p>', '<p>ý c</p>', '<p>ý d</p>']);
    expect(p.questions[1].prompt).toBe('<p><b></b>Tính</p>');
});
