import {describe, it, expect} from 'vitest';
import {subjectStyle} from './subjectStyle';

// Test cũ chép lại SUBJECTS + subjectStyle sang file test vì node trần không
// chạy được JSX. Giờ hàm nằm ở module riêng nên import thẳng — sửa bảng môn
// mà quên sửa test không còn làm test xanh giả nữa.
const key = (name: string | null) => subjectStyle(name).key;

describe('subjectStyle', () => {
    it.each([
        ['Văn', 'van'], ['Tiếng Anh', 'anh'], ['Toán', 'toan'], ['Lý', 'ly'],
        ['Hóa', 'hoa'], ['Sinh', 'sinh'], ['Lịch sử', 'su'], ['Địa lý', 'dia'],
    ])('8 môn thật trên production: %s -> %s', (name, want) => expect(key(name)).toBe(want));

    it.each([
        ['Hoá', 'hoa'], ['Vật lý', 'ly'], ['Ngữ văn', 'van'],
        ['Sinh học', 'sinh'], ['Địa lí', 'dia'], ['TOÁN', 'toan'], ['  Văn  ', 'van'],
    ])('viết khác dấu / khác cách gọi: %s -> %s', (name, want) => expect(key(name)).toBe(want));

    it('"Lịch sử" KHÔNG được dính "sinh"', () => expect(key('Lịch sử')).toBe('su'));

    it.each([
        ['Giáo dục thể chất'], [''],
    ])('môn lạ rơi về fallback, không vỡ: %s', (name) => expect(key(name)).toBe('khac'));

    it('name null không vỡ', () => expect(key(null)).toBe('khac'));

    it.each([
        ['Toán rời rạc', 'toan'], ['Lịch sử Đảng', 'su'],
    ])('khớp theo ranh giới từ: %s -> %s', (name, want) => expect(key(name)).toBe(want));

    it('mọi môn đều có icon và màu', () => {
        for (const name of ['Văn', 'Toán', 'Môn lạ hoắc']) {
            const s = subjectStyle(name);
            expect(s.icon).toBeTruthy();
            expect(s.bg).toContain('gradient');
        }
    });
});
