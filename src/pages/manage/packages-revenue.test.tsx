import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';

import AdminPackages, {draftOf, moveId, parseMoney, toInput, validatePackage} from './AdminPackages';
import Revenue, {periodTitle} from './Revenue';
import {bucketLabel, changeText, currentKey, niceScale, shiftAnchor, thousands} from './chart';
import {mockApi, renderAt} from './testutil';

afterEach(() => vi.restoreAllMocks());

const PKGS = [
    {id: 'p5', name: 'Gói 5 lượt', turns: 5, price: 59000, description: '', active: true, featured: false, order: 1, sold: 128},
    {id: 'p10', name: 'Gói 10 lượt', turns: 10, price: 99000, description: 'Đủ 2–3 môn', active: true, featured: true, order: 2, sold: 342},
    {id: 'p3', name: 'Gói thử 3 lượt', turns: 3, price: 39000, description: '', active: false, featured: false, order: 3, sold: 0},
];

describe('package form logic', () => {
    it('parses money typed with dots', () => {
        expect(parseMoney('99.000')).toBe(99000);
        expect(parseMoney('99000đ')).toBe(99000);
        expect(parseMoney('')).toBeNaN();
    });

    it('validates like the BE', () => {
        const ok = {name: 'Gói 10', turns: '10', price: '99.000', description: '', order: '', active: true, featured: false};
        expect(validatePackage(ok)).toEqual({});
        expect(Object.keys(validatePackage({...ok, name: '  '}))).toEqual(['name']);
        expect(Object.keys(validatePackage({...ok, turns: '0'}))).toEqual(['turns']);
        expect(Object.keys(validatePackage({...ok, turns: '1001'}))).toEqual(['turns']);
        expect(Object.keys(validatePackage({...ok, turns: '2.5'}))).toEqual(['turns']);
        expect(Object.keys(validatePackage({...ok, price: '100.000.001'}))).toEqual(['price']);
        expect(Object.keys(validatePackage({...ok, order: '-1'}))).toEqual(['order']);
    });

    it('round-trips a package into the request body', () => {
        expect(toInput(draftOf(PKGS[1] as any))).toEqual({name: 'Gói 10 lượt', turns: 10, price: 99000,
            description: 'Đủ 2–3 môn', order: 2, active: true, featured: true});
        expect(toInput(draftOf())).not.toHaveProperty('order');
    });

    it('moves ids', () => {
        expect(moveId(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
        expect(moveId(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    });
});

describe('AdminPackages (AD-Goi)', () => {
    it('lists all packages (hidden too) with sold count', async () => {
        const api = mockApi({'package/list': PKGS});
        renderAt(<AdminPackages/>);
        const table = within(await screen.findByRole('table'));
        expect(table.getByText('Gói 10 lượt')).toBeTruthy();
        expect(table.getByText('342')).toBeTruthy();
        expect(table.getByText('Ngừng bán')).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('package/list?all=1');
    });

    it('edits a package and shows the student preview', async () => {
        const api = mockApi({'package/list': PKGS}, {'package/update/': (_p: string, b: any) => ({...PKGS[1], ...b})});
        renderAt(<AdminPackages/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Sửa Gói 10 lượt'}));
        const form = within(screen.getByRole('region', {name: 'Sửa gói'}));
        fireEvent.change(form.getByLabelText('Giá (đ)'), {target: {value: '89.000'}});
        expect(screen.getByText('≈ 8.900đ / lượt · không hết hạn')).toBeTruthy();
        fireEvent.click(form.getByRole('button', {name: 'Lưu thay đổi'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('package/update/p10',
            expect.objectContaining({price: 89000, turns: 10, active: true, featured: true})));
    });

    it('create validates before calling the API', async () => {
        const api = mockApi({'package/list': PKGS}, {'package/create': PKGS[0]});
        renderAt(<AdminPackages/>);
        fireEvent.click(await screen.findByRole('button', {name: '+ Gói mới'}));
        const form = within(screen.getByRole('region', {name: 'Gói mới'}));
        fireEvent.click(form.getByRole('button', {name: 'Tạo gói'}));
        expect(form.getByText(/Tên gói không được trống/)).toBeTruthy();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('reorders with the arrows', async () => {
        const api = mockApi({'package/list': PKGS}, {'package/reorder': PKGS});
        renderAt(<AdminPackages/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Đưa Gói 10 lượt lên'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('package/reorder', {ids: ['p10', 'p5', 'p3']}));
    });

    it('a sold package can only be hidden', async () => {
        const api = mockApi({'package/list': PKGS}, {'package/remove/': {hidden: true, sold: 128, message: 'chỉ ẩn'}});
        renderAt(<AdminPackages/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Sửa Gói 5 lượt'}));
        fireEvent.click(within(screen.getByRole('region', {name: 'Sửa gói'})).getByRole('button', {name: 'Ngừng bán'}));
        const dlg = screen.getByRole('dialog', {name: 'Ngừng bán gói?'});
        fireEvent.click(within(dlg).getByRole('button', {name: 'Ngừng bán'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('package/remove/p5'));
    });
});

describe('chart helpers', () => {
    it('nice axis', () => {
        expect(niceScale(1137)).toEqual({top: 1200, ticks: [1200, 900, 600, 300, 0]});
        expect(niceScale(99)).toEqual({top: 100, ticks: [100, 75, 50, 25, 0]});
        expect(niceScale(0).top).toBe(4);
    });

    it('labels', () => {
        expect(bucketLabel('week', '2026-10-15', '2026-10-21')).toBe('T5 15/10');
        expect(bucketLabel('week', '2026-10-18', '2026-10-21')).toBe('CN 18/10');
        expect(bucketLabel('week', '2026-10-21', '2026-10-21')).toBe('Hôm nay');
        expect(bucketLabel('month', '2026-10-05', '2026-10-21')).toBe('5');
        expect(bucketLabel('day', 20, '2026-10-21')).toBe('20h');
        expect(bucketLabel('all', '2026-09', '2026-10-21')).toBe('09/2026');
        expect(currentKey('all', '2026-10-21', 3)).toBe('2026-10');
        expect(thousands(1137000)).toBe('1.137');
    });

    it('change text', () => {
        expect(changeText(12, 'week')).toEqual({text: 'tăng 12% so với tuần trước', dir: 'up'});
        expect(changeText(-3.5, 'month')).toEqual({text: 'giảm 3,5% so với tháng trước', dir: 'down'});
        expect(changeText(null, 'week')).toBeNull();
    });

    it('shift anchor', () => {
        expect(shiftAnchor('week', '2026-10-21', -1)).toBe('2026-10-14');
        expect(shiftAnchor('month', '2026-03-31', -1)).toBe('2026-02-01');
        expect(shiftAnchor('day', '2026-01-01', -1)).toBe('2025-12-31');
    });

    it('period title', () => {
        expect(periodTitle({period: 'week', date_from: '2026-10-19', date_to: '2026-10-25'}, '2026-10-21'))
            .toBe('Tuần này · 19/10 – 25/10/2026');
        expect(periodTitle({period: 'week', date_from: '2026-10-12', date_to: '2026-10-18'}, '2026-10-21'))
            .toBe('Tuần · 12/10 – 18/10/2026');
        expect(periodTitle({period: 'all', date_from: null, date_to: null}, '2026-10-21')).toBe('Toàn bộ thời gian');
    });
});

const SUMMARY = {
    period: 'week', date_from: '2026-10-19', date_to: '2026-10-25', revenue: 4776000, prev_revenue: 4264000, change_pct: 12,
    orders: {paid: 44, pending: 1, failed: 3, mismatch: 1}, turns_sold: 500, buyers: 38,
    series: [{key: '2026-10-19', revenue: 1137000}, {key: '2026-10-20', revenue: 509000}, {key: '2026-10-21', revenue: 0}],
    by_package: [{package_id: 'p10', name: 'Gói 10 lượt', orders: 26, quantity: 26, revenue: 2574000}],
};
const TX = {items: [{invoice_number: 'TK1', sepay_order_id: null, sepay_transaction_id: null,
    user: {id: 'u1', name: 'Nguyễn Hà My', email: 'hm@x.vn'}, packages: ['Gói 10 lượt'], amount: 99000, received: 99000,
    status: 'paid', db_status: 'PAID', created_at: '2026-10-21T13:41:00', updated_at: null}],
    total: 49, page: 1, limit: 6, stats: {}};

describe('Revenue (AD-DoanhThu)', () => {
    it('shows totals, chart, orders by package and recent orders', async () => {
        const api = mockApi({'admin_revenue/summary': SUMMARY, 'admin_revenue/transactions': TX});
        renderAt(<Revenue/>);
        expect(await screen.findByText('4.776.000đ')).toBeTruthy();
        expect(screen.getByText('tăng 12% so với tuần trước')).toBeTruthy();
        expect(screen.getByText('1 đang xử lý · 1 lệch tiền · 3 thất bại')).toBeTruthy();
        expect(screen.getByText('500 lượt')).toBeTruthy();
        expect(screen.getByRole('img', {name: /cao nhất T2 19\/10 với 1\.137\.000đ/})).toBeTruthy();
        expect(screen.getByText('26 đơn · 2.574.000đ')).toBeTruthy();
        expect(await screen.findByText('1 / 49 đơn trong kỳ')).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('admin_revenue/transactions?from=2026-10-19&to=2026-10-25&limit=6');
    });

    it('switching period asks the BE for that period', async () => {
        const api = mockApi({'admin_revenue/summary': SUMMARY, 'admin_revenue/transactions': TX});
        renderAt(<Revenue/>);
        await screen.findByText('4.776.000đ');
        fireEvent.click(screen.getByRole('tab', {name: 'Tháng'}));
        await waitFor(() => expect(api.get.mock.calls.some(c => String(c[0]).startsWith('admin_revenue/summary?period=month'))).toBe(true));
    });

    it('error state', async () => {
        mockApi({'admin_revenue/summary': new Error('Chỉ Admin mới được làm thao tác này')});
        renderAt(<Revenue/>);
        expect(await screen.findByText('Không tải được doanh thu')).toBeTruthy();
    });
});
