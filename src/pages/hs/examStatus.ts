import type {BadgeTone} from '../../components/ui';
import type {InProgress} from '../../queries/inProgress';
import type {ExamSummary} from '../../types/exam';
import type {ExamPart, ExamPartType} from '../../types/student';
import {formatDecimal, formatScore, minutesLeft, score10} from '../../lib/format';

export type ExamFilter = 'all' | 'todo' | 'done';

export type ExamStatus = {kind: 'inProgress' | 'todo' | 'done'; tone: BadgeTone; label: string};

/**
 * Card label of HS-DeThi: "Đã làm 2 lần · cao nhất 7,75" from SPT-60 `best_score/best_max`;
 * an older API without them falls back to the LAST attempt ("gần nhất").
 */
export function examStatus(e: ExamSummary, cont?: InProgress | null): ExamStatus {
    if (cont && cont.exam_id === e.id)
        return {kind: 'inProgress', tone: 'sun-strong', label: 'Đang làm dở · ' + minutesLeft(cont.remaining_sec)};
    const n = e.attempts || 0;
    if (n === 0) return {kind: 'todo', tone: 'draft', label: 'Chưa làm'};
    const best = score10(e.best_score, e.best_max);
    if (best != null) return {kind: 'done', tone: 'ok', label: 'Đã làm ' + n + ' lần · cao nhất ' + formatScore(best)};
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

const PART_TYPE_LABEL: Record<ExamPartType, string> = {
    mcq: 'Trắc nghiệm', tf: 'Đúng/Sai (4 ý a, b, c, d)', short: 'Trả lời ngắn', essay: 'Tự luận',
};

export type StructureRow = {name: string; kind: string; amount: string};

/**
 * "Cấu trúc đề" rows of HS-ChiTietDe from `exam/fetch.parts`: "Phần I · Trắc nghiệm — 12 câu · 3đ".
 * Bank exams (approx) are drawn per attempt → "khoảng N câu", and no total line.
 */
export function structureRows(parts: ExamPart[] | undefined): {rows: StructureRow[]; total: string | null} {
    const list = parts || [];
    const rows = list.map(p => {
        const name = (p.name || '').trim();
        const kind = PART_TYPE_LABEL[p.type] || p.type;
        // "Phần I. Trắc nghiệm (3,0 điểm)" already says the type — do not repeat it.
        const said = name.toLowerCase().replace(/\s*\/\s*/g, '/').includes(kind.split(' (')[0].toLowerCase());
        return {name, kind: said ? '' : kind,
        amount: (p.approx ? 'khoảng ' : '') + p.count + ' câu'
            + (p.points_total != null ? ' · ' + formatDecimal(p.points_total) + 'đ' : ''),
        };
    });
    const exact = list.length > 0 && list.every(p => !p.approx && p.points_total != null);
    const total = exact
        ? 'Tổng ' + list.reduce((t, p) => t + p.count, 0) + ' câu · '
            + formatDecimal(list.reduce((t, p) => t + (p.points_total || 0), 0)) + ' điểm.'
        : null;
    return {rows, total};
}

/** Distinct part names in `parts` (several question types can share one part). 0 = unknown. */
export function partsFromStructure(parts: ExamPart[] | undefined): number {
    return new Set((parts || []).map(p => (p.name || '').trim() || p.type)).size;
}
