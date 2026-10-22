/* Pure helpers for the revenue bar chart (AD-DoanhThu). Kept apart so they can be tested without the DOM. */
import type {Period} from '../../queries/manage';
import {groupDigits} from '../../lib/format';

/** Axis for values in thousands: 4 equal steps of a "nice" size (1, 2, 2.5, 3, 5 × 10^k) covering max. */
export function niceScale(max: number): {top: number; ticks: number[]} {
    if (!(max > 0)) return {top: 4, ticks: [4, 3, 2, 1, 0]};
    const rough = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = [1, 2, 2.5, 3, 5, 10].map(m => m * mag).find(s => s >= rough)!;
    const top = step * 4;
    return {top, ticks: [4, 3, 2, 1, 0].map(i => +(step * i).toFixed(6))};
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Label under a bar. day: hour key 0–23; week: "T5 15/10"; month: "15"; all: "10/2026". today -> "Hôm nay" (week). */
export function bucketLabel(period: Period, key: number | string, today: string): string {
    if (period === 'day') return key + 'h';
    const k = String(key);
    if (period === 'all') {
        const m = /^(\d{4})-(\d{2})$/.exec(k);
        return m ? `${m[2]}/${m[1]}` : k;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
    if (!m) return k;
    if (period === 'week') {
        if (k === today) return 'Hôm nay';
        const wd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
        return `${WEEKDAY[wd]} ${m[3]}/${m[2]}`;
    }
    return String(+m[3]);
}

/** Bucket key that is still running (dashed bar): today's date / current hour / current month. */
export function currentKey(period: Period, today: string, hour: number): string | number | null {
    if (period === 'day') return hour;
    if (period === 'all') return today.slice(0, 7);
    return today;
}

/** Thousands, as the design writes them: 1137000 -> "1.137". */
export function thousands(n: number): string {
    return groupDigits(Math.round(n / 1000));
}

/** "tăng 12% so với tuần trước" — null when there is nothing to compare. */
export function changeText(pct: number | null, period: Period): {text: string; dir: 'up' | 'down' | 'flat'} | null {
    if (pct === null || period === 'all') return null;
    const prev = {day: 'hôm trước', week: 'tuần trước', month: 'tháng trước'}[period];
    const v = String(Math.abs(pct)).replace('.', ',');
    if (pct > 0) return {text: `tăng ${v}% so với ${prev}`, dir: 'up'};
    if (pct < 0) return {text: `giảm ${v}% so với ${prev}`, dir: 'down'};
    return {text: `bằng ${prev}`, dir: 'flat'};
}

/** Move the anchor date one period back/forward ('YYYY-MM-DD'). */
export function shiftAnchor(period: Period, anchor: string, dir: -1 | 1): string {
    const [y, m, d] = anchor.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (period === 'day') dt.setUTCDate(dt.getUTCDate() + dir);
    else if (period === 'week') dt.setUTCDate(dt.getUTCDate() + 7 * dir);
    else if (period === 'month') { dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + dir); }
    return dt.toISOString().slice(0, 10);
}
