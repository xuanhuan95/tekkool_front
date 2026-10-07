import {describe, it, expect} from 'vitest';
import {measure} from './textLimit';

describe('measure — word count', () => {
    it('English: split on spaces', () => {
        expect(measure('I am a student', 'word')).toBe(4);
    });

    it('Literature: Vietnamese is written syllable by syllable so each is one unit', () => {
        expect(measure('Trường Trung học phổ thông', 'word')).toBe(5);
    });

    it('empty box counts 0, not 1', () => {
        expect(measure('', 'word')).toBe(0);
        expect(measure('   ', 'word')).toBe(0);
    });

    it('consecutive spaces are still a single boundary', () => {
        expect(measure('a    b', 'word')).toBe(2);
    });

    it('a line break is also a word boundary — one line per block', () => {
        expect(measure('đoạn một\nđoạn hai', 'word')).toBe(4);
    });

    it('leading/trailing spaces do not create phantom words', () => {
        expect(measure('  bài làm  ', 'word')).toBe(2);
    });
});

describe('measure — character count', () => {
    it('RAW count: a trailing space MUST count, otherwise spaces can be typed forever at the 20/20 mark', () => {
        expect(measure('abc ', 'char')).toBe(4);
    });

    it('NFC: "ệ" typed on macOS is 3 separate code points, must count as 1', () => {
        const nfd = 'ệ'.normalize('NFD');   // e + circumflex + dot below
        expect(nfd.length).toBeGreaterThan(1);
        expect(measure(nfd.normalize('NFC'), 'char')).toBe(1);
    });
});
