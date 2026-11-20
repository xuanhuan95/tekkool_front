import striptags from 'striptags';

import {formatDayMonth, formatScore, formatTime, parseServerDate, vnParts} from '../../lib/format';
import type {ExamPart, ExamSource, ExamSummary, Folder} from '../../types/exam';

/** Wording of the "how was it made" label — same words as the `+ Tạo đề` menu (canvas APP-teacher-subjects-v2). */
export const SOURCE_LABEL: Record<ExamSource, string> = {web: 'Tự soạn trên web', word: 'Nhập từ Word', bank: 'Rút từ ngân hàng'};

export const isPublished = (e: {status?: string}) => e.status !== 'draft';
export const examName = (e: {name: string}) => striptags(e.name) || '(đề không tên)';

/** "12 câu · 10 điểm · 90 phút" ("~12 câu" for a drawn exam, whose count is an estimate). Missing facts are left out, never invented. */
export function statsText(e: Pick<ExamSummary, 'question_count' | 'points_total' | 'approx' | 'duration'>): string {
    return [
        e.question_count != null && `${e.approx ? '~' : ''}${e.question_count} câu`,
        e.points_total != null && `${formatScore(e.points_total)} điểm`,
        e.duration ? `${e.duration} phút` : 'không giới hạn thời gian',
    ].filter(Boolean).join(' · ');
}

const dayKey = (d: {y: number; m: number; day: number}) => Date.UTC(d.y, d.m - 1, d.day) / 86400000;

/**
 * "hôm nay 14:05" · "hôm qua" · "18/11" (Vietnam time). `withTime` adds the clock to the last two ("hôm qua 09:20").
 * null for an old exam that has no date yet.
 */
export function whenText(iso: string | null | undefined, withTime = false, now = new Date()): string | null {
    const d = parseServerDate(iso);
    if (!d) return null;
    const ago = dayKey(vnParts(now)) - dayKey(vnParts(d));
    const clock = formatTime(iso).slice(0, 5);
    if (ago === 0) return 'hôm nay ' + clock;
    return (ago === 1 ? 'hôm qua' : formatDayMonth(iso)) + (withTime ? ' ' + clock : '');
}

/** The subject the teacher worked on last: the one holding the most recently updated exam; none updated → the first subject. */
export function lastWorkedSubject(subjects: Folder[], examsOf: (subjectId: string) => ExamSummary[] | undefined): Folder | undefined {
    let best: Folder | undefined, bestAt = '';
    for (const s of subjects) {
        for (const e of examsOf(s.id) || []) {
            const at = e.updated_at || '';
            if (at > bestAt) { best = s; bestAt = at; }
        }
    }
    return best || subjects[0];
}

/** What a part of the exam holds, in the teacher's words: "2 đoạn đọc hiểu × 5 câu" (drawn) / "Trắc nghiệm" (fixed). */
const TYPE_NAME: Record<string, string> = {mcq: 'trắc nghiệm', tf: 'đúng/sai', short: 'trả lời ngắn', essay: 'tự luận'};
const BLOCK_NAME: Record<string, string> = {reading: 'đoạn đọc hiểu', paragraph: 'câu viết đoạn văn', essay: 'câu viết bài văn'};

export function partContent(p: ExamPart, drawn: boolean): string {
    const parts = p.items.map(it => {
        if (it.block_type) {
            const name = BLOCK_NAME[it.block_type] || it.name || it.block_type;
            const per = it.blocks && it.questions && it.questions !== it.blocks ? ` × ${it.questions / it.blocks} câu` : '';
            return `${it.blocks} ${name.toLowerCase()}${per}`;
        }
        const kind = TYPE_NAME[it.type || ''] || '';
        // a fixed part of one kind: the Câu column already says how many ("Trắc nghiệm", as on the canvas)
        return !drawn && p.items.length === 1 && kind ? kind[0].toUpperCase() + kind.slice(1) : `${it.questions ?? it.blocks} câu ${kind}`.trim();
    });
    return parts.join(', ') + (drawn ? ', rút ngẫu nhiên' : '');
}
