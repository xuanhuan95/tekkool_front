import {parseServerDate, vnParts} from '../../lib/format';

/**
 * Danh hiệu (title) rule — NOT FINAL (PM 22/10, waiting for anh Thịnh). Kept in this one file so the
 * rule can change without touching any screen:
 *   - "Học sinh chăm": at least DILIGENT_PER_MONTH exams submitted in the current month (Vietnam time).
 *   - "Người mới": fewer than NEWBIE_BELOW exams submitted in total.
 *   - otherwise: no title (hidden) — the temporary rule does not cover this case.
 * "Đề" here = one submitted attempt (bài đã nộp). Bank exams give every attempt its own copy, so
 * distinct exam ids would count the same thing; counting submissions keeps both kinds equal.
 */
export const TITLE_RULE = {NEWBIE_BELOW: 5, DILIGENT_PER_MONTH: 5} as const;

export type TitleInfo = {
    title: 'Người mới' | 'Học sinh chăm';
    /** Exams submitted this month. */
    month: number;
    total: number;
    /** Progress toward the next title; absent at the top title. */
    next?: {title: string; value: number; max: number; remaining: number};
};

type Sub = {submitted_at?: string | null};

export function countSubmissions(subs: Sub[], now: Date = new Date()) {
    const cur = vnParts(now);
    let month = 0, total = 0;
    for (const s of subs) {
        const d = parseServerDate(s.submitted_at);
        if (!d) continue;
        total++;
        const p = vnParts(d);
        if (p.y === cur.y && p.m === cur.m) month++;
    }
    return {month, total};
}

/** null = no title for this student (or no data): screens then hide the title, pill and card. */
export function studentTitle(subs: Sub[] | null | undefined, now: Date = new Date()): TitleInfo | null {
    if (!subs) return null;
    const {month, total} = countSubmissions(subs, now);
    const goal = TITLE_RULE.DILIGENT_PER_MONTH;
    if (month >= goal) return {title: 'Học sinh chăm', month, total};
    if (total < TITLE_RULE.NEWBIE_BELOW) {
        return {title: 'Người mới', month, total,
                next: {title: 'Học sinh chăm', value: month, max: goal, remaining: goal - month}};
    }
    return null;
}
