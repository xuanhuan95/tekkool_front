import {describe, expect, it} from 'vitest';

import {addPartAfter, capacity, emptyLayout, fill, frameProblem, needs, numberize, numbering, overflow, removePart, setCount, shift, shortages, tidy, toPayload, type Layout} from './layoutRules';

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

    it('a Phần with no block has an empty range, shown as "…"', () => {
        const l: Layout = [{title: '', parts: [{title: 'Phần I', lead: '', numbering: 'continue', items: []}]}];
        expect(numbering(l).parts[0][0]).toEqual({from: 1, to: 0});
        expect(fill('từ câu {from} đến câu {to}', {from: 1, to: 0})).toBe('từ câu 1 đến câu …');
    });

    it('{n} is the position of the ô', () => {
        expect(fill('I.{n}. Đọc văn bản {n}', {from: 6, to: 10}, 2)).toBe('I.2. Đọc văn bản 2');
    });
});

describe('layout helpers', () => {
    it('needs / shortages: asks the stock per block type', () => {
        expect(needs(VAN)).toEqual({reading: 2, paragraph: 1, essay: 1});
        expect(shortages(VAN, {reading: 1, paragraph: 5, essay: 0})).toEqual([
            {type: 'reading', need: 2, have: 1}, {type: 'essay', need: 1, have: 0}]);
        expect(shortages(VAN, {reading: 9, paragraph: 9, essay: 9})).toEqual([]);
    });

    it('frameProblem says the reason, name first', () => {
        expect(frameProblem(emptyLayout(), '')).toBe('Chưa đặt tên đề.');
        expect(frameProblem(emptyLayout(), 'Đề')).toBe('Thêm ít nhất một đoạn hoặc câu để tạo đề.');
        expect(frameProblem(VAN, ' ')).toBe('Chưa đặt tên đề.');
        expect(frameProblem(VAN, 'Đề')).toBeNull();
        expect(frameProblem(addPartAfter(VAN, 0, 0), 'Đề')).toBe('Có phần chưa có đoạn hoặc câu nào.');
    });

    it('tidy puts a space between a number and the letter typed right after it', () => {
        expect(tidy('đến câu {to}Mỗi câu')).toBe('đến câu {to} Mỗi câu');
        expect(tidy('câu {from}–{to}')).toBe('câu {from}–{to}');
    });

    it('numberize turns the ordinal of a copied title into {n}', () => {
        expect(numberize('I.2. Đọc văn bản 2', 2)).toBe('I.{n}. Đọc văn bản {n}');
        expect(numberize('Câu 10', 2)).toBe('Câu 10');
        expect(numberize('I.{n}', 3)).toBe('I.{n}');
    });

    it('toPayload trims text, writes {n} as the position of the ô and drops an empty score', () => {
        const l: Layout = [{title: ' A ', parts: [{title: ' P ', lead: ' x ', numbering: 'continue', score: null,
            items: [item('reading', 1, ' I.{n} '), item('reading', 1, ' I.{n} ')]}]}];
        expect(toPayload(l)).toEqual([{title: 'A', parts: [{title: 'P', lead: 'x', numbering: 'continue',
            items: [{title: 'I.1', block_type: 'reading', count: 1}, {title: 'I.2', block_type: 'reading', count: 1}]}]}]);
    });

    it('shift moves one step and stays put at the ends', () => {
        expect(shift([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
        expect(shift([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
        expect(shift([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    });
});

describe('blocks of a Phần (the "+" in the box)', () => {
    const titled: Layout = [{title: '', parts: [{title: 'Phần I', lead: 'từ câu {from} đến câu {to}', numbering: 'continue', score: 3,
        items: [item('reading', 1, 'I.{n}'), item('reading', 1, 'I.{n}')]}]}];

    it('2 → 3 đoạn: a copy is added, Phần I ends at câu 15 and each question is worth 0,2', () => {
        const l = setCount(titled, 0, 0, 1, 3);
        expect(l[0].parts[0].items).toHaveLength(3);
        const r = numbering(l);
        expect(r.items[0][0][2]).toEqual({from: 11, to: 15});
        expect(fill(l[0].parts[0].lead, r.parts[0][0])).toBe('từ câu 1 đến câu 15');
        const q = r.parts[0][0].to - r.parts[0][0].from + 1;
        expect(3 / q).toBeCloseTo(0.2);
    });

    it('an untitled ô gets a bigger count instead of a copy', () => {
        const l = setCount([{title: '', parts: [{title: 'P', lead: '', numbering: 'continue', items: [item('paragraph', 2)]}]}], 0, 0, 0, 5);
        expect(l[0].parts[0].items).toEqual([item('paragraph', 5)]);
    });

    it('fewer takes from the end and never goes below 1', () => {
        expect(setCount(titled, 0, 0, 0, 1)[0].parts[0].items).toHaveLength(1);
        expect(setCount(titled, 0, 0, 0, 0)[0].parts[0].items).toHaveLength(1);
    });

    it('removePart drops the group when it was its only Phần', () => {
        expect(removePart(VAN, 1, 0)[1].parts).toHaveLength(1);
        expect(removePart(removePart(VAN, 1, 0), 1, 0)).toHaveLength(1);
    });

    it('overflow flags the ô the bank cannot fill; capacity is the scarcest type', () => {
        expect(overflow(titled, {reading: 1})).toEqual([{g: 0, p: 0, i: 1, type: 'reading', tag: 'I.2'}]);
        expect(overflow(titled, {reading: 2})).toEqual([]);
        expect(capacity(titled, {reading: 40})).toBe(20);
        expect(capacity(setCount(titled, 0, 0, 1, 3), {reading: 40})).toBe(13);
        expect(capacity(emptyLayout(), {reading: 40})).toBeNull();
    });
});
