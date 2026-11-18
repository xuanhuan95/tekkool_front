import {describe, expect, it} from 'vitest';

import {
    buildPaper, choiceKey, choiceWrites, initialAnswers, isAnswered, kindOf, textValue,
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

describe('points per question (Q3: the teacher sets them)', () => {
    const mc = (id: string, score: number) => ({id, type: 'MultipleChoice',
        data: {question: `<p>${id}</p>`, answers: [{id: id + 'A', value: '1'}, {id: id + 'B', value: '2'}], max_score: score}});
    const exam = (...qs: ReturnType<typeof mc>[]) => ({id: 'E', sections: [{id: 'S', name: 'Phần I', questions: qs}]}) as never;

    it('same score → no per-question points; different scores → each question shows its own points', () => {
        const same = buildPaper(exam(mc('a', 0.25), mc('b', 0.25)));
        expect(same.questions.some(q => q.showPoints)).toBe(false);
        const mixed = buildPaper(exam(mc('a', 0.25), mc('b', 0.5)));
        expect(mixed.questions.map(q => q.showPoints)).toEqual([true, true]);
    });
});

describe('SPT-97: câu chùm trả lời ngắn', () => {
    const chum = (id: string, label: string, extra: Partial<TestQuestion> = {}): TestQuestion => ({
        id, type: 'FillBlank',
        data: {question: `ý ${id}`, label, passage: '<p>Dẫn liệu</p>', passageId: 'G1', block_type: 'short_answer_group', max_score: 0.5},
        ...extra,
    });
    const exam: TestExam = {id: 'H', sections: [
        {id: 'S1', name: 'Phần I', questions: [mc('Q1')]},
        {id: 'S2', name: 'Phần IV', questions: [chum('C1', 'a)', {markedAnswer: '10,0'}), chum('C2', 'b)'), chum('C3', 'c)'), chum('C4', 'd)'),
            {id: 'F', type: 'FillBlank', data: {question: 'lẻ?', max_score: 0.25}}]},
    ]};
    const paper = buildPaper(exam);

    it('counts one chùm as ONE question, the lone FillBlank after it as the next', () => {
        expect(paper.questions.map(q => q.number)).toEqual([1, 2, 3]);
        const c = paper.questions[1];
        expect(c.kind).toBe('cluster');
        expect(c.questionIds).toEqual(['C1', 'C2', 'C3', 'C4']);
        expect(c.statements[1]).toMatchObject({html: 'ý C2', label: 'b)'});   // BE sends the label apart from the text
        expect(c.maxScore).toBe(2);
        expect(paper.questions[2].kind).toBe('short');
    });

    it('is answered once any ý has text (F5 keeps it through markedAnswer)', () => {
        const c = paper.questions[1];
        expect(isAnswered(c, {})).toBe(false);
        expect(isAnswered(c, initialAnswers(exam))).toBe(true);
        expect(isAnswered(c, {C3: '  '})).toBe(false);
    });

    it('a FillBlank without short_answer_group stays one short question per box', () => {
        const p = buildPaper({id: 'X', sections: [{id: 'S', questions: [
            {id: 'A', type: 'FillBlank', data: {question: 'a', passageId: 'G'}}, {id: 'B', type: 'FillBlank', data: {question: 'b', passageId: 'G'}}]}]});
        expect(p.questions.map(q => q.kind)).toEqual(['short', 'short']);
    });
});

describe('exam drawn with a frame (first_no, titles)', () => {
    const framed: TestExam = {
        id: 'F', name: 'Văn', remaining_sec: 60,
        sections: [
            {id: 'a', name: 'Đọc hiểu', first_no: 1, group_title: 'A. TRẮC NGHIỆM', part_title: 'PHẦN I (3 điểm)', part_lead: 'Trả lời từ câu 1 đến câu 2',
             sub_title: 'I.1 Đọc văn bản', questions: [mc('Q1'), mc('Q2')]},
            {id: 'b', name: 'Đoạn văn', first_no: 1, part_title: 'PHẦN II', questions: [mc('Q3')]},
            {id: 'c', name: 'Bài văn', first_no: 2, sub_title: 'Viết bài', questions: [mc('Q4')]},
        ],
    };
    const paper = buildPaper(framed);

    it('shows the frame numbers but keeps unique positions for ids and jumps', () => {
        expect(paper.questions.map(q => q.label)).toEqual([1, 2, 1, 2]);   // Phần II restarts at Câu 1
        expect(paper.questions.map(q => q.number)).toEqual([1, 2, 3, 4]);
    });

    it('titles: group + lead + sub only on the first section; a tiểu mục without part_title has no heading', () => {
        expect(paper.parts[0]).toMatchObject({groupTitle: 'A. TRẮC NGHIỆM', title: 'PHẦN I', lead: 'Trả lời từ câu 1 đến câu 2', subTitle: 'I.1 Đọc văn bản'});
        expect(paper.parts[1].groupTitle).toBeUndefined();
        expect(paper.parts[2]).toMatchObject({title: '', subTitle: 'Viết bài'});
    });

    it('continuing sections (2nd block of a tiểu mục, 3rd of a Phần) show no heading again', () => {
        const sec = (id: string, extra: object) => ({id, name: 'n', first_no: 1, questions: [mc(id)], ...extra});
        const p = buildPaper({id: 'F', name: 'x', remaining_sec: 1, sections: [
            sec('a', {group_title: 'A.', part_title: 'Phần I (3 điểm)', part_lead: 'lead', part_score: 3, sub_title: 'I.1'}),
            sec('b', {sub_title: 'I.1'}),                          // 2nd block of the same tiểu mục (even if BE repeated it)
            sec('c', {part_title: 'Phần I (3 điểm)'}),             // 3rd block of the Phần
            sec('d', {sub_title: 'I.2'}),
        ]} as TestExam).parts;
        expect(p.map(x => [x.title, x.subTitle, x.groupTitle, x.lead, x.partScore])).toEqual([
            ['Phần I', 'I.1', 'A.', 'lead', 3], ['', undefined, undefined, undefined, undefined],
            ['', undefined, undefined, undefined, undefined], ['', 'I.2', undefined, undefined, undefined]]);
    });

    it('part_score → partScore (null/missing → undefined); framed flag only with a frame', () => {
        const mk = (extra: object) => buildPaper({id: 'F', name: 'x', remaining_sec: 1, sections: [{id: 'a', name: 'n', questions: [mc('Q1')], ...extra}]}).parts[0];
        expect(mk({first_no: 1, part_title: 'Phần I', part_score: 3})).toMatchObject({framed: true, partScore: 3});
        expect(mk({first_no: 1, part_title: 'Phần I', part_score: null}).partScore).toBeUndefined();
        expect(mk({}).framed).toBeUndefined();
    });
});
