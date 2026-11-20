import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {mockApi} from '../manage/testutil';
import ExamPage from './ExamPage';

afterEach(() => vi.restoreAllMocks());

const base = {
    id: 'E1', name: 'Đề luyện Ngữ văn', status: 'draft', duration: 90, folder: {id: 'S2', name: 'Ngữ văn'}, source: 'bank', source_file: 'de-mau.docx',
    created_at: '2026-11-20T07:05:00Z', updated_at: '2026-11-20T07:05:00Z', question_count: 12, points_total: 10, approx: true,
    parts: [
        {group_title: 'A. Tô trên phiếu', title: 'Phần I', score: 3, question_count: 10, points_total: 3, items: [{block_type: 'reading', blocks: 2, questions: 10}]},
        {group_title: 'B. Viết trên giấy thi', title: 'Phần II', score: 2, question_count: 1, points_total: 2, items: [{block_type: 'paragraph', blocks: 1, questions: 1}]},
        {group_title: 'B. Viết trên giấy thi', title: 'Phần III', score: 5, question_count: 1, points_total: 5, items: [{block_type: 'essay', blocks: 1, questions: 1}]},
    ],
    banks: [{id: 'B1', name: 'Ngân hàng Ngữ văn', kind: 'blocks'}], draw: {capacity: 20, shortage: []}, submissions: {total: 0, pending: 0},
};

function Where() { const l = useLocation(); return <p data-testid='where'>{l.pathname}</p>; }
function open(detail: unknown, posts: Record<string, unknown> = {}) {
    window.matchMedia = ((q: string) => ({matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn()})) as never;
    const api = mockApi({'exam/detail': detail, 'folder/list': [{id: 'S2', name: 'Ngữ văn'}, {id: 'S1', name: 'Toán'}]}, posts);
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={['/exam/E1']}><Where/>
            <Routes><Route path='/exam/:examId' element={<ExamPage/>}/><Route path='*' element={<p>nơi khác</p>}/></Routes>
        </MemoryRouter>
    </QueryClientProvider>);
    return api;
}

describe('/exam/:id', () => {
    it('drawn exam: breadcrumb, structure by group, bank link, capacity, template file, actions', async () => {
        open(base);
        expect(await screen.findByRole('heading', {level: 1, name: 'Đề luyện Ngữ văn'})).toBeTruthy();
        const crumb = screen.getByRole('navigation', {name: 'Đường dẫn'});
        expect(within(crumb).getByRole('link', {name: 'Ngữ văn'}).getAttribute('href')).toBe('/subject/S2');
        const table = screen.getByRole('table');
        const cells = within(table).getAllByRole('row').map(r => r.textContent);
        expect(cells).toEqual([
            'PhầnNội dungCâuĐiểm', 'A. Tô trên phiếu', 'Phần I2 đoạn đọc hiểu × 5 câu, rút ngẫu nhiên103',
            'B. Viết trên giấy thi', 'Phần II1 câu viết đoạn văn, rút ngẫu nhiên12', 'Phần III1 câu viết bài văn, rút ngẫu nhiên15', 'Cả đề1210']);
        expect(screen.getByText(/Câu hỏi không cố định/)).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Ngân hàng Ngữ văn'}).getAttribute('href')).toBe('/question-bank/B1');
        expect(screen.getByText('de-mau.docx (chỉ lấy cấu trúc)')).toBeTruthy();
        expect(screen.getByText(/khoảng/).textContent).toContain('20 đề');
        expect(screen.getByRole('button', {name: 'Xuất bản'})).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Sửa'}).getAttribute('href')).toBe('/edit-exam/E1');
        expect(screen.getByText('Chưa có bài nộp. Đề nháp thì học sinh chưa thấy.')).toBeTruthy();
    });

    it('word exam: source file and import time, fixed-question note, submissions with a link', async () => {
        open({...base, source: 'word', approx: false, status: 'published', source_file: 'de1.docx', draw: null, banks: [],
              parts: [{group_title: null, title: 'Phần I', question_count: 12, points_total: 10, items: [{block_type: null, type: 'mcq', questions: 12}]}],
              submissions: {total: 57, pending: 3}});
        await screen.findByRole('heading', {level: 1});
        expect(screen.getByText('de1.docx')).toBeTruthy();
        expect(screen.getByText('Nhập lúc')).toBeTruthy();
        expect(screen.getByText(/Câu hỏi cố định như file/)).toBeTruthy();
        expect(screen.queryByText(/Câu hỏi không cố định/)).toBeNull();
        expect(screen.getByText('57')).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Xem bài nộp'}).getAttribute('href')).toBe('/to-grade/E1');
        expect(screen.queryByRole('button', {name: 'Xuất bản'})).toBeNull();
    });

    it('old exam with no source and no dates: no "Tạo bằng cách nào" card, no crash', async () => {
        open({...base, source: null, source_file: null, created_at: null, updated_at: null, banks: [], draw: null, approx: false});
        await screen.findByRole('heading', {level: 1});
        expect(screen.queryByText('Tạo bằng cách nào')).toBeNull();
    });

    it('a bank with too few blocks says what is missing instead of a capacity', async () => {
        open({...base, draw: {capacity: 0, shortage: [{block_type: 'reading', name: 'Đoạn đọc hiểu', need: 2, have: 1}]}});
        expect(await screen.findByText(/Chưa đủ khối trong ngân hàng: thiếu 1 đoạn đọc hiểu/)).toBeTruthy();
    });

    it('Xuất bản posts for this exam', async () => {
        const api = open(base, {'exam/publish': {}});
        fireEvent.click(await screen.findByRole('button', {name: 'Xuất bản'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('exam/publish/E1'));
    });

    it('deleting from the page goes back to the subject', async () => {
        const api = open(base, {'exam/delete': {}});
        fireEvent.click(await screen.findByRole('button', {name: /Thao tác khác/}));
        fireEvent.click(screen.getByRole('menuitem', {name: /Xoá đề/}));
        fireEvent.click(within(await screen.findByRole('dialog', {name: 'Xoá đề này?'})).getByRole('button', {name: 'Xoá đề'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('exam/delete/E1'));
        await screen.findByText('nơi khác');
        expect(screen.getByTestId('where').textContent).toBe('/subject/S2');
    });

    it.each([[404, 'Không tìm thấy đề này'], [403, 'Cô không xem được đề này']])('%i → a clear message and a way back', async (code, title) => {
        open(() => { throw {code, error: 'x'}; });
        expect(await screen.findByText(title)).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Về Môn & đề'}).getAttribute('href')).toBe('/');
    });

    it('other errors offer a retry', async () => {
        const api = open(() => { throw {code: 500, error: 'Lỗi máy chủ'}; });
        fireEvent.click(await screen.findByRole('button', {name: 'Thử lại'}));
        await waitFor(() => expect(api.get.mock.calls.filter(c => String(c[0]).startsWith('exam/detail')).length).toBeGreaterThan(1));
    });
});
