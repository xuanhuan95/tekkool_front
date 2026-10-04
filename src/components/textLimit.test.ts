import {describe, it, expect} from 'vitest';
import {measure, trimToFit} from './textLimit';

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

describe('trimToFit — cắt phần dán cho vừa hạn mức', () => {
    it('vừa khít thì giữ nguyên', () => {
        expect(trimToFit('', 'một hai ba', 3, 'word')).toBe('một hai ba');
    });

    it('đếm từ: không cắt giữa chữ ("student" không được thành "stud")', () => {
        const out = trimToFit('', 'I am a student today', 4, 'word');
        expect(out).toBe('I am a student');
    });

    it('cắt xong KHÔNG để lại space cuối — space lọt qua trim sẽ chặn oan chữ kế', () => {
        const out = trimToFit('', 'một hai ba bốn', 3, 'word');
        expect(out).toBe('một hai ba');
        expect(out.endsWith(' ')).toBe(false);
    });

    it('cộng dồn với phần đã có: dán vào cuối bài gần đầy', () => {
        // head = 3 từ, max 5 -> chỉ còn chỗ cho 2 từ nữa.
        expect(measure('một hai ba' + trimToFit('một hai ba', ' bốn năm sáu', 5, 'word'), 'word'))
            .toBeLessThanOrEqual(5);
    });

    it('đã đầy thì trả chuỗi rỗng, không trả một phần chữ', () => {
        expect(trimToFit('một hai ba', ' bốn', 3, 'word')).toBe('');
    });

    it('đếm ký tự: cắt đúng số ký tự, được phép cắt giữa chữ', () => {
        expect(trimToFit('', 'abcdefgh', 5, 'char')).toBe('abcde');
    });

    it('đếm ký tự có head: chỉ còn chỗ cho phần thiếu', () => {
        expect(trimToFit('abc', 'defgh', 5, 'char')).toBe('de');
    });

    it('dán văn bản tiếng Việt dài vào ô 10 từ', () => {
        const paste = 'Hôm nay trời rất đẹp và tôi đi học rất sớm nữa';
        const out = trimToFit('', paste, 10, 'word');
        expect(measure(out, 'word')).toBe(10);
        expect(paste.startsWith(out)).toBe(true);
    });
});
