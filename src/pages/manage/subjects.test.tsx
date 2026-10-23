import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';

import AdminSubjects, {validateSubjectName} from './AdminSubjects';
import {mockApi, renderAt} from './testutil';
import {ADMIN_NAV} from '../../components/ui';

afterEach(() => vi.restoreAllMocks());

const S = (over: object = {}) => ({id: 's1', name: 'Toán', hidden: false, exams: 4, done: 0, last: null, ...over});

describe('AdminSubjects', () => {
    it('validates the name', () => {
        expect(validateSubjectName('  ')).toBeTruthy();
        expect(validateSubjectName('x'.repeat(101))).toBeTruthy();
        expect(validateSubjectName(' Vật lí ')).toBeUndefined();
    });

    it('is in the admin menu', () => {
        expect(ADMIN_NAV.some(n => n.to === '/manage/subjects' && n.label === 'Môn học')).toBe(true);
    });

    it('lists subjects with exam count and visibility', async () => {
        mockApi({'folder/subjects': [S(), S({id: 's2', name: 'Sử', hidden: true, exams: 0})]});
        renderAt(<AdminSubjects/>);
        const toan = (await screen.findByText('Toán')).closest('tr')!;
        expect(within(toan).getByText('4')).toBeTruthy();
        expect(within(toan).getByText('Đang hiện')).toBeTruthy();
        expect(within(screen.getByText('Sử').closest('tr')!).getByText('Đang ẩn')).toBeTruthy();
    });

    it('creates a subject; empty name is blocked and server errors are shown', async () => {
        const post = vi.fn((_path: string, body: any) => body.name === 'Trùng' ? new Error('Môn đã tồn tại') : {id: 'n', name: body.name});
        mockApi({'folder/subjects': [S()]}, {'folder/create': post});
        renderAt(<AdminSubjects/>);
        await screen.findByText('Toán');
        fireEvent.click(screen.getAllByRole('button', {name: '+ Môn mới'})[0]);
        fireEvent.click(screen.getByRole('button', {name: 'Tạo môn'}));
        expect(await screen.findByText(/Tên môn không được trống/)).toBeTruthy();
        expect(post).not.toHaveBeenCalled();
        const input = screen.getByLabelText('Tên môn');
        fireEvent.change(input, {target: {value: 'Trùng'}});
        fireEvent.click(screen.getByRole('button', {name: 'Tạo môn'}));
        expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Môn đã tồn tại');
        fireEvent.change(input, {target: {value: 'Vật lí'}});
        fireEvent.click(screen.getByRole('button', {name: 'Tạo môn'}));
        await waitFor(() => expect(post).toHaveBeenLastCalledWith('folder/create', {name: 'Vật lí'}));
        expect(post.mock.calls.every(c => !('parent' in c[1]))).toBe(true);
    });

    it('renames a subject', async () => {
        const post = vi.fn((_p: string, b: any) => ({id: b.id, name: b.name, hidden: false}));
        mockApi({'folder/subjects': [S()]}, {'folder/update': post});
        renderAt(<AdminSubjects/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Đổi tên Toán'}));
        fireEvent.change(screen.getByLabelText('Tên môn'), {target: {value: 'Toán học'}});
        fireEvent.click(screen.getByRole('button', {name: 'Lưu tên'}));
        await waitFor(() => expect(post).toHaveBeenCalledWith('folder/update', {id: 's1', name: 'Toán học'}));
    });

    it('hiding asks first; showing does not', async () => {
        const post = vi.fn((_p: string, b: any) => ({id: b.id, name: 'x', hidden: b.hidden}));
        mockApi({'folder/subjects': [S(), S({id: 's2', name: 'Sử', hidden: true})]}, {'folder/update': post});
        renderAt(<AdminSubjects/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Ẩn Toán'}));
        expect(await screen.findByText(/đề và bài làm cũ giữ nguyên/)).toBeTruthy();
        expect(post).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: 'Ẩn môn'}));
        await waitFor(() => expect(post).toHaveBeenCalledWith('folder/update', {id: 's1', hidden: true}));
        fireEvent.click(screen.getByRole('button', {name: 'Hiện Sử'}));
        await waitFor(() => expect(post).toHaveBeenCalledWith('folder/update', {id: 's2', hidden: false}));
    });
});
