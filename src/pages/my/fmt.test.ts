import {describe, it, expect} from 'vitest';
import {fmtDate, fmtDuration, round} from './fmt';

describe('round', () => {
    it('trims float tails, does not show 2.9999999999999996', () => {
        // Literature: 10 questions x 0.3 points. 0.3 is not exactly representable as a float.
        const sum = Array(10).fill(0.3).reduce((a, b) => a + b, 0);
        expect(sum).not.toBe(3);           // this is why the function exists
        expect(round(sum)).toBe(3);
    });

    it('2.0 shows as 2, 1.5 stays', () => {
        expect(round(2.0)).toBe(2);
        expect(round(1.5)).toBe(1.5);
    });

    it('no score is 0, not NaN', () => {
        expect(round(undefined)).toBe(0);
        expect(round(null)).toBe(0);
        // 0 points is a real score, must not be mistaken for "none yet".
        expect(round(0)).toBe(0);
    });
});

describe('fmtDate', () => {
    it('BE UTC without Z must still convert correctly to Vietnam time', () => {
        // datetime.utcnow().isoformat() carries no 'Z'. Without handling, the
        // browser reads it as local time -> off by 7 hours.
        const withoutZ = fmtDate('2026-10-04T06:00:00');
        const withZ = fmtDate('2026-10-04T06:00:00Z');
        expect(withoutZ).toBe(withZ);
    });

    it('empty or garbage shows a dash, does not break', () => {
        expect(fmtDate(undefined)).toBe('—');
        expect(fmtDate('')).toBe('—');
        expect(fmtDate('not-a-date')).toBe('—');
    });
});

describe('fmtDuration', () => {
    it('under 1 hour shows minutes', () => {
        expect(fmtDuration(90)).toBe('1 phút');
        expect(fmtDuration(45 * 60)).toBe('45 phút');
    });

    it('1 hour or more shows hours, minutes zero-padded', () => {
        expect(fmtDuration(60 * 60)).toBe('1h00');
        expect(fmtDuration(65 * 60)).toBe('1h05');
        expect(fmtDuration(125 * 60)).toBe('2h05');
    });

    it('missing shows a dash', () => {
        expect(fmtDuration(undefined)).toBe('—');
        expect(fmtDuration(0)).toBe('—');
    });
});
