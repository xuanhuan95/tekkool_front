import {describe, expect, it} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

import Profile from './Profile';
import {renderAt} from '../manage/testutil';
import {useAuthStore} from '../../stores/authStore';

describe('Teacher Profile', () => {
    it('shows name + email read-only, no rename / login-key note, change password opens the dialog', () => {
        useAuthStore.setState({user: {id: 't', name: 'Cô Thu Hà', email: 't@x.vn', group: 'teacher'}} as any);
        renderAt(<Profile/>);
        expect(screen.getByText('Cô Thu Hà')).toBeTruthy();
        expect(screen.getByText('t@x.vn')).toBeTruthy();
        expect(screen.queryByText('Tên hiển thị')).toBeNull();
        expect(screen.queryByText(/tên đăng nhập/)).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: /Đổi mật khẩu/}));
        expect(screen.getByRole('dialog', {name: 'Đổi mật khẩu'})).toBeTruthy();
    });
});
