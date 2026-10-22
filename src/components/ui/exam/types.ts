/** State of one question as the number strip / grid needs it. */
export interface QuestionStatus {
    number: number;
    answered: boolean;
    /** "Xem lại sau" mark. */
    flagged?: boolean;
}

/** Đúng/Sai answer: statement key ('a'..'d') → true (Đ), false (S), null/absent (not answered). */
export type TrueFalseValue = Record<string, boolean | null | undefined>;

/** Number of statements answered (Đ or S chosen). */
export function countTrueFalse(value: TrueFalseValue | null | undefined): number {
    return Object.values(value || {}).filter(v => v === true || v === false).length;
}

/** "Câu 5, đã làm, đánh dấu xem lại, đang xem" — the strip/grid cell's accessible name. */
export function questionCellLabel(q: QuestionStatus, current: boolean): string {
    return ['Câu ' + q.number, q.answered ? 'đã làm' : 'chưa làm',
        q.flagged ? 'đánh dấu xem lại' : '', current ? 'đang xem' : ''].filter(Boolean).join(', ');
}

/** 2280 s → "38:00"; 90 min → "90:00" (minutes are not wrapped into hours, like the canvas clock). */
export function formatClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Spoken form for the timer: "38 phút 12 giây". */
export function spokenClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    return `${Math.floor(s / 60)} phút ${s % 60} giây`;
}

/** Words in an essay answer (HTML tags ignored). */
export function countWords(text: string): number {
    const plain = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    return plain ? plain.split(/\s+/).length : 0;
}

/** Last ≤5 minutes: clock turns red. */
export const WARN_SECONDS = 5 * 60;
