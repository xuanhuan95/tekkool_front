import {describe, expect, it} from 'vitest';

import {stripQuestionLabel, stripStatementLabel} from './stripLabel';

describe('stripQuestionLabel', () => {
    it.each([
        ['Câu 1. Cho hàm số f', 'Cho hàm số f'],
        ['<p>Câu 12: Cho hàm số f</p>', '<p>Cho hàm số f</p>'],
        ['<p><b>Câu 3)</b> Tính tích phân</p>', '<p><b></b>Tính tích phân</p>'],
        ['<p>&nbsp;câu 4 . Tìm x</p>', '<p>Tìm x</p>'],
        ['<div><p><strong>Câu 5.</strong>&nbsp;Xét</p></div>', '<div><p><strong></strong>Xét</p></div>'],
    ])('strips the import label: %s', (input, out) => {
        expect(stripQuestionLabel(input)).toBe(out);
    });

    it.each([
        'Câu 1 có hai đáp án đúng',                 // no closing mark → normal sentence
        'Câu hỏi sau đây. Câu 1. lặp lại',          // label not at the start
        '<p>Cho hàm số. Câu 2. Tính</p>',
        '<p>Đề có 23 câu.</p>',
        '<img src="x.png"><p>Câu 1. Hình bên</p>',  // image first → not the start of text
        '<span data-latex="Câu 1."></span> x',      // a formula is content, never stripped
        'Câu 1.',                                   // would leave nothing → keep
        '',
    ])('leaves normal content untouched: %s', input => {
        expect(stripQuestionLabel(input)).toBe(input);
    });

    it('null/undefined → empty string', () => {
        expect(stripQuestionLabel(null)).toBe('');
        expect(stripQuestionLabel(undefined)).toBe('');
    });

    it('only strips once (second label in the text stays)', () => {
        expect(stripQuestionLabel('Câu 1. Câu 2. x')).toBe('Câu 2. x');
    });
});

describe('stripStatementLabel', () => {
    it.each([
        ['a) f(1) = 0', 'a', 'f(1) = 0'],
        ['<p>b) Hàm số đồng biến</p>', 'b', '<p>Hàm số đồng biến</p>'],
        ['<p>C. Giá trị cực tiểu</p>', 'c', '<p>Giá trị cực tiểu</p>'],
        ['<p><b>d)</b>&nbsp;Đồ thị</p>', 'd', '<p><b></b>Đồ thị</p>'],
    ])('strips its own letter: %s', (input, key, out) => {
        expect(stripStatementLabel(input, key)).toBe(out);
    });

    it.each([
        ['b) không phải ý a', 'a'],              // other statement's letter
        ['a là số thực dương', 'a'],             // no ) or .
        ['ab) x', 'a'],
        ['<p>Cho a) b) c)</p>', 'b'],
        ['a)', 'a'],                             // would leave nothing
        ['<span data-latex="a)"></span> = 1', 'a'],
    ])('leaves normal content untouched: %s', (input, key) => {
        expect(stripStatementLabel(input, key)).toBe(input);
    });
});
