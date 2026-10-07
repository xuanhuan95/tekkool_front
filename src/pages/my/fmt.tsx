import {Label} from 'semantic-ui-react';
import type {Submission} from '../../types/submission';

/**
 * Shared formatting for the attempt / grading / invoice screens.
 *
 * ponytail: gathered in one place because the rule "if grading is not finished, do NOT show
 * the score as the final score" must be the same on all three screens. Three copies would
 * drift apart later.
 */

export function fmtDate(iso?: string | null): string {
    if (!iso) return '—';
    // The BE returns UTC without 'Z' (datetime.utcnow().isoformat()) -> the browser
    // misreads it as local time. Add 'Z' so it converts to Vietnam time correctly.
    let d = new Date(/[Z+]/.test(iso) ? iso : iso + 'Z');
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
}

export function fmtDuration(sec?: number | null): string {
    if (!sec) return '—';
    let m = Math.floor(sec / 60);
    return m < 60 ? m + ' phút' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
}

export function fmtMoney(amount?: number | null): string {
    return (amount || 0).toLocaleString('vi-VN') + ' đ';
}

/**
 * Score of one attempt.
 *
 * ponytail: while essay questions are ungraded, show "awaiting grading", NOT a
 * provisional score. A student who got all multiple choice right but whose essay is
 * ungraded would see "5/10" and think they got 5 points — complaining right away,
 * even though the teacher has not graded anything.
 */
export function ScoreLabel({sub}: {sub: Submission}) {
    if (sub.pending_count > 0) {
        return <Label size='small' color='yellow'>
            chờ chấm{sub.pending_count > 1 ? ' (' + sub.pending_count + ' câu)' : ''}
        </Label>;
    }

    let ratio = sub.max_score ? sub.score / sub.max_score : 0;
    const color = ratio >= 0.8 ? 'green' : ratio >= 0.5 ? 'olive' : 'red';

    return <Label size='small' color={color}>
        {round(sub.score)} / {round(sub.max_score)}
    </Label>;
}

// 1.5 stays as is, 2.0 shows as 2 — nobody writes a score as "2.0".
// Exported: DoExam prints scores straight from the API and needs it too, don't write a second function.
export function round(n?: number | null): number {
    return Math.round((n || 0) * 100) / 100;
}
