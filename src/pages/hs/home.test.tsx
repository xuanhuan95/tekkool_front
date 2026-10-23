import {describe, it, expect, vi} from 'vitest';
import {screen} from '@testing-library/react';

const {get} = vi.hoisted(() => ({get: vi.fn()}));
vi.mock('../../services/api', () => ({default: {get, post: vi.fn()}, setToken: vi.fn()}));

import StudentHome from '../student/StudentHome';
import {renderAt, routeApi} from './testUtils';
import {useAuthStore} from '../../stores/authStore';

describe('StudentHome (phone)', () => {
    it('greets, shows turns, in-progress card and up to 6 subjects', async () => {
        useAuthStore.setState({user: {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student'}});
        const subjects = Array.from({length: 8}, (_, i) => ({id: 's' + i, name: 'Môn ' + i, exams: 3, done: i % 2, last: null}));
        get.mockImplementation(routeApi({
            'folder/subjects': subjects,
            'payment/wallet': {bought: 10, used: 3, remaining: 7},
            'exam/in_progress': {attempt: {exam_id: 'e3', exam_name: 'Đề thi thử SPT số 3', subject: 'Toán', remaining_sec: 2280, answered: 10, total: 23}},
            'exam/my_submissions': [],
            'me/profile': {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student', hide_ranking_name: false,
                title: {key: 'warrior', name: 'Chiến binh', next: {name: 'Người chinh phục', hint: 'Lọt top 3 bảng xếp hạng tuần để lên Người chinh phục'}}},
        }));
        renderAt('/', [['/', <StudentHome/>]]);
        expect(screen.getByRole('heading', {name: 'Chào Minh Anh!'})).toBeInTheDocument();
        expect(await screen.findByText('7 lượt')).toBeInTheDocument();
        expect(await screen.findByText('Đề thi thử SPT số 3')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Làm tiếp Đề thi thử SPT số 3'})).toHaveAttribute('href', '/do-exam/e3');
        expect(await screen.findByText('Môn 5')).toBeInTheDocument();
        expect(screen.queryByText('Môn 6')).toBeNull();
        expect(screen.getByRole('link', {name: 'Xem cả 8 môn'})).toHaveAttribute('href', '/exams');
        expect(await screen.findByText('Chiến binh')).toBeInTheDocument();
        expect(screen.getByText(/Lọt top 3 bảng xếp hạng tuần/)).toBeInTheDocument();
    });
});
