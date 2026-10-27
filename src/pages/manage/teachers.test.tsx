import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';

import {useAuthStore} from '../../stores/authStore';
import ManageApp from './ManageApp';
import Teachers, {createTeacherError} from './Teachers';
import {qs as qsForTest} from '../../queries/manage';
import {generateTempPassword, isValidTempPassword} from './shared';
import {mockApi, renderAt} from './testutil';

afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState({user: null}); });

const T = (over: object = {}) => ({
    id: 'u1', name: 'Cô Thu Hà', email: 'thuha@vtp.vn', subjects: ['Toán', 'Tin học'], locked: false,
    must_change_password: false, last_login_at: '2026-10-20T10:00:00', created_at: '2026-09-02T03:00:00',
    status: 'active', exam_count: 14, ...over,
});
const page = (items: object[], total = items.length) => ({items, total, page: 1, limit: 20});

describe('helpers', () => {
    it('temp password rule matches the BE', () => {
        expect(isValidTempPassword('Vtp7k2M9q')).toBe(true);
        expect(isValidTempPassword('short1A')).toBe(false);
        expect(isValidTempPassword('alllower123')).toBe(false);
        expect(isValidTempPassword('NODIGITSaa')).toBe(false);
    });

    it('generated passwords always pass the rule and avoid look-alikes', () => {
        for (let i = 0; i < 200; i++) {
            const pw = generateTempPassword();
            expect(pw).toHaveLength(10);
            expect(isValidTempPassword(pw)).toBe(true);
            expect(pw).not.toMatch(/[O0Il1]/);
        }
    });

    it('query string drops empty filters', () => {
        expect(qsForTest({q: '', page: 1, status: undefined, subject: 'Toán'})).toBe('?page=1&subject=To%C3%A1n');
        expect(qsForTest({})).toBe('');
    });

    it('maps the BE duplicate-email error', () => {
        expect(createTeacherError({code: 400, error: 'Email exists already'})).toBe('Email này đã có tài khoản');
        expect(createTeacherError({code: 400, error: 'Email không hợp lệ'})).toBe('Email không hợp lệ');
    });
});

describe('ManageApp guard', () => {
    it('non-admin gets a 403 card, no admin API call', () => {
        useAuthStore.setState({user: {id: 's', name: 'HS', email: 'a@b.c', group: 'student'}});
        const api = mockApi();
        renderAt(<ManageApp/>, '/manage/teachers');
        expect(screen.getByText('Bạn không có quyền vào trang quản trị')).toBeTruthy();
        expect(api.get).not.toHaveBeenCalled();
    });

    it('admin lands on teachers', async () => {
        useAuthStore.setState({user: {id: 'a', name: 'Quản trị viên', email: 'a@b.c', group: 'admin'}});
        mockApi({'admin/teachers': page([T()])});
        renderAt(<ManageApp/>, '/manage');
        expect(await screen.findByText('Cô Thu Hà')).toBeTruthy();
        expect(screen.getByRole('navigation', {name: 'Menu quản trị'})).toBeTruthy();
    });
});

describe('Teachers (AD-GiaoVien)', () => {
    it('lists teachers with subjects and status, icon actions, totals line; no exam-count column', async () => {
        const items = [T(), T({id: 'u2', name: 'Thầy Vinh', status: 'never_logged_in', exam_count: 0}),
            T({id: 'u3', name: 'Cô Hương', status: 'locked', locked: true})];
        // stats line asks for 1-row pages: total, and locked only
        mockApi({'admin/teachers': (path: string) => !path.includes('limit=1&') && !path.endsWith('limit=1') ? page(items)
            : page([], path.includes('status=locked') ? 1 : 6)});
        renderAt(<Teachers/>);
        await screen.findByText('Cô Thu Hà');
        const table = within(screen.getByRole('table'));
        expect(table.getAllByText('Tin học').length).toBe(3);
        expect(table.getByText('Chưa đăng nhập')).toBeTruthy();
        expect(table.getByText('Đã khoá')).toBeTruthy();
        expect(screen.getByRole('button', {name: 'Mở khoá tài khoản Cô Hương'}).getAttribute('data-tip')).toBe('Mở khoá tài khoản Cô Hương');
        expect(screen.getByRole('button', {name: 'Đặt lại mật khẩu cho Cô Thu Hà'})).toBeTruthy();
        expect(table.queryByText('Số đề')).toBeNull();
        expect(table.getAllByText('02/09/2026').length).toBe(3);
        expect(await screen.findByText('Tổng 6 · Hoạt động 5 · Đã khoá 1')).toBeTruthy();
    });

    it('filters go to the API', async () => {
        const api = mockApi({'admin/teachers': page([T()])});
        renderAt(<Teachers/>);
        await screen.findByText('Cô Thu Hà');
        fireEvent.change(screen.getByLabelText('Trạng thái'), {target: {value: 'locked'}});
        await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('admin/teachers?status=locked&page=1&limit=20'));
    });

    it('locks after confirmation', async () => {
        const api = mockApi({'admin/teachers': page([T()])}, {'admin/lock_teacher/': T({locked: true, status: 'locked'})});
        renderAt(<Teachers/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Khoá tài khoản Cô Thu Hà'}));
        const dlg = screen.getByRole('dialog', {name: 'Khoá giáo viên?'});
        fireEvent.click(within(dlg).getByRole('button', {name: 'Khoá'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('admin/lock_teacher/u1'));
    });

    it('creates a teacher, validates first, then shows the temp password once', async () => {
        const api = mockApi({'admin/teachers': page([])}, {'admin/create_teacher': (_p: string, b: any) => T({name: b.name, email: b.email})});
        renderAt(<Teachers/>);
        fireEvent.click((await screen.findAllByRole('button', {name: '+ Tạo giáo viên'}))[0]);
        const dlg = screen.getByRole('dialog', {name: 'Tạo tài khoản giáo viên'});
        fireEvent.click(within(dlg).getByRole('button', {name: 'Tạo tài khoản'}));
        expect(within(dlg).getByText('Nhập họ tên')).toBeTruthy();
        expect(api.post).not.toHaveBeenCalled();

        fireEvent.change(within(dlg).getByLabelText('Họ tên'), {target: {value: 'Cô Yến'}});
        fireEvent.change(within(dlg).getByLabelText('Email'), {target: {value: 'yen@vtp.vn'}});
        fireEvent.click(within(dlg).getByRole('button', {name: 'Sinh học'}));
        fireEvent.change(within(dlg).getByLabelText('Mật khẩu tạm'), {target: {value: 'Abcdefg12'}});
        fireEvent.click(within(dlg).getByRole('button', {name: 'Tạo tài khoản'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('admin/create_teacher',
            {name: 'Cô Yến', email: 'yen@vtp.vn', password: 'Abcdefg12', subjects: ['Sinh học']}));
        const shown = await screen.findByRole('dialog', {name: 'Mật khẩu tạm'});
        expect(within(shown).getByText('Abcdefg12')).toBeTruthy();
    });

    it('server error stays in the dialog', async () => {
        mockApi({'admin/teachers': page([T()])}, {'admin/create_teacher': new Error('Email exists already')});
        renderAt(<Teachers/>);
        fireEvent.click(await screen.findByRole('button', {name: '+ Tạo giáo viên'}));
        const dlg = screen.getByRole('dialog', {name: 'Tạo tài khoản giáo viên'});
        fireEvent.change(within(dlg).getByLabelText('Họ tên'), {target: {value: 'A'}});
        fireEvent.change(within(dlg).getByLabelText('Email'), {target: {value: 'a@b.vn'}});
        fireEvent.click(within(dlg).getByRole('button', {name: 'Tạo tài khoản'}));
        expect(await within(dlg).findByText('Email này đã có tài khoản')).toBeTruthy();
    });

    it('reset password shows the BE temp password with a copy button', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {clipboard: {writeText}});
        mockApi({'admin/teachers': page([T()])}, {'admin_users/reset_password/': {...T(), temp_password: 'Xy7kPq2Wmn', generated: true}});
        renderAt(<Teachers/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Đặt lại mật khẩu cho Cô Thu Hà'}));
        fireEvent.click(within(screen.getByRole('dialog', {name: 'Đặt lại mật khẩu?'})).getByRole('button', {name: 'Đặt lại'}));
        const shown = await screen.findByRole('dialog', {name: 'Mật khẩu tạm'});
        fireEvent.click(within(shown).getByRole('button', {name: 'Sao chép'}));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('Xy7kPq2Wmn'));
        expect(await within(shown).findByRole('button', {name: 'Đã sao chép'})).toBeTruthy();
    });

    it('error state with retry', async () => {
        mockApi({'admin/teachers': new Error('Chỉ Admin mới được làm thao tác này')});
        renderAt(<Teachers/>);
        expect(await screen.findByText('Không tải được danh sách giáo viên')).toBeTruthy();
        expect(screen.getByText('Chỉ Admin mới được làm thao tác này')).toBeTruthy();
    });
});
