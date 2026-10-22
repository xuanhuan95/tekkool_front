import {describe, expect, it} from 'vitest';

import {
    buildReview, filterReview, formatMinutes, formatRankPoints, formatScore, formatTimeDate, parseServerDate,
    partRows, reviewBadge, summarize, toScale10,
} from './submissionView';
import type {SubmissionAnswer, SubmissionDetail} from '../../types/submission';

const tf = (id: string, answer: string | null, correct: string, score: number): SubmissionAnswer => ({
    question_id: id, type: 'TrueFalse', section_name: 'Phần II', question_text: 'ý ' + id,
    passage: 'Cho hàm số', passage_id: 'P1', answer, correct, score, max_score: 0.25,
});

const ANSWERS: SubmissionAnswer[] = [
    {question_id: 'Q1', type: 'MultipleChoice', section_name: 'Phần I', question_text: '1+1?',
     answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}], correct_id: 'A1', correct: '2', answer: '2', score: 0.25, max_score: 0.25},
    {question_id: 'Q2', type: 'MultipleChoice', section_name: 'Phần I', question_text: '2+2?',
     answers: [{id: 'B1', value: '4'}, {id: 'B2', value: '5'}], correct_id: 'B1', correct: '4', answer: 'B2', score: 0, max_score: 0.25},
    // 2 of 4 statements right → 0,25 of 1 point, shared by the right ones.
    tf('T1', 'true', 'true', 0.125), tf('T2', 'true', 'false', 0), tf('T3', 'false', 'false', 0.125), tf('T4', null, 'true', 0),
    {question_id: 'S1', type: 'ShortAnswer', section_name: 'Phần III', question_text: 'x?', answer: '2,5', correct: '2,5|2.5', score: 0.25, max_score: 0.25},
    {question_id: 'E1', type: 'FreeAnswer', section_name: 'Phần IV', question_text: 'Giải', answer: '<p>Bài</p>', score: null, max_score: 1.5},
];

const DETAIL: SubmissionDetail = {
    id: 'SUB', score: 0.75, max_score: 3.25, graded_max_score: 1.75, pending_count: 1, status: 'GRADING',
    phan: [
        {ten: 'Phần I', score: 0.25, max_score: 0.5, pending: 0},
        {ten: 'Phần II', score: 0.25, max_score: 1, pending: 0},
        {ten: 'Phần III', score: 0.25, max_score: 0.25, pending: 0},
        {ten: 'Phần IV', score: 0, max_score: 1.5, pending: 1},
    ],
    answers: ANSWERS,
};

describe('score on the 10-point scale', () => {
    it('SPT paper out of 10 stays as is; other papers are scaled', () => {
        expect(toScale10(7.25, 10)).toBe(7.25);
        expect(toScale10(8, 16)).toBe(5);
        expect(toScale10(3, 0)).toBe(0);
    });

    it('provisional while essays wait; pending points on the 10 scale; +10 rank points', () => {
        const s = summarize({...DETAIL, score: 5.75, max_score: 10, graded_max_score: 8.5});
        expect(s.isProvisional).toBe(true);
        expect(s.score10).toBe(5.75);
        expect(s.pendingPoints10).toBeCloseTo(1.5);
        expect(s.rankPoints).toBe(15.8);
        expect(summarize({...DETAIL, pending_count: 0, score: 7.25, max_score: 10, graded_max_score: 10}).pendingPoints10).toBe(0);
    });

    it('formats like the design: 7,25 · 6,50 · 17,3', () => {
        expect(formatScore(7.25)).toBe('7,25');
        expect(formatScore(6.5)).toBe('6,50');
        expect(formatRankPoints(17.25)).toBe('17,3');
        expect(formatRankPoints(10)).toBe('10,0');
    });
});

describe('review items', () => {
    const items = buildReview(ANSWERS);

    it('numbers like the exam: 4 Đúng/Sai statements are ONE question', () => {
        expect(items.map(i => [i.number, i.kind])).toEqual([[1, 'choice'], [2, 'choice'], [3, 'truefalse'], [4, 'short'], [5, 'essay']]);
    });

    it('choice: marks what the student chose (by value or id) and the correct option', () => {
        expect(items[0].options.map(o => [o.chosen, o.correct])).toEqual([[true, true], [false, false]]);
        expect(items[1].options.map(o => [o.chosen, o.correct])).toEqual([[false, true], [true, false]]);
        expect(items[0].status).toBe('correct');
        expect(items[1].status).toBe('wrong');
    });

    it('Đúng/Sai: right/wrong per statement, partial status, summed score', () => {
        const q = items[2];
        expect(q.statements.map(s => s.ok)).toEqual([true, false, true, false]);
        expect(q.statements[3].answer).toBeNull();
        expect(q.status).toBe('partial');
        expect(reviewBadge(q)).toBe('2 / 4 ý · 0,25 / 1');
    });

    it('essay waits for the teacher', () => {
        expect(items[4].status).toBe('pending');
        expect(reviewBadge(items[4])).toBe('Chờ giáo viên chấm');
        expect(reviewBadge(items[1])).toBe('Sai · 0 điểm');
        expect(reviewBadge(items[3])).toBe('Đúng · 0,25 điểm');
    });

    it('filters: Sai includes partial Đúng/Sai; Tự luận = essays', () => {
        expect(filterReview(items, 'wrong').map(i => i.number)).toEqual([2, 3]);
        expect(filterReview(items, 'correct').map(i => i.number)).toEqual([1, 4]);
        expect(filterReview(items, 'essay').map(i => i.number)).toEqual([5]);
    });

    it('a shared reading text is attached to the first question of its group only', () => {
        const withPassage = buildReview([
            {...ANSWERS[0], passage: 'Văn bản', passage_id: 'R1'},
            {...ANSWERS[1], passage: 'Văn bản', passage_id: 'R1'},
        ]);
        expect(withPassage.map(i => i.passage)).toEqual(['Văn bản', null]);
    });
});

it('part table: correct counts per part, "ý" for Đúng/Sai, essay pending', () => {
    expect(partRows(DETAIL)).toEqual([
        {name: 'Phần I', correct: '1 / 2', score: 0.25, maxScore: 0.5, pending: false},
        {name: 'Phần II', correct: '2 / 4 ý', score: 0.25, maxScore: 1, pending: false},
        {name: 'Phần III', correct: '1 / 1', score: 0.25, maxScore: 0.25, pending: false},
        {name: 'Phần IV', correct: '—', score: null, maxScore: 1.5, pending: true},
    ]);
});

it('dates from BE are UTC without Z; minutes round up', () => {
    const d = parseServerDate('2026-10-21T13:47:00');
    expect(d?.toISOString()).toBe('2026-10-21T13:47:00.000Z');
    expect(parseServerDate('nope')).toBeNull();
    expect(formatTimeDate(new Date(2026, 9, 21, 20, 47))).toBe('20:47 · 21/10/2026');
    expect(formatMinutes(4920)).toBe('82 phút');
    expect(formatMinutes(0)).toBe('—');
});
