import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import type {SubmissionDetail as Sub} from '../../types/submission';
import SubmissionDetail from './SubmissionDetail';

const sub = (over: Partial<Sub> = {}): Sub => ({
    id: 's1', score: 0, max_score: 1.5, graded_max_score: 0, pending_count: 1, status: 'GRADING', can_grade: true,
    exam_name: 'Toán', student: 'Hà My',
    answers: [{
        question_id: 'q1', type: 'FreeAnswer', question_text: 'Bài tự luận', answer: '<p>x</p>', score: null, max_score: 1.5,
        images: ['img1', 'img2'],
        marks: [{id: 'm1', image_id: 'img1', type: 'check', x: 10, y: 20, created_by: 'gv', created_at: 't'}],
    }],
    ...over,
});

const open = () => render(<MemoryRouter initialEntries={['/my-exams/s1']}>
    <Routes><Route path='/my-exams/:id' element={<SubmissionDetail/>}/></Routes>
</MemoryRouter>);

const placeCross = () => {
    const stage = document.querySelector('.mk-stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON() {}});
    fireEvent.load(stage.querySelector('img') as HTMLImageElement);
    fireEvent.click(screen.getByRole('button', {name: 'Đặt dấu sai (✗)'}));
    fireEvent.click(stage, {clientX: 100, clientY: 25});
};

describe('SubmissionDetail — grading on the photo (SPT-84)', () => {
    beforeEach(() => {
        window.token = 'tok';
        useAuthStore.setState({user: {id: 'gv', name: 'GV', email: 'gv@x.vn', group: 'teacher'}});
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); });

    it('sends `marks` only for the photos the teacher changed, as {id?, type, x, y} (existing mark keeps its id)', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(sub());
        const post = vi.spyOn(Api, 'post').mockResolvedValue(sub({status: 'GRADED'}));
        open();
        await screen.findByRole('button', {name: 'Đặt dấu đúng (✓)'});
        placeCross();
        fireEvent.click(screen.getByRole('button', {name: /Lưu điểm/}));
        await waitFor(() => expect(post).toHaveBeenCalled());
        const [url, body] = post.mock.calls[0] as [string, any];
        expect(url).toBe('exam/grade/s1');
        expect(body.marks).toEqual({img1: [{id: 'm1', type: 'check', x: 10, y: 20}, {type: 'cross', x: 50, y: 25}]});
        expect(Object.keys(body.marks)).toEqual(['img1']); // img2 untouched → not sent → BE leaves it alone
    });

    it('no mark touched → no `marks` key at all', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(sub());
        const post = vi.spyOn(Api, 'post').mockResolvedValue(sub());
        open();
        await screen.findByRole('button', {name: 'Đặt dấu đúng (✓)'});
        fireEvent.click(screen.getByRole('button', {name: /Lưu điểm/}));
        await waitFor(() => expect(post).toHaveBeenCalled());
        expect(post.mock.calls[0][1]).not.toHaveProperty('marks');
    });

    it('a failed save shows the BE message, keeps the marks, and the next press retries with the same payload', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(sub());
        const post = vi.spyOn(Api, 'post').mockRejectedValueOnce({code: 400, error: 'Quá 200 dấu trên một ảnh'}).mockResolvedValue(sub());
        open();
        await screen.findByRole('button', {name: 'Đặt dấu đúng (✓)'});
        placeCross();
        fireEvent.click(screen.getByRole('button', {name: /Lưu điểm/}));
        expect(await screen.findByText('Quá 200 dấu trên một ảnh')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Dấu sai 2'})).toBeInTheDocument(); // still on screen
        fireEvent.click(screen.getByRole('button', {name: /Lưu điểm/}));
        await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
        expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
    });
});
