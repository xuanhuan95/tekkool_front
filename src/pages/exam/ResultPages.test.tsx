import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Api from '../../services/api';
import ResultPage from './ResultPage';
import ReviewPage from './ReviewPage';
import HistoryPage from './HistoryPage';
import type {SubmissionDetail} from '../../types/submission';

const DETAIL: SubmissionDetail = {
    id: 'SUB1', exam_name: 'Toán — Đề 3', submitted_at: '2026-10-21T13:47:00', duration_sec: 82 * 60,
    score: 5.75, max_score: 10, graded_max_score: 8.5, pending_count: 1, status: 'GRADING',
    subject: {id: 'F1', name: 'Toán'}, duration_min: 90, ranking_contribution: 15.8,
    phan: [
        {ten: 'I · Trắc nghiệm', score: 0.25, max_score: 0.5, pending: 0},
        {ten: 'II · Đúng/Sai', score: 0.25, max_score: 1, pending: 0},
        {ten: 'IV · Tự luận', score: 0, max_score: 1.5, pending: 1},
    ],
    answers: [
        {question_id: 'Q1', type: 'MultipleChoice', section_name: 'I · Trắc nghiệm', question_text: '<p>1+1?</p>',
         answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}], correct_id: 'A1', answer: '3', score: 0, max_score: 0.25,
         explanation: '<p>Một cộng một bằng hai.</p>'},
        {question_id: 'Q2', type: 'MultipleChoice', section_name: 'I · Trắc nghiệm', question_text: '<p>2+2?</p>',
         answers: [{id: 'B1', value: '4'}, {id: 'B2', value: '5'}], correct_id: 'B1', answer: '4', score: 0.25, max_score: 0.25},
        ...['T1', 'T2', 'T3', 'T4'].map((id, k) => ({
            question_id: id, type: 'TrueFalse', section_name: 'II · Đúng/Sai', question_text: 'Mệnh đề ' + id,
            passage: '<p>Cho hàm số y</p>', passage_id: 'P', answer: k < 2 ? 'true' : 'false',
            correct: 'true', score: k < 2 ? 0.125 : 0, max_score: 0.25,
        })),
        {question_id: 'E1', type: 'FreeAnswer', section_name: 'IV · Tự luận', question_text: 'Giải bài',
         answer: '<p>Bài làm</p>', score: null, max_score: 1.5},
    ],
};

const page = (path: string) => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path='/result/:id' element={<ResultPage/>}/>
                <Route path='/review/:id' element={<ReviewPage/>}/>
                <Route path='/history' element={<HistoryPage/>}/>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);

beforeEach(() => vi.restoreAllMocks());

describe('ResultPage', () => {
    it('provisional score /10, pending essay points, table by part, +rank points', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue(DETAIL);
        page('/result/SUB1');
        await screen.findByText('Toán — Đề 3');
        expect(get).toHaveBeenCalledWith('exam/submission/SUB1');
        expect(screen.getByText('Chờ chấm tự luận')).toBeTruthy();
        expect(screen.getAllByText('5,75').length).toBeGreaterThan(0);
        expect(screen.getByText('Tạm tính · chờ chấm 1,5đ tự luận')).toBeTruthy();
        const table = screen.getByRole('table');
        expect(within(table).getByText('1 / 2')).toBeTruthy();
        expect(within(table).getByText('2 / 4 ý')).toBeTruthy();
        expect(within(table).getByText('Chờ chấm')).toBeTruthy();
        expect(screen.getByText(/\+15,8 điểm xếp hạng tuần/)).toBeTruthy();
        expect(screen.getByText('82 phút')).toBeTruthy();
        expect(screen.getByText('/ 90 phút')).toBeTruthy();
        expect(screen.getByText(/Môn Toán/)).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Xem lại bài'})).toHaveAttribute('href', '/review/SUB1');
    });

    it('ranking line uses BE ranking_contribution; 0 explains why; absent → hidden', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...DETAIL, ranking_contribution: 0});
        const {unmount} = page('/result/SUB1');
        await screen.findByText(/\+0,0 điểm xếp hạng tuần/);
        expect(screen.getByText(/Lần này không cộng thêm/)).toBeTruthy();
        unmount();
        vi.spyOn(Api, 'get').mockResolvedValue({...DETAIL, ranking_contribution: undefined});
        page('/result/SUB1');
        await screen.findByText('Toán — Đề 3');
        expect(screen.queryByText(/điểm xếp hạng tuần/)).toBeNull();
    });

    it('final score when everything is graded — no "Tạm tính"', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...DETAIL, pending_count: 0, status: 'GRADED', score: 7.25,
            graded_max_score: 10, phan: DETAIL.phan!.map(p => ({...p, pending: 0}))});
        page('/result/SUB1');
        await screen.findByText('Đã chấm');
        expect(screen.queryByText(/Tạm tính/)).toBeNull();
        expect(screen.getAllByText('7,25').length).toBeGreaterThan(0);
    });

    it('403 → clear message with retry', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 403, error: 'Khong xem duoc bai nay'});
        page('/result/X');
        await screen.findByText('Bạn không xem được bài làm này.');
        expect(screen.getByRole('button', {name: 'Thử lại'})).toBeTruthy();
    });
});

describe('ReviewPage', () => {
    it('shows chosen vs correct option, Đ/S per statement and the waiting essay; filters work', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(DETAIL);
        page('/review/SUB1');
        const q1 = await screen.findByRole('article', {name: 'Câu 1'});
        expect(within(q1).getByText('Sai · 0 điểm')).toBeTruthy();
        expect(within(q1).getByText('Bạn chọn')).toBeTruthy();
        expect(within(q1).getByText('Đáp án đúng')).toBeTruthy();
        // Wrong answer with an explanation: "Lời giải" open.
        expect(within(q1).getByText('Lời giải').closest('details')).toHaveAttribute('open');
        expect(within(q1).getByText('Một cộng một bằng hai.')).toBeTruthy();
        expect(within(screen.getByRole('article', {name: 'Câu 2'})).queryByText('Lời giải')).toBeNull();

        const q3 = screen.getByRole('article', {name: 'Câu 3'});
        expect(within(q3).getByText('2 / 4 ý · 0,25 / 1')).toBeTruthy();
        expect(within(q3).getAllByLabelText('Sai')).toHaveLength(2);

        expect(screen.getByRole('article', {name: 'Câu 4 · 1,5đ'})).toBeTruthy();
        expect(screen.getByText('Chờ giáo viên chấm')).toBeTruthy();

        fireEvent.click(screen.getByRole('tab', {name: 'Đúng'}));
        expect(screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['Câu 2']);
        fireEvent.click(screen.getByRole('tab', {name: 'Sai'}));
        expect(screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['Câu 1', 'Câu 3']);
        fireEvent.click(screen.getByRole('tab', {name: 'Tự luận'}));
        expect(screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['Câu 4 · 1,5đ']);
    });
});

describe('HistoryPage', () => {
    it('lists attempts newest first with provisional/final score, filter "Chờ chấm"', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue([
            {...DETAIL, answers: undefined},
            {id: 'SUB0', exam_name: 'Ngữ văn — Đề 2', submitted_at: '2026-10-19T12:15:00', duration_sec: 88 * 60,
             score: 6.5, max_score: 10, graded_max_score: 10, pending_count: 0, status: 'GRADED'},
        ]);
        page('/history');
        await screen.findByText('Ngữ văn — Đề 2');
        expect(screen.getByText('6,50')).toBeTruthy();
        expect(screen.getByText('tạm tính')).toBeTruthy();
        expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/result/SUB1', '/result/SUB0']);
        fireEvent.click(screen.getByRole('radio', {name: 'Chờ chấm · 1'}));
        expect(screen.queryByText('Ngữ văn — Đề 2')).toBeNull();
    });

    it('subject filter chips appear when there are 2+ subjects', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue([
            {...DETAIL, answers: undefined},
            {id: 'SUB0', exam_name: 'Đề 2', subject: {id: 'F2', name: 'Ngữ văn'}, submitted_at: '2026-10-19T12:15:00',
             score: 6.5, max_score: 10, graded_max_score: 10, pending_count: 0, status: 'GRADED'},
        ]);
        page('/history');
        await screen.findByText('Ngữ văn — Đề 2');
        fireEvent.click(screen.getByRole('button', {name: 'Toán'}));
        expect(screen.queryByText('Ngữ văn — Đề 2')).toBeNull();
        expect(screen.getByText('Toán — Toán — Đề 3')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: 'Tất cả môn'}));
        expect(screen.getByText('Ngữ văn — Đề 2')).toBeTruthy();
    });

    it('empty history → empty state with a way to the exams', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue([]);
        page('/history');
        await screen.findByText('Chưa có bài nào');
        expect(screen.getByRole('link', {name: 'Xem đề thi'})).toHaveAttribute('href', '/exams');
    });
});
