/*
 * ONE place for number / money / date / text formatting of the new screens (HS, payment, Admin).
 * PM 22/10: Vietnamese decimal comma (7,25; ranking points 1 decimal 17,3), money 99.000đ, dates in
 * Vietnam time whatever the browser's time zone. Deterministic on purpose: no toLocaleString (output
 * differs between browsers/ICU builds).
 * Domain helpers stay with their screens (orders: pages/pay/order.ts; exam review: exam/submissionView.ts).
 */

// ---------------------------------------------------------------- numbers / scores

/** 0.25 → "0,25"; 1.5 → "1,5"; 2 → "2" (at most `digits` decimals, trailing zeros dropped). */
export function formatDecimal(n: number, digits = 2): string {
    const r = Math.round(n * 10 ** digits) / 10 ** digits;
    return String(r).replace('.', ',');
}

/** Score on the 10-point scale rounded to 2 decimals; null when there is no score or no max. */
export function score10(score: number | null | undefined, max: number | null | undefined): number | null {
    if (score == null || !max || max <= 0) return null;
    return Math.round(score / max * 1000) / 100;
}

/** Scores always with 2 decimals, like the design: 7,25 · 6,50 · 10,00. "—" when missing. */
export function formatScore(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}

/** Ranking points: 1 decimal — 86,5 · 71,0 · 17,3. */
export function formatPoints(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

// ---------------------------------------------------------------- money

/** 99000 → "99.000" (Vietnamese thousands separator). */
export function groupDigits(n?: number | null): string {
    const v = Math.round(Number(n) || 0);
    const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return v < 0 ? '-' + s : s;
}

/** 99000 → "99.000đ" (design: no space before đ). */
export function formatMoney(n?: number | null): string {
    return groupDigits(n) + 'đ';
}

/** Price of one turn, rounded to the dong: 99.000đ / 10 → 9.900. null when turns is 0. */
export function pricePerTurn(price: number, turns: number): number | null {
    return turns > 0 ? Math.round(price / turns) : null;
}

// ---------------------------------------------------------------- dates (Vietnam time, UTC+7, no DST)

const VN_MS = 7 * 3600 * 1000;
const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * BE writes naive UTC (`datetime.utcnow().isoformat()`, no "Z"); newer fields carry "Z". Parsing a
 * naive string as-is would read it as LOCAL time and shift every date by 7 hours in Vietnam.
 */
export function parseServerDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
    const d = new Date(hasZone ? iso : iso + 'Z');
    return Number.isNaN(d.getTime()) ? null : d;
}

/** A Date whose getUTC* fields are the Vietnamese wall clock. null if unreadable. */
export function vnClock(iso?: string | null): Date | null {
    const d = parseServerDate(iso);
    return d ? new Date(d.getTime() + VN_MS) : null;
}

/** Calendar parts in Vietnam time regardless of the device's timezone. */
export function vnParts(d: Date): {y: number; m: number; day: number} {
    const v = new Date(d.getTime() + VN_MS);
    return {y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, day: v.getUTCDate()};
}

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

/** "20:47 · 21/10/2026" (result / history). */
export function formatTimeDate(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} · ${formatDate(iso)}` : '—';
}

/** "20:38:12" */
export function formatTime(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}` : '—';
}

/** "18/10" */
export function formatDayMonth(iso?: string | null): string {
    const d = vnClock(iso);
    return d ? `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}` : '—';
}

/** "YYYY-MM-DD" (date picker value / API day) → "21/10/2026". */
export function formatIsoDay(day?: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** "YYYY-MM-DD" → "20/10" (week bounds of the ranking board). '' when unreadable. */
export function formatIsoDayMonth(day?: string | null): string {
    const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(day || '');
    return m ? m[3] + '/' + m[2] : '';
}

/** Today in Vietnam as "YYYY-MM-DD". */
export function todayVn(now: Date = new Date()): string {
    const d = new Date(now.getTime() + VN_MS);
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

// ---------------------------------------------------------------- durations

/** "còn 38 phút", rounded up so 61 s reads 2 minutes. */
export function minutesLeft(sec: number | null | undefined): string {
    if (sec == null || !(sec > 0)) return 'đã hết giờ';
    if (sec < 60) return 'còn dưới 1 phút';
    return 'còn ' + Math.ceil(sec / 60) + ' phút';
}

/** 4920 s → "82 phút" (rounded up; 0/absent → "—"). */
export function formatMinutes(sec?: number | null): string {
    if (!sec || sec <= 0) return '—';
    return Math.ceil(sec / 60) + ' phút';
}

// ---------------------------------------------------------------- text

/** Exam names can carry editor HTML (<p>, &nbsp;). Plain text for titles and aria-labels. */
export function plainText(html?: string | null): string {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Short sentence for an API error ({code, error}) or a thrown error:
 * server message if any; fetch failure (TypeError) → network sentence; Error.message; else fallback.
 */
export function errorText(e: unknown, fallback: string): string {
    if (e instanceof TypeError) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    const o = e as {error?: unknown; message?: unknown} | null | undefined;
    if (o && typeof o.error === 'string' && o.error) return o.error;
    if (o && typeof o.message === 'string' && o.message) return o.message;
    return fallback;
}
