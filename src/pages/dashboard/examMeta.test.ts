import {describe, expect, it} from 'vitest';

import {lastWorkedSubject, partContent, statsText, whenText} from './examMeta';

describe('statsText', () => {
    it('joins what is known; drawn exams show ~N câu; no duration says so', () => {
        expect(statsText({question_count: 12, points_total: 10, duration: 90})).toBe('12 câu · 10 điểm · 90 phút');
        expect(statsText({question_count: 12, points_total: 7.5, approx: true, duration: 45})).toBe('~12 câu · 7,5 điểm · 45 phút');
        expect(statsText({question_count: 3})).toBe('3 câu · không giới hạn thời gian');
        expect(statsText({})).toBe('không giới hạn thời gian');
    });
});

describe('whenText (Vietnam time)', () => {
    const now = new Date('2026-11-20T08:00:00Z');   // 15:00 on 20/11 in Vietnam
    it.each([
        ['2026-11-20T07:05:00Z', false, 'hôm nay 14:05'],
        ['2026-11-19T02:20:00Z', false, 'hôm qua'],
        ['2026-11-19T02:20:00Z', true, 'hôm qua 09:20'],
        ['2026-11-18T10:00:00Z', false, '18/11'],
        ['2026-11-15T02:20:00Z', true, '15/11 09:20'],
        ['2026-11-19T17:30:00Z', false, 'hôm nay 00:30'],   // 00:30 on 20/11 in Vietnam, still 19/11 in UTC
        [null, false, null],
        [undefined, true, null],
    ])('%s (%s) → %s', (iso, withTime, want) => expect(whenText(iso, withTime, now)).toBe(want));
});

describe('lastWorkedSubject', () => {
    const subs = [{id: 'a', name: 'Toán', last_exam_at: '2026-11-10T00:00:00Z'}, {id: 'b', name: 'Hoá', hidden: true, last_exam_at: '2026-11-19T00:00:00Z'}, {id: 'c', name: 'Sử', last_exam_at: null}];
    it('latest last_exam_at wins (even a hidden subject); none → first subject', () => {
        expect(lastWorkedSubject(subs)?.id).toBe('b');
        expect(lastWorkedSubject([subs[2], {id: 'd', name: 'x'}])?.id).toBe('c');
        expect(lastWorkedSubject([])).toBeUndefined();
    });
});

describe('partContent', () => {
    it('drawn: blocks × questions per block + ", rút ngẫu nhiên"', () => {
        const p = {title: 'Phần I', question_count: 10, items: [{block_type: 'reading', blocks: 2, questions: 10}]};
        expect(partContent(p, true)).toBe('2 đoạn đọc hiểu × 5 câu, rút ngẫu nhiên');
        expect(partContent({...p, items: [{block_type: 'paragraph', blocks: 1, questions: 1}]}, true)).toBe('1 câu viết đoạn văn, rút ngẫu nhiên');
    });
    it('fixed: one kind → its name; mixed kinds → count by kind', () => {
        expect(partContent({title: 'Phần I', question_count: 12, items: [{block_type: null, type: 'mcq', questions: 12}]}, false)).toBe('Trắc nghiệm');
        expect(partContent({title: 'Phần I', question_count: 14, items: [{block_type: null, type: 'mcq', questions: 12}, {block_type: null, type: 'essay', questions: 2}]}, false))
            .toBe('12 câu trắc nghiệm, 2 câu tự luận');
    });
});
