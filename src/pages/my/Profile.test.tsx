import {describe, expect, it} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

import Profile from './Profile';
import {mockApi, renderAt} from '../manage/testutil';
import {useAuthStore} from '../../stores/authStore';

describe('Teacher Profile', () => {
    it('shows name + email read-only, no rename / login-key note, change password opens the dialog', () => {
        mockApi({});
        useAuthStore.setState({user: {id: 't', name: 'Cô Thu Hà', email: 't@x.vn', group: 'teacher'}} as any);
        renderAt(<Profile/>);
        expect(screen.getByText('Cô Thu Hà')).toBeTruthy();
        expect(screen.getByText('t@x.vn')).toBeTruthy();
        expect(screen.queryByText('Tên hiển thị')).toBeNull();
        expect(screen.queryByText(/tên đăng nhập/)).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: /Đổi mật khẩu/}));
        expect(screen.getByRole('dialog', {name: 'Đổi mật khẩu'})).toBeTruthy();
    });

    it('shows Môn phụ trách from me/profile; empty → asks to contact Admin', async () => {
        useAuthStore.setState({user: {id: 't', name: 'Cô Thu Hà', email: 't@x.vn', group: 'teacher'}} as any);
        const api = mockApi({'me/profile': {id: 't', name: 'x', email: 'e', group: 'teacher', subjects: ['Toán']}});
        const {unmount} = renderAt(<Profile/>);
        expect(await screen.findByText('Toán')).toBeTruthy();
        unmount();
        api.get.mockResolvedValue({id: 't', name: 'x', email: 'e', group: 'teacher', subjects: []});
        renderAt(<Profile/>);
        expect(await screen.findByText('Chưa được gán môn, liên hệ Admin.')).toBeTruthy();
    });
});
