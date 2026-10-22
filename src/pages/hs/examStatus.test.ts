import {describe, it, expect} from 'vitest';

import {durationLabel, examStatus, filterExams, partCount} from './examStatus';
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
