import {describe, it, expect} from 'vitest';
import {subjectStyle} from './subjectStyle';

// The old test copied SUBJECTS + subjectStyle into the test file because bare node
// cannot run JSX. Now the function is in its own module so it is imported directly — editing
// the subject table and forgetting the test no longer leaves a falsely green test.
const key = (name: string | null) => subjectStyle(name).key;

describe('subjectStyle', () => {
    it.each([
        ['Văn', 'van'], ['Tiếng Anh', 'anh'], ['Toán', 'toan'], ['Lý', 'ly'],
        ['Hóa', 'hoa'], ['Sinh', 'sinh'], ['Lịch sử', 'su'], ['Địa lý', 'dia'],
    ])('8 real subjects on production: %s -> %s', (name, want) => expect(key(name)).toBe(want));

    it.each([
        ['Hoá', 'hoa'], ['Vật lý', 'ly'], ['Ngữ văn', 'van'],
        ['Sinh học', 'sinh'], ['Địa lí', 'dia'], ['TOÁN', 'toan'], ['  Văn  ', 'van'],
    ])('different accents / different names: %s -> %s', (name, want) => expect(key(name)).toBe(want));

    it('"Lịch sử" must NOT be caught by "sinh"', () => expect(key('Lịch sử')).toBe('su'));

    it.each([
        ['Giáo dục thể chất'], [''],
    ])('unknown subject falls back, does not break: %s', (name) => expect(key(name)).toBe('khac'));

    it('null name does not break', () => expect(key(null)).toBe('khac'));

    it.each([
        ['Toán rời rạc', 'toan'], ['Lịch sử Đảng', 'su'],
    ])('matches on word boundaries: %s -> %s', (name, want) => expect(key(name)).toBe(want));

    it('every subject has an icon and colour', () => {
        for (const name of ['Văn', 'Toán', 'Môn lạ hoắc']) {
            const s = subjectStyle(name);
            expect(s.icon).toBeTruthy();
            expect(s.bg).toContain('gradient');
        }
    });
});
