import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Transactions, {timelineText} from './Transactions';
import StudentDetail from './StudentDetail';
import Users from './Users';
import {mockApi, renderAt} from './testutil';

afterEach(() => vi.restoreAllMocks());

const U = (over: object = {}) => ({
    id: 'u1', name: 'Minh Anh', email: 'minhanh@x.vn', role: 'student', group: 'student', locked: false,
    must_change_password: false, status: 'active', created_at: '2026-09-08T03:00:00', last_login_at: '2026-10-21T13:41:00',
    turns_remaining: 7, manageable: true, ...over,
});
const LIST = {items: [U(), U({id: 'u2', name: 'Đỗ Minh Khoa', locked: true, status: 'locked', turns_remaining: 5}),
    U({id: 'a1', name: 'Quản trị viên', role: 'admin', group: 'admin', turns_remaining: null, manageable: false})],
    total: 1284, page: 1, limit: 20, counts: {student: 1284, teacher: 6, admin: 1}};
const DETAIL = {...U(), turns: {bought: 15, used: 8, remaining: 7},
    orders: [{invoice_number: 'TK26', status: 'PAID', amount: 99000, created_at: '2026-10-02T03:00:00',
        items: [{name: 'Gói 10 lượt', turns: 10, quantity: 1}]}],
    order_counts: {paid: 1, pending: 0, failed: 0}, submissions: {count: 8, exams: 6, last_at: null}};

describe('Users = Học sinh (AD-NguoiDung)', () => {
    it('lists students only: total line, no role column, arrow link to the detail screen, no lock in the row', async () => {
        const api = mockApi({'admin_users/list': LIST});
        renderAt(<Users/>, '/manage/users');
        const table = within(await screen.findByRole('table'));
        expect(table.getByText('Minh Anh')).toBeTruthy();
        expect(screen.getByText('Tổng 1.284 học sinh')).toBeTruthy();
        expect(screen.getByText('Hiển thị 1–20 / 1.284 học sinh')).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('admin_users/list?group=student&page=1&limit=20');
        expect(table.queryByText('Vai trò')).toBeNull();
        expect(screen.queryByRole('tab')).toBeNull();
        expect(screen.queryByRole('button', {name: /Khoá/})).toBeNull();
        const link = screen.getByRole('link', {name: 'Xem chi tiết Minh Anh'});
        expect(link.getAttribute('href')).toBe('/manage/users/u1');
        expect(link.getAttribute('data-tip')).toBe('Xem chi tiết Minh Anh');
        fireEvent.click(screen.getByRole('button', {name: 'Sau →'}));
        await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('admin_users/list?group=student&page=2&limit=20'));
    });

    it('error state', async () => {
        mockApi({'admin_users/list': new Error('Chỉ Admin mới được làm thao tác này')});
        renderAt(<Users/>, '/manage/users');
        expect(await screen.findByText('Không tải được danh sách học sinh')).toBeTruthy();
    });
});

const renderDetail = () => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={['/manage/users/u1']}>
            <Routes><Route path='/manage/users/:id' element={<StudentDetail/>}/></Routes>
        </MemoryRouter>
    </QueryClientProvider>);

describe('StudentDetail (AD-HocSinhChiTiet)', () => {
    it('shows turns and orders; reset password shows the temp password once', async () => {
        const api = mockApi({'admin_users/detail/': DETAIL},
            {'admin_users/reset_password/': {...U(), temp_password: 'Kp7wQm3Zxa', generated: true}});
        renderDetail();
        const aside = within(await screen.findByRole('complementary', {name: 'Chi tiết học sinh'}));
        expect(aside.getByText('15')).toBeTruthy();
        expect(aside.getByText('đã dùng')).toBeTruthy();
        expect(aside.getByText('Gói 10 lượt · 99.000đ')).toBeTruthy();
        expect(aside.getByText('8 bài · 6 đề')).toBeTruthy();
        fireEvent.click(aside.getByRole('button', {name: 'Đặt lại mật khẩu'}));
        fireEvent.click(within(screen.getByRole('dialog', {name: 'Đặt lại mật khẩu?'})).getByRole('button', {name: 'Đặt lại'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('admin_users/reset_password/u1', {}));
        expect(within(await screen.findByRole('dialog', {name: 'Mật khẩu tạm'})).getByText('Kp7wQm3Zxa')).toBeTruthy();
    });

    it('lock lives here and asks first', async () => {
        const api = mockApi({'admin_users/detail/': DETAIL}, {'admin_users/lock/': U({locked: true})});
        renderDetail();
        fireEvent.click(await screen.findByRole('button', {name: 'Khoá tài khoản'}));
        expect(api.post).not.toHaveBeenCalled();
        fireEvent.click(within(screen.getByRole('dialog', {name: 'Khoá tài khoản?'})).getByRole('button', {name: 'Khoá'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('admin_users/lock/u1'));
    });
});

const TX = (over: object = {}) => ({invoice_number: 'TK31', sepay_order_id: 'SP-1', sepay_transaction_id: 'T1',
    user: {id: 'u1', name: 'Nguyễn Hà My', email: 'hm@x.vn'}, packages: ['Gói 10 lượt'], amount: 99000, received: 99000,
    status: 'paid', db_status: 'PAID', created_at: '2026-10-21T13:38:12', updated_at: '2026-10-21T13:40:57', ...over});
const TXLIST = {items: [TX(), TX({invoice_number: 'TK30', status: 'mismatch', amount: 249000, received: 200000})],
    total: 2, page: 1, limit: 20,
    stats: {paid: {count: 44, amount: 4776000}, pending: {count: 1, amount: 59000}, failed: {count: 3, amount: 0}, mismatch: {count: 1, amount: 249000}}};
const DETAILTX = {...TX({invoice_number: 'TK30', status: 'mismatch', amount: 249000, received: 200000}), turns: 0, ipn_count: 1, can_reconcile: true,
    timeline: [{event: 'created', at: '2026-10-21T12:55:00'}, {event: 'sepay', at: '2026-10-21T12:57:00', received: 200000}],
    raw_ipn: {notification_type: 'ORDER_PAID'},
    anomalies: [{type: 'amount_mismatch', message: 'nhận 200000 đ / đơn 249000 đ — thiếu 49000 đ, chưa cộng lượt'}]};

describe('Transactions (AD-GiaoDich)', () => {
    it('lists orders with stats; opens the detail timeline; reconcile button is shown', async () => {
        mockApi({'admin_revenue/transactions': TXLIST, 'admin_revenue/transaction/': DETAILTX});
        renderAt(<Transactions/>, '/manage/transactions');
        await screen.findByText('44 đơn');
        expect(screen.getByText('4.776.000đ đã nhận')).toBeTruthy();
        expect(within(screen.getByRole('table')).getByText('Lệch tiền')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: 'Xem đơn TK30'}));
        const aside = within(await screen.findByRole('complementary', {name: 'Chi tiết đơn'}));
        expect(aside.getByText('SePay báo về')).toBeTruthy();
        expect(aside.getByText(/thiếu 49\.000đ/)).toBeTruthy();
        expect(aside.getByRole('alert')).toHaveTextContent('Lệch số tiền');
        expect(aside.getByRole('button', {name: 'Đối soát lại'})).toBeEnabled();
    });

    const openTK30 = async (detail: object, post: unknown) => {
        const api = mockApi({'admin_revenue/transactions': TXLIST, 'admin_revenue/transaction/': detail},
            {'admin_revenue/reconcile_order/': post});
        renderAt(<Transactions/>, '/manage/transactions');
        await screen.findByText('44 đơn');
        fireEvent.click(screen.getByRole('button', {name: 'Xem đơn TK30'}));
        const aside = within(await screen.findByRole('complementary', {name: 'Chi tiết đơn'}));
        return {api, aside};
    };

    it('reconcile: shows the BE message by result and redraws the order from the response', async () => {
        const paid = {...DETAILTX, status: 'paid', can_reconcile: false, turns: 10, anomalies: [],
            timeline: [...DETAILTX.timeline, {event: 'reconcile', at: '2026-10-21T13:00:00', source: 'admin_reconcile', result: 'credited',
                message: 'đã cộng', actor: {id: 'a1', name: 'Quản trị', email: 'a@x.vn'}, status_before: 'PENDING', status_after: 'PAID',
                changed: true, amount: 249000, transaction_id: null}]};
        const {api, aside} = await openTK30(DETAILTX, {result: 'credited', message: 'SePay xác nhận đã nhận 249.000 đ. Đã cộng 10 lượt.',
            status_before: 'PENDING', status_after: 'PAID', sepay: null, transaction: paid});
        fireEvent.click(aside.getByRole('button', {name: 'Đối soát lại'}));
        const box = await aside.findByRole('status');
        expect(box).toHaveTextContent('SePay xác nhận đã nhận 249.000 đ. Đã cộng 10 lượt.');
        expect(box.className).toContain('vt-mg-result--ok');
        expect(api.post).toHaveBeenCalledWith('admin_revenue/reconcile_order/TK30', {});
        expect(await aside.findByText('Admin đối soát lại')).toBeTruthy();
        expect(aside.queryByRole('button', {name: /Đối soát lại/})).toBeNull();   // can_reconcile=false → hidden
        expect(api.get.mock.calls.filter(c => String(c[0]).startsWith('admin_revenue/transaction/')).length).toBe(1);
    });

    it.each([['sepay_error', 'err'], ['not_found_on_sepay', 'warn'], ['already_paid', 'info']])('reconcile result %s → tone %s', async (result, tone) => {
        const {aside} = await openTK30(DETAILTX, {result, message: 'msg ' + result, status_before: 'PENDING', status_after: 'PENDING',
            sepay: null, transaction: DETAILTX});
        fireEvent.click(aside.getByRole('button', {name: 'Đối soát lại'}));
        expect((await aside.findByRole('status')).className).toContain('vt-mg-result--' + tone);
    });

    it('reconcile 429: message shown, button counts down retry_after and is disabled', async () => {
        const {aside} = await openTK30(DETAILTX, () => { throw {code: 429, message: 'Đơn vừa được đối soát', retry_after: 5}; });
        fireEvent.click(aside.getByRole('button', {name: 'Đối soát lại'}));
        expect(await aside.findByText('Đơn vừa được đối soát')).toBeTruthy();
        const btn = aside.getByRole('button', {name: /Đối soát lại \(5s\)/});
        expect(btn).toBeDisabled();
    });

    it('hides the button when can_reconcile is false; double_payment label', async () => {
        const {aside} = await openTK30({...DETAILTX, can_reconcile: false}, {});
        expect(aside.queryByRole('button', {name: /Đối soát lại/})).toBeNull();
        expect(timelineText({event: 'cancel', at: null, source: 'cancel', result: null, message: 'x', actor: null, status_before: null,
            status_after: null, changed: false, amount: null, transaction_id: null}, 1).title).toBe('Đơn bị huỷ');
    });

    it('filters go to the API', async () => {
        const api = mockApi({'admin_revenue/transactions': TXLIST});
        renderAt(<Transactions/>, '/manage/transactions');
        await screen.findByText('44 đơn');
        fireEvent.change(screen.getByLabelText('Trạng thái'), {target: {value: 'mismatch'}});
        // Date typed Vietnamese style (DateField): dd/mm/yyyy → ISO to the API.
        fireEvent.change(screen.getByLabelText('Từ ngày'), {target: {value: '15/10/2026'}});
        await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(
            'admin_revenue/transactions?status=mismatch&from=2026-10-15&page=1&limit=20'));
    });

    it('reconcile tab lists anomalies by type', async () => {
        const api = mockApi({'admin_revenue/reconcile': {items: [{type: 'pending_stale', invoice_number: 'TK29', status: 'pending',
            amount: 59000, received: null, user: null, created_at: '2026-10-21T12:40:00', message: 'Chờ webhook quá 30 phút'}],
            total: 1, counts: {pending_stale: 1}}});
        renderAt(<Transactions/>, '/manage/transactions?tab=reconcile');
        expect(await screen.findByText('Chờ webhook quá 30 phút')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: 'Chờ webhook quá lâu (1)'}));
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('admin_revenue/reconcile?type=pending_stale'));
    });

    it('timeline wording', () => {
        expect(timelineText({event: 'sepay', at: null, received: 99000}, 99000).note).toBe('99.000đ, khớp số tiền đơn');
        expect(timelineText({event: 'credited', at: null, turns: 10}, 99000).title).toBe('Cộng 10 lượt');
        expect(timelineText({event: 'sepay', at: null, received: null}, 1).note).toMatch(/chưa có bằng chứng/);
    });
});
