import {describe, it, expect} from 'vitest';
import {measure} from './textLimit';

describe('measure — đếm từ', () => {
    it('Tiếng Anh: tách theo dấu cách', () => {
        expect(measure('I am a student', 'word')).toBe(4);
    });

    it('Ngữ văn: tiếng Việt viết rời nên mỗi tiếng là một đơn vị', () => {
        expect(measure('Trường Trung học phổ thông', 'word')).toBe(5);
    });

    it('ô trống đếm 0, không phải 1', () => {
        expect(measure('', 'word')).toBe(0);
        expect(measure('   ', 'word')).toBe(0);
    });

    it('nhiều space liền nhau vẫn là một ranh giới', () => {
        expect(measure('a    b', 'word')).toBe(2);
    });

    it('xuống dòng cũng là ranh giới từ — mỗi block một dòng', () => {
        expect(measure('đoạn một\nđoạn hai', 'word')).toBe(4);
    });

    it('space đầu/cuối không sinh ra từ ma', () => {
        expect(measure('  bài làm  ', 'word')).toBe(2);
    });
});

describe('measure — đếm ký tự', () => {
    it('đếm THÔ: space cuối PHẢI tính, nếu không gõ space được vô hạn ở mốc 20/20', () => {
        expect(measure('abc ', 'char')).toBe(4);
    });

    it('NFC: "ệ" gõ trên macOS là 3 code point rời, phải đếm là 1', () => {
        const nfd = 'ệ'.normalize('NFD');   // e + dấu mũ + dấu nặng
        expect(nfd.length).toBeGreaterThan(1);
        expect(measure(nfd.normalize('NFC'), 'char')).toBe(1);
    });
});
