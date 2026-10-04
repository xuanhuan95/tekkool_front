import {describe, it, expect} from 'vitest';
import {convertData, type QuestionData} from './convertData';

// Test cũ chép lại convertData sang file test vì ImportExam là JSX. Giờ hàm
// nằm ở module riêng nên import thẳng — hai bản không thể lệch nhau nữa.

const MC: QuestionData = {
    question: '<p>Bài thơ nói về mùa nào?</p>',
    answers: [{id: 'a1', value: 'Xuân'}, {id: 'a2', value: 'Hạ'}],
    correctAnswerId: 'a1',
    passage: '<p>Mùa xuân về.</p>',
    passageId: 'E1_0_G1',
};

describe('convertData: giữ dữ liệu dùng chung', () => {
    it.each(['FreeAnswer', 'TrueFalse', 'FillBlank', 'ErrorIdentify'])(
        'đổi sang %s không được làm mất ngữ liệu của cả nhóm', (to) => {
            const r = convertData(MC, to);
            expect(r.passage).toBe(MC.passage);
            expect(r.passageId).toBe(MC.passageId);
            expect(r.question).toBe(MC.question);
        });

    it('câu không có ngữ liệu thì không đẻ ra passageId rỗng', () => {
        const r = convertData({question: 'x'}, 'FreeAnswer');
        expect('passage' in r).toBe(false);
        expect('passageId' in r).toBe(false);
    });
});

describe('convertData: bỏ dữ liệu riêng của loại cũ', () => {
    it('trắc nghiệm -> tự luận: bỏ phương án, không để rác trong DB', () => {
        const r = convertData(MC, 'FreeAnswer');
        expect(r.answers).toBeUndefined();
        expect(r.correctAnswerId).toBeUndefined();
    });

    // data.answer nghĩa KHÁC NHAU từng loại — mang nguyên sang là chấm sai điểm.
    it('TrueFalse không được ăn phải answer kiểu chuỗi của FillBlank', () => {
        const r = convertData({question: 'x', answer: '<p>chuỗi</p>'}, 'TrueFalse');
        expect(r.answer).toBeUndefined();
    });

    it('FillBlank không được ăn phải answer kiểu boolean của TrueFalse', () => {
        const r = convertData({question: 'x', answer: true}, 'FillBlank');
        expect(r.answer).toBeUndefined();
    });

    it('TrueFalse phải để TRỐNG đáp án — đặt sẵn true/false là gán bừa', () => {
        const r = convertData({question: 'x', answer: '<p>x</p>'}, 'TrueFalse');
        expect('answer' in r).toBe(false);
    });

    it('trắc nghiệm không giữ giới hạn từ', () => {
        expect(convertData({question: 'x', max_words: 600}, 'MultipleChoice').max_words)
            .toBeUndefined();
    });
});

describe('convertData: dựng đủ field cho loại mới', () => {
    it('tự luận giữ giới hạn từ', () => {
        expect(convertData({question: 'Viết bài văn', max_words: 600}, 'FreeAnswer').max_words)
            .toBe(600);
    });

    it('tự luận -> trắc nghiệm: answers là mảng rỗng để Answers() map được, không vỡ', () => {
        const r = convertData({question: 'Viết đoạn văn'}, 'MultipleChoice');
        expect(Array.isArray(r.answers)).toBe(true);
        expect(r.answers).toHaveLength(0);
        expect(r.correctAnswerId).toBeUndefined();
    });

    it('ErrorIdentify dùng chung UI phương án với trắc nghiệm', () => {
        expect(convertData(MC, 'ErrorIdentify').answers).toHaveLength(2);
    });

    it('không sửa object gốc — màn import giữ bản cũ để hoàn tác', () => {
        const goc = {...MC};
        convertData(MC, 'FreeAnswer');
        expect(MC).toEqual(goc);
    });
});
