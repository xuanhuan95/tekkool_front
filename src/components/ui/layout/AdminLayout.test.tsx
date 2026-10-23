import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

import {useAuthStore} from '../../../stores/authStore';
import {renderAt} from '../../../pages/manage/testutil';
import {AdminLayout} from './Layouts';

afterEach(() => useAuthStore.setState({user: null}));

describe('AdminLayout', () => {
    it('header has a sign-out button that calls signOut', () => {
        const signOut = vi.fn();
        useAuthStore.setState({signOut});
        renderAt(<AdminLayout name='Admin A'><p>nội dung</p></AdminLayout>);
        fireEvent.click(screen.getByRole('button', {name: 'Đăng xuất'}));
        expect(signOut).toHaveBeenCalledTimes(1);
    });
});
