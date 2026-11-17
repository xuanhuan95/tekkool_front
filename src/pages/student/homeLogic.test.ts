import {describe, it, expect} from 'vitest';

import {chainGeometry, gapToThird, greetingWord, sameSubject, scoreLevel, splitSubjects, streakState, subjectStats, weekStrip} from './homeLogic';
import type {Submission} from '../../types/submission';

// 2026-11-18 is a Wednesday. Vietnam = UTC+7.
const at = (iso: string) => new Date(iso);

describe('greetingWord (Vietnam time)', () => {
    it('sáng / chiều / tối', () => {
        expect(greetingWord(at('2026-11-18T01:00:00Z'))).toBe('sáng');    // 08:00
        expect(greetingWord(at('2026-11-18T07:00:00Z'))).toBe('chiều');   // 14:00
        expect(greetingWord(at('2026-11-18T13:00:00Z'))).toBe('tối');     // 20:00
        expect(greetingWord(at('2026-11-18T20:00:00Z'))).toBe('tối');     // 03:00 next day
        expect(greetingWord(at('2026-11-17T22:30:00Z'))).toBe('sáng');    // 05:30
    });
});

describe('streakState', () => {
    it('done / keep / zero', () => {
        expect(streakState({current: 4, this_week_done: true})).toBe('done');
        expect(streakState({current: 3, this_week_done: false})).toBe('keep');
        expect(streakState({current: 0, this_week_done: false})).toBe('zero');
    });
});

describe('weekStrip', () => {
    it('Mon–Sun of the current week, today and future flags, label and count', () => {
        const w = weekStrip([true, false, true, false, false, false, false], at('2026-11-18T03:00:00Z'));
        expect(w.label).toBe('Tuần 16–22/11');
        expect(w.practised).toBe(2);
        expect(w.days.map(d => d.label + d.day)).toEqual(['T216', 'T317', 'T418', 'T519', 'T620', 'T721', 'CN22']);
        expect(w.days.map(d => d.today)).toEqual([false, false, true, false, false, false, false]);
        expect(w.days.map(d => d.future)).toEqual([false, false, false, true, true, true, true]);
    });
    it('Sunday belongs to the week that started on Monday; month change shows both months', () => {
        const sun = weekStrip(undefined, at('2026-11-29T05:00:00Z'));
        expect(sun.days[6]).toMatchObject({label: 'CN', day: 29, today: true});
        expect(sun.label).toBe('Tuần 23–29/11');
        expect(weekStrip([], at('2026-12-02T03:00:00Z')).label).toBe('Tuần 30/11–6/12');
    });
    it('late Sunday UTC is already Monday in Vietnam', () => {
        expect(weekStrip([], at('2026-11-22T18:00:00Z')).days[0]).toMatchObject({label: 'T2', day: 23, today: true});
    });
});

describe('scoreLevel', () => {
    it('thresholds 8 / 6,5 / 5', () => {
        expect([9, 8, 7.9, 6.5, 6.4, 5, 4.9, 0].map(scoreLevel)).toEqual(['hi', 'hi', 'mid', 'mid', 'fair', 'fair', 'lo', 'lo']);
    });
});

const sub = (o: Partial<Submission> & {subjectId: string}): Submission => ({
    id: Math.random().toString(), exam_name: 'Đề', status: 'GRADED', pending_count: 0, score: 5, max_score: 10,
    submitted_at: '2026-11-01T00:00:00', subject: {id: o.subjectId, name: 'x'}, ...o,
} as unknown as Submission);

describe('subjectStats', () => {
    it('counts attempts, best final score; pending ones only give a provisional score', () => {
        const m = subjectStats([
            sub({subjectId: 'a', score: 9}), sub({subjectId: 'a', score: 7}),
            sub({subjectId: 'b', score: 6.5, status: 'GRADING', pending_count: 2}),
            sub({subjectId: 'c', score: 4}), sub({subjectId: 'c', score: 8, pending_count: 1}),
        ]);
        expect(m.get('a')).toEqual({count: 2, best: 9, provisional: null});
        expect(m.get('b')).toEqual({count: 1, best: null, provisional: 6.5});
        expect(m.get('c')).toEqual({count: 2, best: 4, provisional: 8});
        expect(m.get('d')).toBeUndefined();
    });
});

describe('splitSubjects', () => {
    const all = [
        {id: 'math', name: 'Toán', exams: 2, done: 1, last: null}, {id: 'phys', name: 'Vật lý', exams: 1, done: 0, last: null},
        {id: 'bio', name: 'Sinh học', exams: 0, done: 0, last: null}, {id: 'chem', name: 'Hóa học', exams: 3, done: 0, last: null},
    ];
    it('chosen subjects go first; the rest: open before "Sắp có"', () => {
        const r = splitSubjects(all, ['math'], new Map());
        expect(r.practising.map(s => s.id)).toEqual(['math']);
        expect(r.more.map(s => s.id)).toEqual(['phys', 'chem', 'bio']);
    });
    it('nothing chosen (old account): falls back to subjects already attempted', () => {
        expect(splitSubjects(all, [], new Map()).practising.map(s => s.id)).toEqual(['math']);
        expect(splitSubjects(all, [], new Map()).more).toHaveLength(3);
    });
});

describe('sameSubject', () => {
    it('matches by design key, then by plain name', () => {
        expect(sameSubject('Toán', 'Toán')).toBe(true);
        expect(sameSubject('Hoa hoc', 'Hóa học')).toBe(true);
        expect(sameSubject('Toán', 'Vật lý')).toBe(false);
        expect(sameSubject(null, 'Toán')).toBe(false);
    });
});

describe('chainGeometry', () => {
    it('9 nodes, 2 open: same numbers as the artboard', () => {
        const g = chainGeometry(9, 2);
        expect(g.viewBox).toBe('0 0 900 168');
        expect(g.open).toBe('M50.0,28.0 C100.0,28.0 100.0,76.0 150.0,76.0');
        expect(g.soon.startsWith('M150.0,76.0 C200.0,76.0 200.0,28.0 250.0,28.0')).toBe(true);
        expect(g.nodes[1]).toEqual({left: '16.67%', top: 48});
        expect(g.nodes[0]).toEqual({left: '5.56%', top: 0});
    });
    it('no open path when fewer than 2 are open; no soon path when all are open', () => {
        expect(chainGeometry(3, 1).open).toBe('');
        expect(chainGeometry(3, 3).soon).toBe('');
    });
});

describe('gapToThird', () => {
    it('shows the missing points, nothing on the podium or without data', () => {
        expect(gapToThird(51.5, 12.5, 12)).toBe('39');
        expect(gapToThird(51.5, 12, 12)).toBe('39,5');
        expect(gapToThird(51.5, 60, 4)).toBe('0');
        expect(gapToThird(51.5, 60, 3)).toBeNull();
        expect(gapToThird(undefined, 10, 9)).toBeNull();
    });
});
