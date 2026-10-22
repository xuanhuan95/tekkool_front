import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

const post = vi.fn();
vi.mock('../../services/api', () => ({default: {post: (...a: unknown[]) => post(...a)}, setToken: vi.fn()}));

import Login from './Login';
import {useAuthStore} from '../../stores/authStore';

function setup() {
    render(<MemoryRouter initialEntries={['/']}>
        <Routes>
            <Route path='/' element={<Login/>}/>
            <Route path='/manage' element={<p>ADMIN HOME</p>}/>
        </Routes>
    </MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@b.vn'}});
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {target: {value: '123456'}});
    fireEvent.click(screen.getByRole('button', {name: 'Đăng nhập'}));
}

describe('Login', () => {
    beforeEach(() => { post.mockReset(); useAuthStore.setState({user: null, token: ''}); });

    it('shows the locked message on 403', async () => {
        post.mockRejectedValue({code: 403, error: 'Tài khoản đã bị khoá. Liên hệ Admin.'});
        setup();
        expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản bị khoá');
        expect(screen.getByRole('button', {name: 'Đăng nhập'})).not.toHaveAttribute('aria-busy');
    });

    it('admin lands on /manage with the new token stored', async () => {
        post.mockResolvedValue({id: 'u1', name: 'QT', email: 'a@b.vn', group: 'admin', token: 'NEW'});
        setup();
        await waitFor(() => expect(screen.getByText('ADMIN HOME')).toBeInTheDocument());
        expect(useAuthStore.getState().token).toBe('NEW');
    });

    it('has no Google/Facebook buttons and offers support for a forgotten password', () => {
        render(<MemoryRouter><Login/></MemoryRouter>);
        expect(screen.queryByText(/google|facebook/i)).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'Quên mật khẩu?'}));
        expect(screen.getByRole('status')).toHaveTextContent('liên hệ bộ phận hỗ trợ');
    });
});
