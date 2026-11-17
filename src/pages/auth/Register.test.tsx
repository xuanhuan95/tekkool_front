import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

const {get, post} = vi.hoisted(() => ({get: vi.fn(), post: vi.fn()}));
vi.mock('../../services/api', () => ({default: {get, post}, setToken: vi.fn()}));

import Register from './Register';
import {renderAt, routeApi} from '../hs/testUtils';

describe('Register step 2', () => {
    beforeEach(() => {
        get.mockReset(); post.mockReset();
        get.mockImplementation(routeApi({
            'user/exam_subjects_options': [{id: 'a', name: 'Toán', exams: 3}, {id: 'b', name: 'Vật lí', exams: 0}],
        }));
    });

    it('a subject with exams: 0 carries the "Sắp có" tag, one with exams does not', async () => {
        renderAt('/register', [['/register', <Register/>]]);
        fireEvent.change(screen.getByLabelText('Họ và tên'), {target: {value: 'Minh Anh'}});
        fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@b.vn'}});
        fireEvent.change(screen.getByLabelText('Mật khẩu'), {target: {value: '12345678'}});
        fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), {target: {value: '12345678'}});
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', {name: /Tiếp tục/}));
        expect(await screen.findAllByText('Sắp có')).toHaveLength(1);
        expect(screen.getByText('Hoặc chọn từng môn')).toBeInTheDocument();
    });
});
