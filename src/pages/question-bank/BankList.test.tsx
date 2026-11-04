import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, waitFor} from '@testing-library/react';

import BankList, {defaultBankName} from './BankList';
import {mockApi, renderAt} from '../manage/testutil';

afterEach(() => vi.restoreAllMocks());

const banks = [
    {id: 'b1', name: 'Ngữ văn 12 — HK1', subject: 'Ngữ văn', blocks: 7},
    {id: 'b2', name: 'Toán rỗng', subject: 'Toán', blocks: 0},
];

describe('BankList (GV-NganHang)', () => {
    it('card has only Nhập đề / Xem nội dung / Xoá; empty bank says 0 khối; no note', async () => {
        mockApi({'question_bank/list': banks, 'question_bank/subjects': ['Toán']});
        renderAt(<BankList/>);
        await screen.findByText('Toán rỗng');
        expect(screen.getAllByText('Nhập đề').length).toBe(2);
        expect(screen.getAllByText('Xem nội dung').length).toBe(1);
        expect(screen.queryByText('Tạo đề')).toBeNull();
        expect(screen.queryByText('Làm thử')).toBeNull();
        expect(screen.queryByText(/sửa file Word/)).toBeNull();
        expect(screen.getByText('0')).toBeTruthy();
        expect(screen.getAllByText('khối câu hỏi', {exact: false}).length).toBe(2);
    });

    it('defaultBankName: subject, then "subject 2" when taken', () => {
        expect(defaultBankName('Hoá học', [])).toBe('Hoá học');
        expect(defaultBankName('Hoá học', ['Hoá học'])).toBe('Hoá học 2');
        expect(defaultBankName('Hoá học', ['Hoá học', 'Hoá học 2'])).toBe('Hoá học 3');
    });

    it('delete asks in a modal (no window.confirm) and posts the id', async () => {
        const api = mockApi({'question_bank/list': banks, 'question_bank/subjects': []}, {'question_bank/remove': {}});
        const confirm = vi.spyOn(window, 'confirm');
        renderAt(<BankList/>);
        await screen.findByText('Toán rỗng');
        fireEvent.click(screen.getByRole('button', {name: 'Xoá ngân hàng Ngữ văn 12 — HK1'}));
        expect(await screen.findByText('7 khối bên trong mất theo, không lấy lại được.')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: 'Xoá ngân hàng'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('question_bank/remove', {id: 'b1'}));
        expect(confirm).not.toHaveBeenCalled();
    });

    it('create: subject is required; blank name falls back to the subject name (numbered if taken)', async () => {
        const api = mockApi({'question_bank/list': [{id: 'b', name: 'Toán', subject: 'Toán', blocks: 1}],
            'question_bank/subjects': ['Toán', 'Ngữ văn']}, {'question_bank/create': {id: 'n'}});
        renderAt(<BankList/>);
        fireEvent.click((await screen.findAllByRole('button', {name: '+ Ngân hàng mới'}))[0]);
        fireEvent.click(await screen.findByRole('button', {name: 'Tạo ngân hàng'}));
        expect(await screen.findByText('Chưa chọn môn')).toBeTruthy();
        expect(api.post).not.toHaveBeenCalled();
        await screen.findByRole('option', {name: 'Toán'});
        fireEvent.change(screen.getByLabelText('Môn'), {target: {value: 'Toán'}});
        fireEvent.click(screen.getByRole('button', {name: 'Tạo ngân hàng'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('question_bank/create', {name: 'Toán 2', subject: 'Toán'}));
    });

    it('load error shows Thử lại', async () => {
        mockApi({});
        renderAt(<BankList/>);
        expect(await screen.findByText('Không tải được danh sách ngân hàng.')).toBeTruthy();
    });
});
