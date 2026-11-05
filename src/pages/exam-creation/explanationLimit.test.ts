import {describe, expect, it} from 'vitest';
import {EXPLANATION_MAX, explanationTooLong} from './examRules';

const exam = (explanation: string) => [{questions: [{data: {explanation}}]}] as never;

describe('explanationTooLong (SPT-115: Lưu bị chặn khi lời giải quá 5.000 ký tự)', () => {
    it('đúng 5.000 ký tự chữ: cho lưu', () => expect(explanationTooLong(exam('<p>' + 'a'.repeat(EXPLANATION_MAX) + '</p>'))).toBe(false));
    it('5.001 ký tự chữ: chặn, thẻ HTML không tính', () => expect(explanationTooLong(exam('<p><b>' + 'a'.repeat(EXPLANATION_MAX + 1) + '</b></p>'))).toBe(true));
    it('chỉ cần một câu quá dài là chặn cả đề', () => {
        const sections = [{questions: [{data: {explanation: 'ngắn'}}, {data: {explanation: 'a'.repeat(EXPLANATION_MAX + 1)}}]}] as never;
        expect(explanationTooLong(sections)).toBe(true);
    });
    it('câu chưa có lời giải: không chặn', () => expect(explanationTooLong([{questions: [{data: {}}]}] as never)).toBe(false));
});
