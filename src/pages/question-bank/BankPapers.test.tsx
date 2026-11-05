import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, waitFor} from '@testing-library/react';

import BankPapers from './BankPapers';
import {signature} from './PaperStructure';
import {mockApi, renderAt} from '../manage/testutil';

afterEach(() => vi.restoreAllMocks());

const bank = {id: 'P1', name: 'Đề SPT Hoá', subject: 'Hoá học', kind: 'paper' as const, items: 2, blocks: 0};
const mc = (id: string) => ({id, type: 'MultipleChoice', data: {question: '<p>Chất điện li mạnh?</p>', max_score: 0.25, correctAnswerId: 'b',
    answers: [{id: 'a', value: 'CH3COOH'}, {id: 'b', value: 'NaCl'}]}});
const paper = {id: 'e1', name: 'Đề 01', bank: 'P1', duration: 50, shared_info: ['<p>H = 1; C = 12</p>'],
    sections: [{id: 's1', name: 'Phần I', questions: [mc('q1'), mc('q2')]}]};
const row = (id: string, name: string) => ({id, name, part_count: 1, question_count: 2, total_score: 0.5, created_at: ''});
const gets = {
    'question_bank/papers': {items: [row('e1', 'Đề 01'), row('e2', 'Đề 02')], total: 2, page: 1, per_page: 20},
    'question_bank/paper': paper,
};

describe('BankPapers (Nguyên đề)', () => {
    it('lists exams with the standard structure; opens one: Cho biết shown, key tinted without "Đáp án đúng"', async () => {
        mockApi(gets);
        renderAt(<BankPapers bank={bank}/>);
        expect(await screen.findByText('Đề 02')).toBeTruthy();
        expect(await screen.findByText('Cấu trúc chuẩn')).toBeTruthy();
        expect(await screen.findByText(/I · TN 2 câu × 0,25/)).toBeTruthy();
        fireEvent.click(screen.getAllByRole('button', {name: 'Xem'})[0]);
        expect(await screen.findByText('H = 1; C = 12')).toBeTruthy();
        expect(screen.getAllByText('NaCl').length).toBe(2);
        expect(screen.queryByText('Đáp án đúng')).toBeNull();
    });

    it('several shared_info items sit under ONE "Cho biết" label, the real <b>Cho biết</b>: prefix is stripped', async () => {
        mockApi({...gets, 'question_bank/paper': {...paper, shared_info: ['<p><b>Cho biết</b>: Nguyên tử khối: H = 1</p>', '<p>Bảng A</p>', '<p>Bảng B</p>']}});
        renderAt(<BankPapers bank={bank}/>);
        fireEvent.click((await screen.findAllByRole('button', {name: 'Xem'}))[0]);
        expect(await screen.findByText('Nguyên tử khối: H = 1')).toBeTruthy();
        expect(screen.getAllByText('Cho biết').length).toBe(1);
        expect(screen.getByText('Bảng B')).toBeTruthy();
    });

    it('empty bank: Chưa có đề nào + Nhập đề, no standard card', async () => {
        mockApi({'question_bank/papers': {items: [], total: 0, page: 1, per_page: 20}});
        renderAt(<BankPapers bank={{...bank, items: 0}}/>);
        expect(await screen.findByText('Chưa có đề nào')).toBeTruthy();
        expect(screen.queryByText('Cấu trúc chuẩn')).toBeNull();
    });

    it('delete: confirm names the exam, posts the id; a 409 shows the BE message and keeps the list', async () => {
        const api = mockApi(gets, {'question_bank/delete_paper': () => new Error('Ngân hàng hết đề để rút')});
        renderAt(<BankPapers bank={bank}/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Xoá Đề 02'}));
        expect(await screen.findByText('Xoá “Đề 02”?')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: 'Xoá đề'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('question_bank/delete_paper', {id: 'e2'}));
        await waitFor(() => expect(screen.queryByText('Xoá “Đề 02”?')).toBeNull());
        expect(screen.getByText('Đề 02')).toBeTruthy();
    });
});

describe('signature', () => {
    it('counts units and score each per Phần', () => {
        expect(signature(paper.sections as never)).toEqual([{part: 'I', kind: 'Trắc nghiệm', count: 2, each: 0.25}]);
    });
});
