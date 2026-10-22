import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';

const {get} = vi.hoisted(() => ({get: vi.fn()}));
vi.mock('../../services/api', () => ({default: {get, post: vi.fn()}, setToken: vi.fn()}));

import ExamsPage from './ExamsPage';
import ExamDetailPage from './ExamDetailPage';
import {fetchSubjectExams} from '../../queries/student';
import {renderAt, routeApi} from './testUtils';

const subjects = [
    {id: 'toan', name: 'Toán', exams: 3, done: 1, last: null},
    {id: 'van', name: 'Ngữ văn', exams: 0, done: 0, last: null},
];
const exams = [
    {id: 'e3', name: '<p>Toán — Đề số 3</p>', duration: 90, attempts: 0},
    {id: 'e2', name: 'Toán — Đề số 2', duration: 90, attempts: 2, last_score: 7.75, last_max: 10},
];

// Braces matter: a function returned from beforeEach is run as a cleanup hook.
beforeEach(() => { get.mockReset(); });

describe('fetchSubjectExams', () => {
    it('merges the subject folder and its child sets, without duplicates', async () => {
        get.mockImplementation(routeApi({
            'folder/children?parent=toan': [{id: 'set1', name: 'Bộ 1'}],
            'exam/browse?folder=toan': [exams[0]],
            'exam/browse?folder=set1': [exams[1], exams[0]],
        }));
        expect((await fetchSubjectExams('toan')).map(e => e.id)).toEqual(['e3', 'e2']);
    });
});

describe('ExamsPage', () => {
    it('lists exams of the selected subject, filters, and switches subject', async () => {
        get.mockImplementation(routeApi({
            'folder/subjects': subjects,
            'folder/children': [],
            'exam/browse?folder=toan': exams,
            'exam/browse?folder=van': [],
            'exam/in_progress': {attempt: null},
        }));
        renderAt('/exams?mon=toan', [['/exams', <ExamsPage/>]]);
        expect(await screen.findByText('Toán — Đề số 3')).toBeInTheDocument();
        expect(screen.getByText('Đã làm 2 lần · gần nhất 7,75')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Xem đề Toán — Đề số 3'})).toHaveAttribute('href', '/exams/e3?mon=toan');

        fireEvent.click(screen.getByRole('radio', {name: 'Đã làm'}));
        expect(screen.queryByText('Toán — Đề số 3')).toBeNull();

        fireEvent.click(screen.getByRole('tab', {name: 'Ngữ văn'}));
        expect(await screen.findByText('Môn Ngữ văn chưa có đề')).toBeInTheDocument();
    });

    it('error state with retry when subjects fail', async () => {
        get.mockImplementation(routeApi({'folder/subjects': {code: 500, error: 'Máy chủ lỗi (500)'}}));
        renderAt('/exams', [['/exams', <ExamsPage/>]]);
        // 5xx is retried once (retryFlaky) before the error card shows.
        const alert = await screen.findByRole('alert', {}, {timeout: 4000});
        expect(within(alert).getByRole('button', {name: 'Thử lại'})).toBeInTheDocument();
    });
});

describe('ExamDetailPage', () => {
    const base = {
        'exam/fetch/e3': {id: 'e3', name: 'Toán — Đề số 3', duration: 90, folder: 'toan', sections: [1, 2, 3, 4]},
        'folder/subjects': subjects,
    };
    const routes = (): Array<[string, JSX.Element]> => [
        ['/exams/:examId', <ExamDetailPage/>],
        ['/do-exam/:examId', <p>PHÒNG THI</p>],
        ['/packages', <p>GÓI</p>],
    ];

    it('start costs one turn and goes to the existing exam route with lam_lai=1', async () => {
        get.mockImplementation(routeApi({...base, 'payment/wallet': {bought: 10, used: 3, remaining: 7}, 'exam/in_progress': {attempt: null}}));
        renderAt('/exams/e3', routes());
        expect(await screen.findByRole('heading', {name: 'Toán — Đề số 3'})).toBeInTheDocument();
        expect(screen.getByText('Môn Toán')).toBeInTheDocument();
        expect(screen.getByText('4 phần')).toBeInTheDocument();
        expect(await screen.findByText(/Bạn còn 7 lượt/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Bắt đầu làm bài Toán — Đề số 3'}));
        expect(await screen.findByText('PHÒNG THI')).toBeInTheDocument();
    });

    it('out of turns → buy link instead of start', async () => {
        get.mockImplementation(routeApi({...base, 'payment/wallet': {bought: 5, used: 5, remaining: 0}, 'exam/in_progress': {attempt: null}}));
        renderAt('/exams/e3', routes());
        expect(await screen.findByText('Bạn đã hết lượt thi.')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Mua thêm lượt'})).toHaveAttribute('href', '/packages');
        expect(screen.queryByRole('button', {name: /Bắt đầu/})).toBeNull();
    });

    it('in progress → resume without a new turn', async () => {
        get.mockImplementation(routeApi({...base, 'payment/wallet': {bought: 5, used: 5, remaining: 0},
            'exam/in_progress': {attempt: {exam_id: 'e3', exam_name: 'x', remaining_sec: 600, answered: 1, total: 23}}}));
        renderAt('/exams/e3', routes());
        expect(await screen.findByText('Bạn đang làm dở đề này')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Làm tiếp →'}));
        expect(await screen.findByText('PHÒNG THI')).toBeInTheDocument();
    });

    it('404 → not-found message', async () => {
        get.mockImplementation(routeApi({'folder/subjects': subjects}));
        renderAt('/exams/zzz', routes());
        expect(await screen.findByText('Không tìm thấy đề này')).toBeInTheDocument();
    });
});
