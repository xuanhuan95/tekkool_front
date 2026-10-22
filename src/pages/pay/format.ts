/*
 * Formatting shared by the student payment screens and the Admin screens (SPT-24/23/27/47).
 * Deterministic on purpose: no toLocaleString (output differs between browsers/ICU builds)
 * and dates always shown in Vietnam time, whatever time zone the browser is in.
 */
import type {Payment, PaymentStatus} from '../../types/payment';
import type {BadgeTone} from '../../components/ui';

/** 99000 -> "99.000" (Vietnamese thousands separator). */
export function groupDigits(n?: number | null): string {
    const v = Math.round(Number(n) || 0);
    const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return v < 0 ? '-' + s : s;
}

/** 99000 -> "99.000đ" (design: no space before đ). */
export function formatMoney(n?: number | null): string {
    return groupDigits(n) + 'đ';
}

/** Price of one turn, rounded to the dong: 99.000đ / 10 -> 9.900. null when turns is 0. */
export function pricePerTurn(price: number, turns: number): number | null {
    return turns > 0 ? Math.round(price / turns) : null;
}

const VN_OFFSET_MS = 7 * 3600 * 1000;

/**
 * BE stores naive UTC (`datetime.utcnow().isoformat()`, no "Z"). Read it as UTC and shift to
 * Vietnam time; returns a Date whose getUTC* fields are the Vietnamese wall clock. null if unreadable.
 */
export function vnClock(iso?: string | null): Date | null {
    if (!iso) return null;
    const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(iso);
    const t = Date.parse(hasZone ? iso : iso + 'Z');
    return isNaN(t) ? null : new Date(t + VN_OFFSET_MS);
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** "21/10/2026" */
export function formatDate(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` : '—';
}

/** "21/10/2026 · 20:35" */
export function formatDateTime(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${formatDate(iso)} · ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` : '—';
}

/** "20:41 · 21/10" (compact, Admin tables). */
export function formatShortDateTime(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} · ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}` : '—';
}

/** "20:38:12" */
export function formatTime(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}` : '—';
}

/** "YYYY-MM-DD" (date picker value / API date) -> "21/10/2026". */
export function formatIsoDay(day?: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** Today in Vietnam as "YYYY-MM-DD". */
export function todayVn(now: Date = new Date()): string {
    const d = new Date(now.getTime() + VN_OFFSET_MS);
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

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

/** Student-facing order status (HS-LichSuMua). CANCELLED reads as failed: no money moved. */
export const ORDER_STATUS: Record<PaymentStatus, {tone: BadgeTone; label: string}> = {
    PAID: {tone: 'ok', label: 'Thành công'},
    PENDING: {tone: 'sun-strong', label: 'Đang xử lý'},
    FAILED: {tone: 'err', label: 'Thất bại'},
    CANCELLED: {tone: 'err', label: 'Thất bại'},
};

export function orderStatus(s?: string | null) {
    return ORDER_STATUS[s as PaymentStatus] || {tone: 'draft' as BadgeTone, label: s || '—'};
}

/** Message of an API error ({code, error}) or a thrown Error, with a fallback. */
export function errorText(e: unknown, fallback: string): string {
    const o = e as {error?: unknown; message?: unknown} | null;
    const msg = o && (typeof o.error === 'string' ? o.error : typeof o.message === 'string' ? o.message : '');
    return msg || fallback;
}
