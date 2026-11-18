import {describe, expect, it} from 'vitest';

import {emptyLayout, fill, frameProblem, insertNumbers, needs, newItem, numbering, shift, shortages, toPayload, type Layout} from './layoutRules';

const item = (block_type: string, count = 1, title = '') => ({title, block_type, count});
// Văn: Phần I = 2 khối Đọc hiểu (10 câu), Phần II (restart) = 1 đoạn văn, Phần III = 1 bài văn (continue).
const VAN: Layout = [
    {title: 'A.', parts: [{title: 'Phần I', lead: 'từ câu {from} đến câu {to}', numbering: 'continue', score: 3, items: [item('reading', 1), item('reading', 1)]}]},
    {title: 'B.', parts: [
        {title: 'Phần II', lead: '', numbering: 'restart', items: [item('paragraph')]},
        {title: 'Phần III', lead: '', numbering: 'continue', items: [item('essay')]},
    ]},
];

describe('layout numbering (C1)', () => {
    it('counts a reading block as 5 questions and ranges follow the items', () => {
        const n = numbering(VAN);
        expect(n.items[0][0]).toEqual([{from: 1, to: 5}, {from: 6, to: 10}]);
        expect(n.parts[0][0]).toEqual({from: 1, to: 10});
    });

    it('"restart" begins again at 1, "continue" keeps counting', () => {
        const n = numbering(VAN);
        expect(n.items[1][0][0]).toEqual({from: 1, to: 1});   // Phần II restarts
        expect(n.items[1][1][0]).toEqual({from: 2, to: 2});   // Phần III continues after it
    });

    it('adding a tiểu mục moves the lead of its Phần to "đến câu 15"', () => {
        const more = structuredClone(VAN);
        more[0].parts[0].items.push(item('reading'));
        const range = numbering(more).parts[0][0];
        expect(fill(more[0].parts[0].lead, range)).toBe('từ câu 1 đến câu 15');
    });

    it('a tiểu mục with 0 blocks has no range and shows ? until it has one', () => {
        const l: Layout = [{title: '', parts: [{title: '', lead: '', numbering: 'continue', items: [item('reading', 0)]}]}];
        expect(numbering(l).items[0][0][0]).toBeNull();
        expect(fill('{from}–{to}', null)).toBe('?–?');
    });
});

describe('layout helpers', () => {
    it('needs / shortages: asks the stock per block type', () => {
        expect(needs(VAN)).toEqual({reading: 2, paragraph: 1, essay: 1});
        expect(shortages(VAN, {reading: 1, paragraph: 5, essay: 0})).toEqual([
            {type: 'reading', need: 2, have: 1}, {type: 'essay', need: 1, have: 0}]);
        expect(shortages(VAN, {reading: 9, paragraph: 9, essay: 9})).toEqual([]);
    });

    it('insertNumbers turns the typed "từ câu … đến câu …" into tokens', () => {
        expect(insertNumbers('Thí sinh trả lời từ câu … đến câu …')).toBe('Thí sinh trả lời từ câu {from} đến câu {to}');
        expect(insertNumbers('từ 1 đến 5')).toBe('từ {from} đến {to}');
        expect(insertNumbers('không có số')).toBe('không có số');
    });

    it('frameProblem says the reason, name first and type together', () => {
        const empty = emptyLayout();
        expect(frameProblem(empty, '')).toBe('Chưa đặt tên đề và chưa chọn dạng khối.');
        expect(frameProblem(empty, 'Đề')).toBe('Chưa chọn dạng khối cho mọi tiểu mục.');
        expect(frameProblem(VAN, ' ')).toBe('Chưa đặt tên đề.');
        expect(frameProblem(VAN, 'Đề')).toBeNull();
        const zero = structuredClone(VAN);
        zero[0].parts[0].items[0].count = 0;
        expect(frameProblem(zero, 'Đề')).toBe('Số khối của mỗi tiểu mục phải từ 1 trở lên.');
    });

    it('toPayload trims text and drops an empty score', () => {
        const l: Layout = [{title: ' A ', parts: [{title: ' P ', lead: ' x ', numbering: 'continue', score: null, items: [{...newItem(), title: ' t ', block_type: 'essay'}]}]}];
        expect(toPayload(l)).toEqual([{title: 'A', parts: [{title: 'P', lead: 'x', numbering: 'continue', items: [{title: 't', block_type: 'essay', count: 1}]}]}]);
    });

    it('shift moves one step and stays put at the ends', () => {
        expect(shift([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
        expect(shift([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
        expect(shift([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    });
});
