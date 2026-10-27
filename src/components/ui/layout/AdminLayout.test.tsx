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
        const out = screen.getByRole('button', {name: 'Đăng xuất'});
        expect(out.getAttribute('data-tip')).toBe('Đăng xuất');   // icon-only: tooltip names it
        expect(screen.queryByText('Admin A')).toBeNull();          // no name text in the header (SPT-77)
        fireEvent.click(out);
        expect(signOut).toHaveBeenCalledTimes(1);
    });
});
