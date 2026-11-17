import {describe, it, expect, vi, beforeEach} from 'vitest';
import {screen} from '@testing-library/react';

const {get} = vi.hoisted(() => ({get: vi.fn()}));
vi.mock('../../services/api', () => ({default: {get, post: vi.fn()}, setToken: vi.fn()}));

import StudentHome from '../student/StudentHome';
import {renderAt, routeApi} from './testUtils';
import {useAuthStore} from '../../stores/authStore';

const subjects = [
    {id: 'math', name: 'Toán', exams: 3, done: 2, last: null},
    {id: 'lit', name: 'Ngữ văn', exams: 2, done: 1, last: null},
    {id: 'phys', name: 'Vật lý', exams: 1, done: 0, last: null},
    {id: 'bio', name: 'Sinh học', exams: 0, done: 0, last: null},
];
const sub = (o: object) => ({id: 's' + Math.random(), exam_name: 'Đề thi thử SPT số 1', status: 'GRADED', pending_count: 0,
    score: 9, max_score: 10, submitted_at: '2026-11-02T13:15:00', duration_sec: 5040, ...o});
const profile = (o: object = {}) => ({id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student',
    exam_subjects: ['math', 'lit', 'chem'],
    streak: {current: 4, best: 9, this_week_done: true, this_week: [true, false, true, false, false, false, false]},
    title: null, title_next: {name: 'Học sinh chăm', hint: 'Còn 3 bài nữa trong tháng này để lên Học sinh chăm'}, ...o});

function setup(table: Record<string, unknown>) {
    useAuthStore.setState({user: {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student'}});
    get.mockImplementation(routeApi({
        'folder/subjects': subjects, 'exam/in_progress': {attempt: null}, 'exam/my_submissions': [],
        'me/profile': profile(), ...table,
    }));
    renderAt('/', [['/', <StudentHome/>]]);
}

describe('StudentHome (phone)', () => {
    beforeEach(() => { get.mockReset(); });

    it('greets, shows the streak, chosen subjects with best score, chain and recent rows', async () => {
        setup({'exam/my_submissions': [
            sub({subject: {id: 'math', name: 'Toán'}, exam_name: 'Toán — Đề thi thử SPT số 2'}),
            sub({subject: {id: 'lit', name: 'Ngữ văn'}, exam_name: 'Ngữ văn — Đề số 1', status: 'GRADING', pending_count: 1, score: 6.5}),
        ]});
        expect(screen.getByRole('heading', {name: /^Chào buổi (sáng|chiều|tối), Minh Anh!$/})).toBeInTheDocument();
        expect(await screen.findByText('Kỷ lục 9 tuần')).toBeInTheDocument();
        expect(document.querySelector('.c-sk--done')).not.toBeNull();
        expect(screen.getByRole('img', {name: /^Tuần \d+(\/\d+)?–\d+\/\d+(\/\d+)?, đã luyện 2 ngày$/})).toBeInTheDocument();
        expect(await screen.findByText('1 lượt · cao nhất 9')).toBeInTheDocument();
        expect(screen.getByText('1 lượt · chờ chấm')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Sửa'})).toHaveAttribute('href', '/me#mon-em-thi');
        // "Thử sức thêm": Vật lý open, Sinh học not yet
        expect(screen.getByRole('link', {name: /Vật lý/})).toHaveAttribute('href', '/exams?mon=phys');
        expect(screen.getByText('Sắp có')).toBeInTheDocument();
        expect(screen.getAllByText('84 phút').length).toBe(2);
        expect(screen.getByText('Toán — Đề thi thử SPT số 2')).toBeInTheDocument();
        expect(screen.getByText('Còn 3 bài nữa trong tháng này để lên Học sinh chăm.')).toBeInTheDocument();
        expect(screen.queryByText('Top tuần này')).toBeNull();   // phone: no weekly top
    });

    it('new student: zero streak, plain "Vào thi" cards, empty recent block', async () => {
        setup({'me/profile': profile({streak: {current: 0, best: 0, this_week_done: false, this_week: Array(7).fill(false)}})});
        expect(await screen.findByText('Làm 1 bài tuần này để bắt đầu chuỗi')).toBeInTheDocument();
        expect(document.querySelector('.c-sk--zero')).not.toBeNull();
        expect(await screen.findByText('Chưa có bài làm nào')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Chọn đề đầu tiên →'})).toHaveAttribute('href', '/exams');
        expect(document.querySelector('.c-more-grid')).not.toBeNull();
    });

    it('live streak with an empty week: keep state and the running attempt card', async () => {
        setup({
            'me/profile': profile({streak: {current: 3, best: 3, this_week_done: false, this_week: Array(7).fill(false)}}),
            'exam/in_progress': {attempt: {exam_id: 'TOAN3', exam_name: 'Toán 3', subject: 'Toán', remaining_sec: 5400, answered: 6, total: 35}},
        });
        expect(await screen.findByText('Làm 1 bài tuần này để giữ chuỗi')).toBeInTheDocument();
        expect(await screen.findByText('6/35 câu · còn 90 phút')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /Làm tiếp/})).toHaveAttribute('href', '/do-exam/TOAN3');
        expect(screen.getByRole('progressbar', {name: 'Số câu đã làm'})).toHaveAttribute('aria-valuenow', '6');
    });

    it('API errors show a retry instead of blank blocks', async () => {
        setup({'folder/subjects': {code: 500, error: 'boom'}, 'exam/my_submissions': {code: 500, error: 'boom'}});
        expect(await screen.findByText(/Không tải được danh sách môn/, {}, {timeout: 4000})).toBeInTheDocument();
        expect(await screen.findByText(/Không tải được bài làm gần đây/, {}, {timeout: 4000})).toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: /thử lại/i}).length).toBeGreaterThanOrEqual(2);
    });
});
