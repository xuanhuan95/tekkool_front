/** Number formats of the student screens (PM 22/10): Vietnamese decimal comma. */

/** Score on the 10-point scale, 2 decimals as in the design: 7,75 · 6,50 · 10,00. null when there is no max. */
export function score10(score: number | null | undefined, max: number | null | undefined): number | null {
    if (score == null || !max) return null;
    return Math.round(score / max * 1000) / 100;
}

export function formatScore(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return n.toFixed(2).replace('.', ',');
}

/** Ranking points: 1 decimal (BE already rounds half-up) — 86,5 · 71,0. */
export function formatPoints(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

/**
 * BE writes naive UTC datetimes (`datetime.utcnow().isoformat()`, no "Z"). Parsing them as-is would
 * read them as LOCAL time and shift every date by 7 hours in Vietnam.
 */
export function parseServerDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso);
    const d = new Date(hasZone ? iso : iso + 'Z');
    return Number.isNaN(d.getTime()) ? null : d;
}

const VN_MS = 7 * 3600 * 1000;

/** Calendar parts in Vietnam time (UTC+7, no DST) regardless of the device's timezone. */
export function vnParts(d: Date): {y: number; m: number; day: number} {
    const v = new Date(d.getTime() + VN_MS);
    return {y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, day: v.getUTCDate()};
}

/** "18/10". */
export function formatDayMonth(iso?: string | null): string {
    const d = parseServerDate(iso);
    if (!d) return '—';
    const p = vnParts(d);
    return String(p.day).padStart(2, '0') + '/' + String(p.m).padStart(2, '0');
}

/** "YYYY-MM-DD" (BE week bounds) → "20/10". */
export function formatIsoDay(day?: string | null): string {
    const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(day || '');
    return m ? m[3] + '/' + m[2] : '';
}

/** "còn 38 phút" style, rounded up so 61 s reads 2 minutes. */
export function minutesLeft(sec: number | null | undefined): string {
    if (sec == null || !(sec > 0)) return 'đã hết giờ';
    if (sec < 60) return 'còn dưới 1 phút';
    return 'còn ' + Math.ceil(sec / 60) + ' phút';
}

/** Exam names can carry editor HTML (<p>, &nbsp;). Plain text for titles and aria-labels. */
export function plainText(html?: string | null): string {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return text.replace(/\s+/g, ' ').trim();
}

/** Error from Api (`{code, error}`) or a network failure → short sentence. */
export function errorText(e: unknown, fallback: string): string {
    const code = (e as {code?: unknown} | null)?.code;
    if (typeof code !== 'number') return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    const msg = (e as {error?: unknown}).error;
    return typeof msg === 'string' && msg ? msg : fallback;
}
