import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import Api from '../../services/api';
import Payment from './Payment';

// Màn ĐẨY TIỀN đi. Hỏng ở đây là học sinh bấm Thanh toán rồi SePay từ chối:
//   - đổi thứ tự field  = chữ ký BE đã ký không còn khớp -> SePay trả lỗi
//   - gửi thiếu field   = cũng hỏng chữ ký, cùng hậu quả
//   - GET thay vì POST  = SePay không nhận
//   - bấm hai lần       = hai đơn cho một lần mua

const GOI = {id: 'P1', name: 'Nâng cao', turns: 10, price: 200000, description: 'Mười lượt'};

// Thứ tự này KHÔNG phải alphabet — cố ý, để test đỏ nếu ai sort lại.
const FIELDS: Array<[string, string]> = [
    ['operation', 'PURCHASE'],
    ['payment_method', 'BANK_TRANSFER'],
    ['order_invoice_number', 'TK123'],
    ['order_amount', '200000'],
    ['currency', 'VND'],
    ['merchant', 'SP-TEST'],
    ['signature', 'chu-ky-da-ky'],
];

let daSubmit = 0;
let formCuoi: HTMLFormElement | null = null;

beforeEach(() => {
    daSubmit = 0;
    formCuoi = null;
    // jsdom chưa cài submit() -> tự gắn, đồng thời chộp lại form để soi.
    HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
        daSubmit++;
        formCuoi = this;
    };
    vi.spyOn(Api, 'get').mockResolvedValue([GOI] as any);
    vi.spyOn(Api, 'post').mockResolvedValue(
        {action_url: 'https://pay-sandbox.sepay.vn/v1/checkout/init', fields: FIELDS} as any);
});

afterEach(() => vi.restoreAllMocks());

const mo = () => render(
    <MemoryRouter initialEntries={['/payment/P1']}>
        <Routes><Route path='/payment/:packageId' element={<Payment/>}/></Routes>
    </MemoryRouter>);

/** Các field trong form đã submit, theo đúng thứ tự DOM. */
const fieldsDaGui = (): Array<[string, string]> =>
    Array.from(formCuoi!.querySelectorAll('input')).map(
        i => [i.name, i.value] as [string, string]);

const bamThanhToan = async () => {
    mo();
    await screen.findByText('Nâng cao');
    fireEvent.click(screen.getByText('Thanh toán').closest('button')!);
    await waitFor(() => expect(daSubmit).toBe(1));
};

describe('Payment — đẩy đơn sang SePay', () => {
    it('hiện đúng gói trước khi trả tiền', async () => {
        mo();
        await screen.findByText('Nâng cao');
        expect(screen.getByText('10 lượt')).toBeTruthy();
        // toLocaleString('vi-VN') ra '200.000 đ'
        expect(screen.getByText(/200[.,]000\s*đ/)).toBeTruthy();
    });

    it('giữ NGUYÊN thứ tự field — sắp lại là hỏng chữ ký', async () => {
        await bamThanhToan();
        expect(fieldsDaGui()).toEqual(FIELDS);
    });

    it('gửi đủ mọi field BE trả về, không bỏ sót cái nào', async () => {
        await bamThanhToan();
        expect(fieldsDaGui().length).toBe(FIELDS.length);
        // signature mà rụng thì SePay từ chối ngay.
        expect(fieldsDaGui().some(([k]) => k === 'signature')).toBe(true);
    });

    it('POST sang đúng action_url, không phải GET', async () => {
        await bamThanhToan();
        expect(formCuoi!.method.toUpperCase()).toBe('POST');
        expect(formCuoi!.action).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    });

    it('gửi package_id, KHÔNG gửi giá — giá phải do BE quyết', async () => {
        await bamThanhToan();
        const [duong, body] = (Api.post as any).mock.calls[0];
        expect(duong).toBe('payment/checkout');
        expect(body).toEqual({package_id: 'P1'});
        expect(JSON.stringify(body)).not.toMatch(/price|amount/i);
    });

    it('bấm liên tục chỉ tạo MỘT đơn', async () => {
        mo();
        await screen.findByText('Nâng cao');
        const nut = screen.getByText('Thanh toán').closest('button')!;
        fireEvent.click(nut);
        fireEvent.click(nut);
        fireEvent.click(nut);
        await waitFor(() => expect(daSubmit).toBe(1));
        expect((Api.post as any).mock.calls.length).toBe(1);
    });

    it('checkout lỗi thì báo người dùng, không im lặng đẩy đi', async () => {
        (Api.post as any).mockRejectedValue({error: 'Gói này đã ngừng bán'});
        mo();
        await screen.findByText('Nâng cao');
        fireEvent.click(screen.getByText('Thanh toán').closest('button')!);
        await screen.findByText('Gói này đã ngừng bán');
        expect(daSubmit).toBe(0);
        // Báo lỗi xong phải bấm lại được, không kẹt ở trạng thái loading.
        expect(screen.getByText('Thanh toán').closest('button')!
            .hasAttribute('disabled')).toBe(false);
    });

    it('gói không tồn tại thì báo, không hiện nút trả tiền', async () => {
        (Api.get as any).mockResolvedValue([]);
        mo();
        await screen.findByText('Không tìm thấy gói này');
        expect(screen.queryByText('Thanh toán')).toBeNull();
    });
});
