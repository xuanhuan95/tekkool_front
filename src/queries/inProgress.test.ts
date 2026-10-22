import {describe, it, expect} from 'vitest';
import {remainingLabel} from './inProgress';

describe('remainingLabel', () => {
    it('rounds up to whole minutes', () => {
        expect(remainingLabel(1500)).toBe('còn 25 phút');
        expect(remainingLabel(61)).toBe('còn 2 phút');
        expect(remainingLabel(60)).toBe('còn 1 phút');
    });
    it('under a minute and expired', () => {
        expect(remainingLabel(30)).toBe('còn dưới 1 phút');
        expect(remainingLabel(0)).toBe('đã hết giờ');
        expect(remainingLabel(-5)).toBe('đã hết giờ');
        expect(remainingLabel(NaN)).toBe('đã hết giờ');
    });
});
