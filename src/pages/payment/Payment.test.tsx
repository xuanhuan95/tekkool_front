import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import Api from '../../services/api';
import Payment from './Payment';

// The screen that SENDS MONEY out. A break here means the student clicks Pay and SePay rejects it:
//   - reordered fields  = the signature the BE signed no longer matches -> SePay errors
//   - missing field     = also breaks the signature, same result
//   - GET instead of POST = SePay does not accept it
//   - double click      = two orders for one purchase

const PACKAGE = {id: 'P1', name: 'Nâng cao', turns: 10, price: 200000, description: 'Mười lượt'};

// This order is NOT alphabetical — on purpose, so the test goes red if anyone sorts it.
const FIELDS: Array<[string, string]> = [
    ['operation', 'PURCHASE'],
    ['payment_method', 'BANK_TRANSFER'],
    ['order_invoice_number', 'TK123'],
    ['order_amount', '200000'],
    ['currency', 'VND'],
    ['merchant', 'SP-TEST'],
    ['signature', 'chu-ky-da-ky'],
];

let submitCount = 0;
let lastForm: HTMLFormElement | null = null;

beforeEach(() => {
    submitCount = 0;
    lastForm = null;
    // jsdom has not implemented submit() -> attach our own and capture the form to inspect.
    HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
        submitCount++;
        lastForm = this;
    };
    vi.spyOn(Api, 'get').mockResolvedValue([PACKAGE] as any);
    vi.spyOn(Api, 'post').mockResolvedValue(
        {action_url: 'https://pay-sandbox.sepay.vn/v1/checkout/init', fields: FIELDS} as any);
});

afterEach(() => vi.restoreAllMocks());

const renderPage = () => render(
    <MemoryRouter initialEntries={['/payment/P1']}>
        <Routes><Route path='/payment/:packageId' element={<Payment/>}/></Routes>
    </MemoryRouter>);

/** Fields in the submitted form, in exact DOM order. */
const submittedFields = (): Array<[string, string]> =>
    Array.from(lastForm!.querySelectorAll('input')).map(
        i => [i.name, i.value] as [string, string]);

const clickPay = async () => {
    renderPage();
    await screen.findByText('Nâng cao');
    fireEvent.click(screen.getByText('Thanh toán').closest('button')!);
    await waitFor(() => expect(submitCount).toBe(1));
};

describe('Payment — pushing the order to SePay', () => {
    it('shows the right package before paying', async () => {
        renderPage();
        await screen.findByText('Nâng cao');
        expect(screen.getByText('10 lượt')).toBeTruthy();
        // toLocaleString('vi-VN') gives '200.000 đ'
        expect(screen.getByText(/200[.,]000\s*đ/)).toBeTruthy();
    });

    it('keeps field order EXACTLY — reordering breaks the signature', async () => {
        await clickPay();
        expect(submittedFields()).toEqual(FIELDS);
    });

    it('sends every field the BE returned, none dropped', async () => {
        await clickPay();
        expect(submittedFields().length).toBe(FIELDS.length);
        // If signature is dropped, SePay rejects immediately.
        expect(submittedFields().some(([k]) => k === 'signature')).toBe(true);
    });

    it('POSTs to the exact action_url, not GET', async () => {
        await clickPay();
        expect(lastForm!.method.toUpperCase()).toBe('POST');
        expect(lastForm!.action).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    });

    it('sends package_id, NOT the price — the BE must decide the price', async () => {
        await clickPay();
        const [path, body] = (Api.post as any).mock.calls[0];
        expect(path).toBe('payment/checkout');
        expect(body).toEqual({package_id: 'P1'});
        expect(JSON.stringify(body)).not.toMatch(/price|amount/i);
    });

    it('rapid clicks create only ONE order', async () => {
        renderPage();
        await screen.findByText('Nâng cao');
        const button = screen.getByText('Thanh toán').closest('button')!;
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);
        await waitFor(() => expect(submitCount).toBe(1));
        expect((Api.post as any).mock.calls.length).toBe(1);
    });

    it('on checkout error, tells the user instead of silently pushing on', async () => {
        (Api.post as any).mockRejectedValue({error: 'Gói này đã ngừng bán'});
        renderPage();
        await screen.findByText('Nâng cao');
        fireEvent.click(screen.getByText('Thanh toán').closest('button')!);
        await screen.findByText('Gói này đã ngừng bán');
        expect(submitCount).toBe(0);
        // After the error is shown the button must be clickable again, not stuck loading.
        expect(screen.getByText('Thanh toán').closest('button')!
            .hasAttribute('disabled')).toBe(false);
    });

    it('unknown package shows an error, no pay button', async () => {
        (Api.get as any).mockResolvedValue([]);
        renderPage();
        await screen.findByText('Không tìm thấy gói này');
        expect(screen.queryByText('Thanh toán')).toBeNull();
    });
});
