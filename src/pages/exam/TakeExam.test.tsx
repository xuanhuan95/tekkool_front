import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Api from '../../services/api';
import TakeExam, {deadlineFrom} from './TakeExam';
import {pendingKey} from '../../queries/examSession';
import type {TestExam} from '../../types/exam';

/*
 * The attempt-DEDUCTING screen. `GET exam/during_test/<id>` may open an attempt and cost a turn,
 * so: exactly one call per visit, never retried on its own; the clock follows the server; time up
 * submits without asking; a lost network never loses an answer; submit cannot run twice.
 */

const EXAM: TestExam = {
    id: 'E1', name: 'Toán — Đề 3', duration: 90, remaining_sec: 600,
    sections: [
        {id: 'S1', name: 'Trắc nghiệm', questions: [
            {id: 'Q1', type: 'MultipleChoice', data: {question: '<p>1+1=?</p>', answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}]}, markedAnswer: null},
            {id: 'Q2', type: 'MultipleChoice', data: {question: '<p>2+2=?</p>', answers: [{id: 'B1', value: '4'}, {id: 'B2', value: '5'}]}, markedAnswer: null},
        ]},
        {id: 'S2', name: 'Đúng / Sai', questions: ['T1', 'T2', 'T3', 'T4'].map(id => ({
            id, type: 'TrueFalse', data: {question: 'Mệnh đề ' + id, passage: '<p>Cho hàm số f</p>', passageId: 'P1'}, markedAnswer: null,
        }))},
    ],
};

let where: string[] = [];
function Spy({label}: {label: string}) {
    const loc = useLocation();
    where.push(loc.pathname + loc.search);
    return <div>{label}</div>;
}
function Where() {
    const loc = useLocation();
    return <span data-testid='where'>{loc.pathname + loc.search}</span>;
}

const renderPage = (path = '/do-exam/E1') => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path='/do-exam/:examId' element={<><TakeExam/><Where/></>}/>
                <Route path='/packages' element={<Spy label='TRANG GÓI'/>}/>
                <Route path='/result/:id' element={<Spy label='TRANG KẾT QUẢ'/>}/>
                <Route path='/exams/:id' element={<Spy label='CHI TIẾT ĐỀ'/>}/>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);

type CallSpy = {mock: {calls: unknown[][]}};
const duringTestCalls = (get: CallSpy) =>
    get.mock.calls.map(c => String(c[0])).filter(u => u.startsWith('exam/during_test'));
const postsTo = (post: CallSpy, prefix: string) =>
    post.mock.calls.filter(c => String(c[0]).startsWith(prefix));

beforeEach(() => {
    where = [];
    vi.restoreAllMocks();
    window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('opening the exam — every call can cost a turn', () => {
    it('calls during_test EXACTLY once', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText('1+1=?');
        expect(duringTestCalls(get)).toHaveLength(1);
    });

    it('a network error is shown with "Thử lại" and NOT retried on its own', async () => {
        const get = vi.spyOn(Api, 'get').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText(/kiểm tra mạng/);
        await new Promise(r => setTimeout(r, 50));
        expect(duringTestCalls(get)).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', {name: 'Thử lại'}));
        await screen.findByText('1+1=?');
        expect(duringTestCalls(get)).toHaveLength(2);
    });

    it('a server message (409 bank busy…) is shown as is', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 409, error: 'Đang có nhiều yêu cầu vào thi cùng lúc, vui lòng thử lại.'});
        renderPage();
        await screen.findByText(/nhiều yêu cầu/);
    });

    it('?lam_lai=1 goes to BE as "?lam_lai=1" and is removed from the URL once the attempt is open', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage('/do-exam/E1?lam_lai=1');
        await screen.findByText('1+1=?');
        expect(duringTestCalls(get)).toEqual(['exam/during_test/E1?lam_lai=1']);
        // A later F5 must resume this attempt, not ask for a new one.
        await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/do-exam/E1'));
        expect(duringTestCalls(get)).toHaveLength(1);
    });

    it('a normal F5 does NOT send lam_lai', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText('1+1=?');
        expect(duringTestCalls(get)[0]).toBe('exam/during_test/E1');
    });
});

describe('402 out of turns / F5 after submit', () => {
    it('402 shows "Bạn đã hết lượt thi" in place; "Xem gói thi" goes to /packages', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 402, error: 'Bạn đã hết lượt thi.'});
        renderPage();
        await screen.findByText('Bạn đã hết lượt thi');
        expect(where).toEqual([]);
        fireEvent.click(screen.getByRole('button', {name: 'Xem gói thi'}));
        await screen.findByText('TRANG GÓI');
    });

    it('BE returns the just-submitted work (da_nop) → result page, no exam shown', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({id: 'SUB1', da_nop: true, score: 8, max_score: 10});
        renderPage();
        await screen.findByText('TRANG KẾT QUẢ');
        expect(where).toContain('/result/SUB1');
    });
});

describe('clock fixed by the server', () => {
    it('counts from remaining_sec, not duration', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText('10:00');
        expect(screen.queryByText('90:00')).toBeNull();
    });

    it('deadlineFrom: null remaining_sec (exam owner) falls back to duration; neither = no limit', () => {
        expect(deadlineFrom({...EXAM, remaining_sec: null}, 0)).toBe(90 * 60_000);
        expect(deadlineFrom({...EXAM, remaining_sec: null, duration: 0}, 0)).toBeNull();
        expect(deadlineFrom({...EXAM, remaining_sec: -3}, 1000)).toBe(1000);
    });

    it('deadlineFrom uses expires_at (SPT-60) unless the device clock is off by more than 30 s', () => {
        const now = Date.parse('2026-10-22T10:00:00Z');
        const exp = '2026-10-22T10:10:00Z';
        expect(deadlineFrom({...EXAM, remaining_sec: 595, expires_at: exp}, now)).toBe(Date.parse(exp));
        // Phone clock 1 hour behind: expires_at would show 70 minutes left → trust remaining_sec.
        expect(deadlineFrom({...EXAM, remaining_sec: 600, expires_at: exp}, now - 3_600_000)).toBe(now - 3_600_000 + 600_000);
        expect(deadlineFrom({...EXAM, remaining_sec: null, expires_at: null, duration_min: 60, duration: 90}, 0)).toBe(60 * 60_000);
    });

    it('header shows the subject (SPT-60)', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, subject: {id: 'F', name: 'Toán'}});
        renderPage();
        await screen.findByText('Toán · Toán — Đề 3');
    });

    it('≤5 minutes: red warning banner', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: 290});
        renderPage();
        await screen.findByText(/Còn dưới 5 phút/);
    });
});

describe('answers', () => {
    it('picking an option saves its value at once; status shows saved', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        const post = vi.spyOn(Api, 'post').mockResolvedValue({});
        renderPage();
        await screen.findByText('1+1=?');
        fireEvent.click(within(document.getElementById('cau-1')!).getAllByRole('radio')[0]);
        await waitFor(() => expect(post).toHaveBeenCalledWith('exam/save_answer/Q1', {answer: '2'}));
        expect(screen.getAllByText('1 / 3 đã làm').length).toBeGreaterThan(0);
        await screen.findAllByText(/Đã lưu tự động lúc/);
    });

    it('4 Đúng/Sai statements are ONE question; Đ saves "true" on that statement, pressing again clears it', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        const post = vi.spyOn(Api, 'post').mockResolvedValue({});
        renderPage();
        await screen.findByText('Cho hàm số f');
        const q3 = document.getElementById('cau-3')!;
        fireEvent.click(within(q3).getByRole('button', {name: 'Ý b đúng'}));
        await waitFor(() => expect(post).toHaveBeenCalledWith('exam/save_answer/T2', {answer: 'true'}));
        fireEvent.click(within(q3).getByRole('button', {name: 'Ý b đúng'}));
        await waitFor(() => expect(post).toHaveBeenCalledWith('exam/save_answer/T2', {answer: ''}));
    });

    it('F5 keeps answers: markedAnswer from the server is selected again', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({
            ...EXAM, sections: [{...EXAM.sections[0], questions: [{...EXAM.sections[0].questions[0], markedAnswer: '3'}]}],
        });
        renderPage();
        await screen.findByText('1+1=?');
        const radios = within(document.getElementById('cau-1')!).getAllByRole('radio');
        expect(radios[1]).toHaveAttribute('aria-checked', 'true');
        expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    });

    it('network lost: "Mất kết nối" shown, answer kept on the device and sent again later', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        const post = vi.spyOn(Api, 'post').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({});
        renderPage();
        await screen.findByText('1+1=?');
        fireEvent.click(within(document.getElementById('cau-1')!).getAllByRole('radio')[0]);
        await screen.findAllByText(/Mất kết nối/);
        expect(JSON.parse(window.localStorage.getItem(pendingKey('E1'))!).answers).toEqual({Q1: '2'});
        await act(async () => { window.dispatchEvent(new Event('online')); });
        await waitFor(() => expect(postsTo(post, 'exam/save_answer')).toHaveLength(2));
        await waitFor(() => expect(window.localStorage.getItem(pendingKey('E1'))).toBeNull());
    });

    it('answers left unsaved by a previous load (F5 while offline) are restored and re-sent', async () => {
        window.localStorage.setItem(pendingKey('E1'), JSON.stringify({deadline: Date.now() + 60_000, answers: {Q2: '5'}}));
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        const post = vi.spyOn(Api, 'post').mockResolvedValue({});
        renderPage();
        await screen.findByText('2+2=?');
        expect(within(document.getElementById('cau-2')!).getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true');
        await waitFor(() => expect(post).toHaveBeenCalledWith('exam/save_answer/Q2', {answer: '5'}));
    });
});

describe('submit', () => {
    it('confirm lists unanswered questions; submit goes once and opens the result', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        let release!: (v: unknown) => void;
        const post = vi.spyOn(Api, 'post').mockImplementation((url: string) =>
            url.startsWith('exam/submit') ? new Promise(r => { release = r; }) : Promise.resolve({}));
        renderPage();
        await screen.findByText('1+1=?');
        fireEvent.click(screen.getAllByRole('button', {name: 'Nộp bài'})[0]);
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('0 / 3')).toBeTruthy();
        expect(within(dialog).getByText('3 câu')).toBeTruthy();
        expect(within(dialog).getByRole('button', {name: /Câu 2/})).toBeTruthy();

        const confirm = within(dialog).getAllByRole('button', {name: /Nộp bài/}).pop()!;
        fireEvent.click(confirm);
        fireEvent.click(confirm);
        await waitFor(() => expect(postsTo(post, 'exam/submit')).toHaveLength(1));
        await act(async () => { release({id: 'SUB9', submitted: true}); });
        await screen.findByText('TRANG KẾT QUẢ');
        expect(where).toContain('/result/SUB9');
        expect(postsTo(post, 'exam/submit')).toHaveLength(1);
    });

    it('a failed submit keeps the student on the paper with a clear message', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        vi.spyOn(Api, 'post').mockRejectedValue(new TypeError('Failed to fetch'));
        renderPage();
        await screen.findByText('1+1=?');
        fireEvent.click(screen.getAllByRole('button', {name: 'Nộp bài'})[0]);
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getAllByRole('button', {name: /Nộp bài/}).pop()!);
        await within(dialog).findByText(/Nộp bài chưa thành công/);
        expect(within(dialog).getByRole('button', {name: 'Nộp lại'})).toBeTruthy();
    });

    it('time up: submits on its own, never asks to confirm', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: 1});
        const post = vi.spyOn(Api, 'post').mockResolvedValue({id: 'SUB2', submitted: true});
        const confirmSpy = vi.spyOn(window, 'confirm');
        renderPage();
        await screen.findByText('1+1=?');
        await screen.findByText('TRANG KẾT QUẢ', {}, {timeout: 3000});
        expect(postsTo(post, 'exam/submit')).toHaveLength(1);
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('time up + network down: paper locked with "Hết giờ làm bài" and "Nộp lại"', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: 1});
        vi.spyOn(Api, 'post').mockRejectedValue(new TypeError('Failed to fetch'));
        renderPage();
        await screen.findByText('Hết giờ làm bài', {}, {timeout: 3000});
        await screen.findByRole('button', {name: 'Nộp lại'}, {timeout: 3000});
        expect(within(document.getElementById('cau-1')!).getAllByRole('radio')[0]).toBeDisabled();
    });

    it('save_answer 409 (server: time is up) locks and submits', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        const post = vi.spyOn(Api, 'post').mockImplementation((url: string) => url.startsWith('exam/save_answer')
            ? Promise.reject({code: 409, error: 'Đã hết giờ làm bài'}) : Promise.resolve({id: 'SUB3'}));
        renderPage();
        await screen.findByText('1+1=?');
        fireEvent.click(within(document.getElementById('cau-1')!).getAllByRole('radio')[0]);
        await screen.findByText('TRANG KẾT QUẢ');
        expect(postsTo(post, 'exam/submit')).toHaveLength(1);
    });
});
