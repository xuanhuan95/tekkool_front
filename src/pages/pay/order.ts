/* Order helpers of the payment screens (HS-LichSuMua, Admin). Generic formatting lives in src/lib/format.ts. */
import type {Payment, PaymentStatus} from '../../types/payment';
import type {BadgeTone} from '../../components/ui';

/**
 * Turns an order added, from the snapshot taken at checkout (OrderItem.turns, SPT-21).
 * null when any item has no snapshot (orders older than SPT-21): we do not guess from the
 * package's CURRENT turns, which Admin may have changed since.
 */
export function orderTurns(p: Pick<Payment, 'items'>): number | null {
    const items = p.items || [];
    if (!items.length) return null;
    let sum = 0;
    for (const it of items) {
        if (it.turns == null) return null;
        sum += it.turns * (it.quantity || 1);
    }
    return sum;
}

/** "Gói 10 lượt" — names of what was bought, as snapshotted on the order. */
export function orderName(p: Pick<Payment, 'items'>): string {
    return (p.items || []).map(i => i.name).filter(Boolean).join(', ') || 'Gói thi';
}

/** Student-facing order status (HS-LichSuMua). CANCELLED (student cancelled on SePay, SPT-58) is neutral grey. */
export const ORDER_STATUS: Record<PaymentStatus, {tone: BadgeTone; label: string}> = {
    PAID: {tone: 'ok', label: 'Thành công'},
    PENDING: {tone: 'sun-strong', label: 'Đang xử lý'},
    FAILED: {tone: 'err', label: 'Thất bại'},
    CANCELLED: {tone: 'draft', label: 'Đã huỷ'},
};

export function orderStatus(s?: string | null) {
    return ORDER_STATUS[s as PaymentStatus] || {tone: 'draft' as BadgeTone, label: s || '—'};
}

/** Which card /payment/result shows. Driven by the status the SERVER returned, never by `?result=` (SPT-58). */
export type PaymentView = 'error' | 'paid' | 'cancelled' | 'failed' | 'timeout' | 'waiting';

export function paymentView(payment: Pick<Payment, 'status'> | null, error: unknown, timedOut: boolean): PaymentView {
    if (error) return 'error';
    if (!payment || payment.status === 'PENDING') return timedOut ? 'timeout' : 'waiting';
    if (payment.status === 'PAID') return 'paid';
    if (payment.status === 'CANCELLED') return 'cancelled';
    return 'failed';
}
