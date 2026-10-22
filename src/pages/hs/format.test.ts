import {describe, it, expect} from 'vitest';

import {errorText, formatDayMonth, formatIsoDay, formatPoints, formatScore, minutesLeft, parseServerDate, plainText, score10} from './format';
import {studentTitle} from './title';

describe('format', () => {
    it('score on 10 with Vietnamese comma', () => {
        expect(formatScore(score10(7.75, 10))).toBe('7,75');
        expect(formatScore(score10(13, 20))).toBe('6,50');
        expect(formatScore(score10(1, 0))).toBe('—');
        expect(score10(null, 10)).toBeNull();
    });
    it('ranking points 1 decimal', () => {
        expect(formatPoints(86.5)).toBe('86,5');
        expect(formatPoints(71)).toBe('71,0');
        expect(formatPoints(17.25)).toBe('17,3');
        expect(formatPoints(null)).toBe('—');
    });
    it('server dates are UTC without Z → Vietnam day', () => {
        expect(parseServerDate('2026-10-18T18:30:00')!.toISOString()).toBe('2026-10-18T18:30:00.000Z');
        expect(formatDayMonth('2026-10-18T18:30:00')).toBe('19/10');   // 01:30 on the 19th in Vietnam
        expect(formatDayMonth(null)).toBe('—');
        expect(formatIsoDay('2026-10-19')).toBe('19/10');
    });
    it('minutes left rounds up', () => {
        expect(minutesLeft(2280)).toBe('còn 38 phút');
        expect(minutesLeft(61)).toBe('còn 2 phút');
        expect(minutesLeft(0)).toBe('đã hết giờ');
    });
    it('plain text from exam HTML', () => {
        expect(plainText('<p>Toán&nbsp;— Đề <b>3</b></p>')).toBe('Toán — Đề 3');
    });
    it('error text', () => {
        expect(errorText({code: 400, error: 'Sai'}, 'x')).toBe('Sai');
        expect(errorText({code: 500}, 'Lỗi')).toBe('Lỗi');
        expect(errorText(new TypeError('fetch'), 'x')).toMatch(/kết nối/);
    });
});

describe('studentTitle (temporary rule)', () => {
    const now = new Date('2026-10-22T05:00:00Z');
    const at = (iso: string) => ({submitted_at: iso});
    it('no data → hidden', () => {
        expect(studentTitle(undefined, now)).toBeNull();
    });
    it('fewer than 5 in total → Người mới with progress to Học sinh chăm', () => {
        const t = studentTitle([at('2026-10-01T03:00:00'), at('2026-09-01T03:00:00')], now)!;
        expect(t.title).toBe('Người mới');
        expect(t.next).toEqual({title: 'Học sinh chăm', value: 1, max: 5, remaining: 4});
    });
    it('5 this month (Vietnam calendar) → Học sinh chăm', () => {
        // 30/09 18:00 UTC = 01/10 01:00 in Vietnam → counts for October.
        const subs = ['2026-09-30T18:00:00', '2026-10-02T01:00:00', '2026-10-05T01:00:00',
            '2026-10-10T01:00:00', '2026-10-20T01:00:00'].map(at);
        expect(studentTitle(subs, now)!.title).toBe('Học sinh chăm');
    });
    it('5+ in total but fewer this month → no title', () => {
        const subs = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-04'].map(d => at(d + 'T01:00:00'));
        expect(studentTitle(subs, now)).toBeNull();
    });
});
