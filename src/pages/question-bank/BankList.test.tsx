import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, waitFor} from '@testing-library/react';

import BankList from './BankList';
import {mockApi, renderAt} from '../manage/testutil';

afterEach(() => vi.restoreAllMocks());

const banks = [
    {id: 'b1', name: 'Ngữ văn 12 — HK1', subject: 'Ngữ văn', blocks: 7},
    {id: 'b2', name: 'Toán rỗng', subject: 'Toán', blocks: 0},
];

describe('BankList (GV-NganHang)', () => {
    it('empty bank: yellow box, Tạo đề locked, no Làm thử', async () => {
        mockApi({'question_bank/list': banks, 'question_bank/subjects': ['Toán']});
        renderAt(<BankList/>);
        await screen.findByText('Toán rỗng');
        expect(screen.getByText('Chưa có khối nào — bấm Nhập đề để thêm.')).toBeTruthy();
        expect(screen.getAllByText('Làm thử').length).toBe(1);
        expect((screen.getAllByRole('button', {name: 'Tạo đề'})[0] as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('khối câu hỏi', {exact: false})).toBeTruthy();
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

    it('create: subject is required, then posts name + subject', async () => {
        const api = mockApi({'question_bank/list': [], 'question_bank/subjects': ['Toán', 'Ngữ văn']}, {'question_bank/create': {id: 'n'}});
        renderAt(<BankList/>);
        fireEvent.click((await screen.findAllByRole('button', {name: '+ Ngân hàng mới'}))[0]);
        fireEvent.change(await screen.findByLabelText('Tên ngân hàng'), {target: {value: 'Toán 12'}});
        fireEvent.click(screen.getByRole('button', {name: 'Tạo ngân hàng'}));
        expect(await screen.findByText('Chưa chọn môn')).toBeTruthy();
        expect(api.post).not.toHaveBeenCalled();
        await screen.findByRole('option', {name: 'Toán'});
        fireEvent.change(screen.getByLabelText('Môn'), {target: {value: 'Toán'}});
        fireEvent.click(screen.getByRole('button', {name: 'Tạo ngân hàng'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('question_bank/create', {name: 'Toán 12', subject: 'Toán'}));
    });

    it('load error shows Thử lại', async () => {
        mockApi({});
        renderAt(<BankList/>);
        expect(await screen.findByText('Không tải được danh sách ngân hàng.')).toBeTruthy();
    });
});
