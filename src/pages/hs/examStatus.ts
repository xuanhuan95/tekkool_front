import type {BadgeTone} from '../../components/ui';
import type {InProgress} from '../../queries/inProgress';
import type {ExamSummary} from '../../types/exam';
import {formatScore, minutesLeft, score10} from './format';

export type ExamFilter = 'all' | 'todo' | 'done';

export type ExamStatus = {kind: 'inProgress' | 'todo' | 'done'; tone: BadgeTone; label: string};

/**
 * Card label of HS-DeThi. `exam/browse` gives the attempt count and the LAST attempt's score
 * (not the best one) — so the label says "gần nhất", not the design's "cao nhất" (see report).
 */
export function examStatus(e: ExamSummary, cont?: InProgress | null): ExamStatus {
    if (cont && cont.exam_id === e.id)
        return {kind: 'inProgress', tone: 'sun-strong', label: 'Đang làm dở · ' + minutesLeft(cont.remaining_sec)};
    const n = e.attempts || 0;
    if (n === 0) return {kind: 'todo', tone: 'draft', label: 'Chưa làm'};
    const last = e.last_status === 'GRADING'
        ? 'gần nhất chờ chấm'
        : (score10(e.last_score, e.last_max) != null ? 'gần nhất ' + formatScore(score10(e.last_score, e.last_max)) : '');
    return {kind: 'done', tone: 'ok', label: 'Đã làm ' + n + ' lần' + (last ? ' · ' + last : '')};
}

export function filterExams(list: ExamSummary[], f: ExamFilter, cont?: InProgress | null): ExamSummary[] {
    if (f === 'all') return list;
    return list.filter(e => {
        const k = examStatus(e, cont).kind;
        return f === 'done' ? k === 'done' : k !== 'done';
    });
}

/** "90 phút" / no limit. */
export function durationLabel(min?: number | null): string {
    return min && min > 0 ? min + ' phút' : 'Không giới hạn thời gian';
}

/** Number of parts: bank exams describe them in cau_truc, others have one Section per part. */
export function partCount(meta: {sections?: unknown[]; cau_truc?: unknown[]}): number {
    return (meta.cau_truc && meta.cau_truc.length) || (meta.sections ? meta.sections.length : 0);
}
