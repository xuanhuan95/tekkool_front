import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

import {useAuthStore} from '../../../stores/authStore';
import {renderAt} from '../../../pages/manage/testutil';
import {TeacherLayout} from './Layouts';

afterEach(() => useAuthStore.setState({user: null}));

describe('TeacherLayout', () => {
    // Phone and web headers both mount (CSS switches them), so there are two buttons.
    it('both headers have a sign-out button that calls signOut', () => {
        const signOut = vi.fn();
        useAuthStore.setState({signOut});
        renderAt(<TeacherLayout name='Cô Lan'><p>nội dung</p></TeacherLayout>);
        const buttons = screen.getAllByRole('button', {name: 'Đăng xuất'});
        expect(buttons).toHaveLength(2);
        buttons.forEach(b => fireEvent.click(b));
        expect(signOut).toHaveBeenCalledTimes(2);
    });
});
