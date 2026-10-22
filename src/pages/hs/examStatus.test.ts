import {describe, it, expect} from 'vitest';

import {durationLabel, examStatus, filterExams, partCount, partsFromStructure, structureRows} from './examStatus';
import type {ExamSummary} from '../../types/exam';

const e = (id: string, extra: Partial<ExamSummary> = {}): ExamSummary => ({id, name: id, duration: 90, attempts: 0, ...extra});
const cont = {exam_id: 'b', exam_name: 'b', remaining_sec: 2280, answered: 10, total: 23};

describe('examStatus', () => {
    it('in progress wins', () => {
        expect(examStatus(e('b', {attempts: 2}), cont)).toMatchObject({kind: 'inProgress', label: 'Đang làm dở · còn 38 phút'});
    });
    it('todo / done with last score or pending', () => {
        expect(examStatus(e('a')).label).toBe('Chưa làm');
        expect(examStatus(e('a', {attempts: 2, last_score: 7.75, last_max: 10})).label).toBe('Đã làm 2 lần · gần nhất 7,75');
        expect(examStatus(e('a', {attempts: 1, last_score: 3, last_max: 10, last_status: 'GRADING'})).label)
            .toBe('Đã làm 1 lần · gần nhất chờ chấm');
    });
    it('filters', () => {
        const list = [e('a'), e('b'), e('c', {attempts: 1})];
        expect(filterExams(list, 'todo', cont).map(x => x.id)).toEqual(['a', 'b']);
        expect(filterExams(list, 'done', cont).map(x => x.id)).toEqual(['c']);
        expect(filterExams(list, 'all').length).toBe(3);
    });
    it('duration and parts', () => {
        expect(durationLabel(60)).toBe('60 phút');
        expect(durationLabel(0)).toBe('Không giới hạn thời gian');
        expect(partCount({sections: [1, 2, 3, 4]})).toBe(4);
        expect(partCount({sections: [], cau_truc: [{}, {}]})).toBe(2);
    });
});

describe('SPT-60: best score and exam structure', () => {
    it('card label uses the BEST attempt when BE sends it', () => {
        expect(examStatus({id: 'x', name: 'x', attempts: 3, last_score: 5, last_max: 10, best_score: 7.75, best_max: 10}).label)
            .toBe('Đã làm 3 lần · cao nhất 7,75');
    });

    it('structure rows: count + points, total line; bank exam → "khoảng", no total', () => {
        const fixed = structureRows([
            {name: 'Phần I', type: 'mcq', count: 12, points_total: 3},
            {name: 'Phần II', type: 'tf', count: 4, points_total: 4},
            {name: 'Phần IV', type: 'essay', count: 1, points_total: 1.5},
        ]);
        expect(fixed.rows[0]).toEqual({name: 'Phần I', kind: 'Trắc nghiệm', amount: '12 câu · 3đ'});
        expect(fixed.rows[2].amount).toBe('1 câu · 1,5đ');
        expect(fixed.total).toBe('Tổng 17 câu · 8,5 điểm.');

        const bank = structureRows([{name: null, type: 'mcq', count: 2, points_total: null, approx: true}]);
        expect(bank.rows[0]).toEqual({name: '', kind: 'Trắc nghiệm', amount: 'khoảng 2 câu'});
        expect(bank.total).toBeNull();
        expect(structureRows(undefined)).toEqual({rows: [], total: null});
    });

    it('part count from structure: distinct part names', () => {
        expect(partsFromStructure([
            {name: 'Phần I', type: 'mcq', count: 1, points_total: 1},
            {name: 'Phần I', type: 'short', count: 1, points_total: 1},
            {name: 'Phần II', type: 'tf', count: 1, points_total: 1},
        ])).toBe(2);
        expect(partsFromStructure(undefined)).toBe(0);
    });
});
