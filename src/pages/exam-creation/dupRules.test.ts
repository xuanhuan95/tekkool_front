import {describe, expect, it} from 'vitest';

import {bankDuplicates, blocksOf, importDuplicates, withoutBlocks} from './dupRules';
import type {ImportQuestion, ImportedExam} from './importRules';

const q = (id: string, over: Partial<ImportQuestion['data']> = {}): ImportQuestion =>
    ({id, type: 'MultipleChoice', data: {question: `<p>${id}</p>`, ...over}});
const exam = (id: string, ...sections: ImportQuestion[][]): ImportedExam =>
    ({id, name: id, sections: sections.map((questions, i) => ({id: id + '_S' + i, name: 'Phần ' + i, questions}))});

describe('dupRules', () => {
    it('a passage with its questions is ONE block; single questions are one each', () => {
        const e = exam('E', [q('a', {passageId: 'P', passage: 'Văn bản'}), q('b', {passageId: 'P', passage: 'Văn bản'}), q('c')]);
        expect(blocksOf(e).map(b => b.questions.length)).toEqual([2, 1]);
    });

    it('bank duplicate = score ≥ 0.95 against something that is not this file; lower scores are not blocks', () => {
        const e = exam('E', [q('a'), q('b'), q('c')]);
        const dups = bankDuplicates(e, {
            a: {score: 0.97, matches: [{block: 'Đề số 12', score: 0.97}]},
            b: {score: 0.9, matches: [{block: 'Đề số 3', score: 0.9}]},
            c: {score: 1, matches: [{in_file: true, score: 1}]},
        });
        expect(dups).toMatchObject([{exam: 'E', block: 'a', score: 0.97, with: 'Đề số 12'}]);
    });

    it('the same block in two exams read together: the later exam holds the duplicate', () => {
        const a = exam('A', [q('x', {question: '<p>Cùng   câu</p>'}), q('y')]);
        const b = exam('B', [q('z', {question: '<p>cùng câu</p>'}), q('w')]);
        expect(importDuplicates([a, b])).toEqual([{exam: 'B', block: 'z', score: 1, inImport: 'A'}]);
    });

    it('withoutBlocks drops the blocks, empty sections, and null when nothing is left', () => {
        const e = exam('E', [q('a')], [q('b'), q('c')]);
        expect(withoutBlocks(e, new Set(['a']))!.sections.map(s => s.questions.map(x => x.id))).toEqual([['b', 'c']]);
        expect(withoutBlocks(e, new Set(['a', 'b', 'c']))).toBeNull();
        expect(withoutBlocks(e, new Set())).toBe(e);
    });
});
