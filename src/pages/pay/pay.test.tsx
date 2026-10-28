import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Api from '../../services/api';
import OutOfTurnsModal from '../../components/OutOfTurnsModal';
import PaymentResult from '../payment/PaymentResult';
import Packages from './Packages';
import PurchaseHistory, {purchaseSummary} from './PurchaseHistory';
import {errorText, formatDate, formatDateTime, formatMoney, formatShortDateTime, groupDigits, pricePerTurn, todayVn} from '../../lib/format';
import {orderStatus, orderTurns, paymentView} from './order';
import type {Payment} from '../../types/payment';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const wrap = (ui: React.ReactNode, path = '/') => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path='*' element={ui}/>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>);

/** Api.get mock by path prefix. */
const mockGet = (routes: Record<string, unknown | ((path: string) => unknown)>) =>
    vi.spyOn(Api, 'get').mockImplementation(async (path: string) => {
        const key = Object.keys(routes).find(k => path.startsWith(k));
        if (!key) throw {code: 404, error: 'no mock for ' + path};
        const v = routes[key];
        const out = typeof v === 'function' ? (v as (p: string) => unknown)(path) : v;
        if (out instanceof Error) throw out;
        return out as any;
    });

describe('format', () => {
    it('money uses dots and no space before đ', () => {
        expect(formatMoney(99000)).toBe('99.000đ');
        expect(formatMoney(1137000)).toBe('1.137.000đ');
        expect(formatMoney(0)).toBe('0đ');
        expect(formatMoney(null)).toBe('0đ');
        expect(groupDigits(-49000)).toBe('-49.000');
    });

    it('price per turn', () => {
        expect(pricePerTurn(99000, 10)).toBe(9900);
        expect(pricePerTurn(59000, 5)).toBe(11800);
        expect(pricePerTurn(249000, 30)).toBe(8300);
        expect(pricePerTurn(1000, 0)).toBeNull();
    });

    it('naive UTC from BE is shown in Vietnam time', () => {
        // 13:35 UTC = 20:35 in Vietnam
        expect(formatDateTime('2026-10-21T13:35:00')).toBe('21/10/2026 · 20:35');
        // crossing midnight: 18:00 UTC = 01:00 next day VN
        expect(formatDate('2026-10-21T18:00:00.123456')).toBe('22/10/2026');
        expect(formatShortDateTime('2026-10-21T13:41:00Z')).toBe('20:41 · 21/10');
        expect(formatDateTime(null)).toBe('—');
        expect(formatDateTime('rác')).toBe('—');
        expect(todayVn(new Date('2026-10-21T18:00:00Z'))).toBe('2026-10-22');
    });

    it('order turns come from the checkout snapshot, null for pre-SPT-21 orders', () => {
        expect(orderTurns({items: [{name: 'Gói 10', turns: 10, quantity: 1}]})).toBe(10);
        expect(orderTurns({items: [{turns: 5, quantity: 2}, {turns: 3}]})).toBe(13);
        expect(orderTurns({items: [{name: 'cũ', turns: null}]})).toBeNull();
        expect(orderTurns({items: []})).toBeNull();
    });

    it('status labels', () => {
        expect(orderStatus('PAID').label).toBe('Thành công');
        expect(orderStatus('PENDING').label).toBe('Đang xử lý');
        expect(orderStatus('FAILED').tone).toBe('err');
        expect(orderStatus('CANCELLED')).toEqual({tone: 'draft', label: 'Đã huỷ'});
        expect(orderStatus('LẠ').label).toBe('LẠ');
    });

    it('payment view follows the server status, not the URL', () => {
        expect(paymentView(null, null, false)).toBe('waiting');
        expect(paymentView({status: 'PENDING'}, null, true)).toBe('timeout');
        expect(paymentView({status: 'PAID'}, null, false)).toBe('paid');
        expect(paymentView({status: 'CANCELLED'}, null, false)).toBe('cancelled');
        expect(paymentView({status: 'FAILED'}, null, false)).toBe('failed');
        expect(paymentView({status: 'PAID'}, {code: 403}, false)).toBe('notfound');
        expect(paymentView(null, {code: 404}, false)).toBe('notfound');
        expect(paymentView(null, {code: 500}, false)).toBe('error');
        expect(paymentView(null, new TypeError('network'), false)).toBe('error');
    });

    it('error text', () => {
        expect(errorText({code: 400, error: 'Gói này đã ngừng bán'}, 'x')).toBe('Gói này đã ngừng bán');
        expect(errorText(new Error('boom'), 'x')).toBe('boom');
        expect(errorText(undefined, 'mặc định')).toBe('mặc định');
    });

    it('purchase summary counts PAID only', () => {
        const orders: Payment[] = [
            {invoice_number: 'A', status: 'PAID', items: [{turns: 10}]},
            {invoice_number: 'B', status: 'PENDING', items: [{turns: 10}]},
            {invoice_number: 'C', status: 'FAILED', items: [{turns: 5}]},
            {invoice_number: 'D', status: 'PAID', items: [{turns: 5}]},
        ];
        expect(purchaseSummary(orders)).toEqual({count: 2, turns: 15, unknown: false});
        expect(purchaseSummary([{invoice_number: 'E', status: 'PAID', items: [{turns: null}]}]).unknown).toBe(true);
    });
});

const PKGS = [
    {id: 'P5', name: 'Gói 5 lượt', turns: 5, price: 59000, description: 'Thử sức'},
    {id: 'P10', name: 'Gói 10 lượt', turns: 10, price: 99000, featured: true},
];

describe('Packages (HS-Goi)', () => {
    it('lists packages with per-turn price and links to the existing checkout route', async () => {
        mockGet({'package/list': PKGS, 'payment/wallet': {bought: 10, used: 3, remaining: 7}});
        wrap(<Packages/>, '/packages');
        await screen.findByText('Gói 10 lượt');
        expect(screen.getByText('≈ 9.900đ / lượt')).toBeTruthy();
        expect(screen.getByText('7 lượt')).toBeTruthy();
        expect(screen.getByText('Phổ biến')).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Chọn Gói 10 lượt'}).getAttribute('href')).toBe('/payment/P10');
        // the featured package gets the primary button
        expect(screen.getByRole('link', {name: 'Chọn Gói 10 lượt'}).className).toContain('vt-btn--primary');
    });

    it('shows the out-of-turns banner from ?het-luot=1', async () => {
        mockGet({'package/list': PKGS, 'payment/wallet': {bought: 0, used: 0, remaining: 0}});
        wrap(<Packages/>, '/packages?het-luot=1');
        expect(await screen.findByRole('alert')).toHaveTextContent('hết lượt');
    });

    it('empty and error states', async () => {
        mockGet({'package/list': [], 'payment/wallet': {bought: 0, used: 0, remaining: 0}});
        const {unmount} = wrap(<Packages/>, '/packages');
        await screen.findByText('Chưa có gói nào đang bán');
        unmount();
        mockGet({'package/list': () => new Error('mất mạng'), 'payment/wallet': {remaining: 0}});
        wrap(<Packages/>, '/packages');
        await screen.findByText('Không tải được danh sách gói');
        expect(screen.getByRole('button', {name: 'Thử lại'})).toBeTruthy();
    });
});

describe('PurchaseHistory (HS-LichSuMua)', () => {
    it('shows every order with status and snapshot turns', async () => {
        mockGet({'payment/history': [
            {invoice_number: 'TK1', status: 'PENDING', amount: 99000, created_at: '2026-10-21T13:35:00',
             items: [{name: 'Gói 10 lượt', turns: 10, quantity: 1}]},
            {invoice_number: 'TK2', status: 'PAID', amount: 59000, created_at: '2026-10-18T12:12:00',
             items: [{name: 'Gói 5 lượt', turns: 5, quantity: 1}]},
        ]});
        wrap(<PurchaseHistory/>, '/billing');
        await screen.findByText('Mã đơn TK1');
        expect(screen.getByText('Đã mua 1 gói · 5 lượt')).toBeTruthy();
        expect(screen.getByText('Đang xử lý')).toBeTruthy();
        expect(screen.getByText('Thành công')).toBeTruthy();
        expect(screen.getByText('+5 lượt')).toBeTruthy();
        expect(screen.getByText('21/10/2026 · 20:35')).toBeTruthy();
    });

    it('empty state links to packages', async () => {
        mockGet({'payment/history': []});
        wrap(<PurchaseHistory/>, '/billing');
        await screen.findByText('Chưa mua gói nào');
        expect(screen.getByRole('link', {name: 'Xem gói thi'}).getAttribute('href')).toBe('/packages');
    });
});

const PAID: Payment = {invoice_number: 'TK9', status: 'PAID', amount: 99000,
    items: [{target_id: 'P10', name: 'Gói 10 lượt', turns: 10, quantity: 1}]};

describe('PaymentResult (HS-ThanhToanCho / Xong)', () => {
    it('polls while PENDING, then shows the credited turns and the new balance', async () => {
        let calls = 0;
        mockGet({
            'payment/status/': () => (++calls < 2 ? {...PAID, status: 'PENDING'} : PAID),
            'payment/wallet': {bought: 17, used: 0, remaining: 17},
        });
        vi.useFakeTimers({shouldAdvanceTime: true});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9');
        await screen.findByText('Đang xác nhận thanh toán…');
        await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
        await screen.findByText('Đã cộng 10 lượt');
        expect(await screen.findByText('Bạn có 17 lượt')).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Làm đề ngay'})).toBeTruthy();
        expect((Api.get as any).mock.calls.filter((c: string[]) => c[0] === 'payment/status/TK9').length).toBe(2);
    });

    it('failed order offers retry on the same package and another package', async () => {
        mockGet({'payment/status/': {...PAID, status: 'FAILED'}});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9');
        await screen.findByText('Thanh toán chưa thành công');
        expect(screen.getByText('TK9')).toBeTruthy();
        expect(screen.getByRole('link', {name: 'Chọn gói khác'}).getAttribute('href')).toBe('/packages');
    });

    it('lookup error keeps the order code and a retry', async () => {
        let fail = true;
        mockGet({'payment/status/': () => (fail ? new Error('mất mạng') : PAID), 'payment/wallet': {remaining: 3}});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9');
        await screen.findByText('Không tra cứu được đơn');
        expect(screen.getByText('TK9')).toBeTruthy();
        fail = false;
        fireEvent.click(screen.getByRole('button', {name: 'Thử lại'}));
        await screen.findByText('Đã cộng 10 lượt');
    });

    it('?result=cancel posts payment/cancel once and shows the cancelled card, no polling', async () => {
        const post = vi.spyOn(Api, 'post').mockResolvedValue({...PAID, status: 'CANCELLED'});
        const get = mockGet({});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9&result=cancel');
        await screen.findByText('Đã huỷ thanh toán');
        expect(post).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledWith('payment/cancel/TK9');
        expect(get).not.toHaveBeenCalled();
        expect(screen.getByRole('link', {name: 'Chọn gói khác'}).getAttribute('href')).toBe('/packages');
    });

    it('?result=error with a cancelled order reads as unsuccessful', async () => {
        vi.spyOn(Api, 'post').mockResolvedValue({...PAID, status: 'CANCELLED'});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9&result=error');
        await screen.findByText('Thanh toán không thành công');
    });

    it('cancel answered PAID (SePay already took the money) shows success', async () => {
        vi.spyOn(Api, 'post').mockResolvedValue(PAID);
        mockGet({'payment/wallet': {bought: 10, used: 0, remaining: 10}});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9&result=cancel');
        await screen.findByText('Đã cộng 10 lượt');
    });

    it.each([403, 404])('status %i (not my order / unknown) shows only the not-found card', async code => {
        mockGet({'payment/status/': () => { throw {code, error: 'Not your payment'}; }});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9');
        await screen.findByText('Không tìm thấy đơn thanh toán này');
        expect(screen.queryByText(/lượt sẽ được cộng/)).toBeNull();
        expect(screen.queryByText(/Not your payment/)).toBeNull();
        expect(screen.getByRole('link', {name: 'Về trang Gói thi'}).getAttribute('href')).toBe('/packages');
    });

    it('cancel 403 (not my order) shows the not-found card, page does not crash', async () => {
        vi.spyOn(Api, 'post').mockRejectedValue({code: 403, error: 'Không có quyền'});
        wrap(<PaymentResult/>, '/payment/result?inv=TK9&result=cancel');
        await screen.findByText('Không tìm thấy đơn thanh toán này');
    });

    it('CANCELLED from payment/status (no ?result) stops polling', async () => {
        const get = mockGet({'payment/status/': {...PAID, status: 'CANCELLED'}});
        const post = vi.spyOn(Api, 'post');
        wrap(<PaymentResult/>, '/payment/result?inv=TK9');
        await screen.findByText('Đã huỷ thanh toán');
        await new Promise(r => setTimeout(r, 2200));
        expect(get).toHaveBeenCalledTimes(1);
        expect(post).not.toHaveBeenCalled();
    });

    it('missing ?inv is an error, no request', async () => {
        const get = mockGet({});
        wrap(<PaymentResult/>, '/payment/result');
        await screen.findByText('Không tra cứu được đơn');
        expect(get).not.toHaveBeenCalled();
    });
});

describe('OutOfTurnsModal (HS-HetLuot)', () => {
    it('offers "Để sau" and "Xem gói thi"', async () => {
        const onClose = vi.fn();
        wrap(<OutOfTurnsModal open onClose={onClose}/>);
        expect(screen.getByRole('dialog', {name: 'Bạn đã hết lượt thi'})).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: 'Để sau'}));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(screen.getByRole('button', {name: 'Xem gói thi'})).toBeTruthy();
    });
});
