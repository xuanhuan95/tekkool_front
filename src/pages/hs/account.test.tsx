import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fireEvent, screen, waitFor} from '@testing-library/react';

const {get, post} = vi.hoisted(() => ({get: vi.fn(), post: vi.fn()}));
vi.mock('../../services/api', () => ({default: {get, post}, setToken: vi.fn()}));

import AccountPage from './AccountPage';
import {passwordApiError, validateName, validatePassword} from './account';
import {renderAt, routeApi} from './testUtils';
import {useAuthStore} from '../../stores/authStore';

describe('account logic', () => {
    it('validates password change', () => {
        expect(validatePassword({old: '', next: '123', confirm: '12'})).toEqual({
            old: 'Nhập mật khẩu hiện tại.', next: 'Mật khẩu mới cần ít nhất 6 ký tự.', confirm: 'Mật khẩu nhập lại chưa khớp'});
        expect(validatePassword({old: 'abcdef', next: 'abcdef', confirm: 'abcdef'}).next).toMatch(/khác/);
        expect(validatePassword({old: 'abcdef', next: 'ghijkl', confirm: 'ghijkl'})).toEqual({});
    });
    it('maps BE unaccented errors to fields', () => {
        expect(passwordApiError({code: 400, error: 'Mat khau hien tai khong dung'})).toEqual({field: 'old', message: 'Mật khẩu hiện tại chưa đúng.'});
        expect(passwordApiError(new TypeError('x')).field).toBeUndefined();
    });
    it('validates name', () => {
        expect(validateName('  ')).toBeTruthy();
        expect(validateName('Minh Anh')).toBeUndefined();
    });
});

describe('AccountPage', () => {
    const profile = {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student', hide_ranking_name: false,
        title: {key: 'newbie', name: 'Người mới', next: {name: 'Học sinh chăm', hint: 'Còn 4 bài nữa trong tháng này để lên Học sinh chăm'}},
        title_next: {name: 'Học sinh chăm', hint: 'Còn 4 bài nữa trong tháng này để lên Học sinh chăm'}};
    beforeEach(() => {
        get.mockReset(); post.mockReset();
        useAuthStore.setState({user: {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student'}});
        get.mockImplementation(routeApi({
            'me/profile': profile,
            'payment/wallet': {bought: 10, used: 3, remaining: 7},
            'exam/my_submissions': [{id: 's1', submitted_at: new Date().toISOString().slice(0, 19), score: 5, max_score: 10}],
        }));
    });

    it('shows info, turns, the title from me/profile and the BE hint to the next tier', async () => {
        renderAt('/me', [['/me', <AccountPage/>]]);
        expect(await screen.findByText('a@b.vn')).toBeInTheDocument();
        expect(await screen.findByText('7 lượt')).toBeInTheDocument();
        const chip = await screen.findByText('Người mới');
        expect(chip.closest('[data-tier]')).toHaveAttribute('data-tier', 'newbie');
        expect(screen.getByText(/Còn 4 bài nữa trong tháng này để lên Học sinh chăm/)).toBeInTheDocument();
    });

    it('no title yet: no chip, but the hint toward the first tier (title_next)', async () => {
        get.mockImplementation(routeApi({
            'me/profile': {...profile, title: null, title_next: {name: 'Học sinh chăm', hint: 'Còn 2 bài nữa trong tháng này để lên Học sinh chăm'}},
            'payment/wallet': {bought: 10, used: 3, remaining: 7},
        }));
        renderAt('/me', [['/me', <AccountPage/>]]);
        expect(await screen.findByText(/Còn 2 bài nữa/)).toBeInTheDocument();
        expect(screen.getByText(/Danh hiệu đầu tiên: Học sinh chăm/)).toBeInTheDocument();
        expect(document.querySelector('[data-tier]')).toBeNull();
    });

    it('privacy switch posts hide=true when turning "show my name" off', async () => {
        post.mockResolvedValue({hide_ranking_name: true});
        renderAt('/me', [['/me', <AccountPage/>]]);
        const sw = await screen.findByRole('switch');
        expect(sw).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(sw);
        await waitFor(() => expect(post).toHaveBeenCalledWith('me/ranking_privacy', {hide: true}));
        await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    });

    it('rename updates the header user', async () => {
        post.mockResolvedValue({name: 'Minh Anh'});
        renderAt('/me', [['/me', <AccountPage/>]]);
        fireEvent.click(await screen.findByRole('button', {name: /Đổi tên hiển thị/}));
        fireEvent.change(screen.getByLabelText('Tên hiển thị'), {target: {value: ' Minh Anh '}});
        fireEvent.click(screen.getByRole('button', {name: 'Lưu'}));
        await waitFor(() => expect(post).toHaveBeenCalledWith('me/update', {name: 'Minh Anh'}));
        await waitFor(() => expect(useAuthStore.getState().user?.name).toBe('Minh Anh'));
    });

    it('change password: wrong current password lands on that field', async () => {
        post.mockRejectedValue({code: 400, error: 'Mat khau hien tai khong dung'});
        renderAt('/me', [['/me', <AccountPage/>]]);
        fireEvent.click(await screen.findByRole('button', {name: /Đổi mật khẩu/}));
        fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {target: {value: 'sai123'}});
        fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {target: {value: 'moi12345'}});
        fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {target: {value: 'moi12345'}});
        fireEvent.click(screen.getAllByRole('button', {name: 'Đổi mật khẩu'}).pop()!);
        expect(await screen.findByText('Mật khẩu hiện tại chưa đúng.')).toBeInTheDocument();
        expect(post).toHaveBeenCalledWith('me/change_password', {old_password: 'sai123', new_password: 'moi12345'});
    });
});
