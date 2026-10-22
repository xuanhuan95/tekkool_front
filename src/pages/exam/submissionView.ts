import type {Submission, SubmissionAnswer, SubmissionDetail} from '../../types/submission';
import {formatDecimal, kindOf} from './paper';
import type {QuestionKind} from './paper';

/*
 * Pure helpers for the result (HS-KetQua), review (HS-XemLai) and history (HS-LichSu) screens.
 * Everything here reads `exam/submission/<id>` / `exam/my_submissions` as BE returns them; correct
 * answers only exist there, i.e. after the attempt is submitted.
 */

/** Points per finished exam on the weekly board (core_ranking.POINTS_PER_EXAM). */
export const POINTS_PER_EXAM = 10;

/** Score on the 10-point scale. SPT papers are already out of 10; other papers are scaled. */
export function toScale10(score: number | null | undefined, max: number | null | undefined): number {
    if (!max || max <= 0) return 0;
    return ((score || 0) / max) * 10;
}

/** "7,25" — scores always with 2 decimals, like the design. */
export function formatScore(n: number): string {
    return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}

/** "17,3" — ranking points rounded to 1 decimal (business rule). */
export function formatRankPoints(n: number): string {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

export type ScoreSummary = {
    /** Score /10 so far (machine-graded part + graded essays). */
    score10: number;
    /** Essays still waiting: points on the 10 scale still open. 0 = final. */
    pendingPoints10: number;
    isProvisional: boolean;
    /** + points on the weekly board if this is the best attempt of the exam this week. */
    rankPoints: number;
};

export function summarize(s: Submission): ScoreSummary {
    const score10 = toScale10(s.score, s.max_score);
    const pendingPoints10 = s.pending_count > 0
        ? toScale10(Math.max(0, (s.max_score || 0) - (s.graded_max_score || 0)), s.max_score) : 0;
    return {
        score10,
        pendingPoints10,
        isProvisional: s.pending_count > 0,
        rankPoints: Math.round((POINTS_PER_EXAM + score10) * 10) / 10,
    };
}

const TRUE_WORDS = ['true', 't', '1', 'đ', 'đúng', 'dung', 'yes'];
const FALSE_WORDS = ['false', 'f', '0', 's', 'sai', 'no'];

export function toBool(v: string | null | undefined): boolean | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().toLowerCase();
    if (TRUE_WORDS.includes(s)) return true;
    if (FALSE_WORDS.includes(s)) return false;
    return null;
}

/** Full marks on an auto-graded item. */
const isFull = (a: SubmissionAnswer) =>
    a.score !== null && a.score !== undefined && a.max_score > 0 && a.score >= a.max_score - 1e-6;

export type ReviewStatus = 'correct' | 'wrong' | 'partial' | 'pending' | 'graded';

export type ReviewOption = {key: string; html: string; chosen: boolean; correct: boolean};
export type ReviewStatement = {key: string; html: string; answer: boolean | null; correct: boolean | null; ok: boolean};

export type ReviewItem = {
    number: number;
    kind: QuestionKind;
    sectionName: string;
    prompt: string;
    /** Shared reading text, set on the first question of its group only. */
    passage: string | null;
    score: number | null;
    maxScore: number;
    status: ReviewStatus;
    options: ReviewOption[];
    statements: ReviewStatement[];
    /** Short / essay: the student's answer; empty string = not answered. */
    answer: string;
    /** Short answer: accepted answers ('|' separated on BE). */
    correctText: string | null;
    comment: string | null;
};

function statementOk(a: SubmissionAnswer): boolean {
    const mine = toBool(a.answer), right = toBool(a.correct);
    if (mine !== null && right !== null) return mine === right;
    return (a.score || 0) > 0;
}

/**
 * Number the submitted answers exactly like the exam page did: consecutive TrueFalse statements
 * with the same passage_id are ONE question (a–d).
 */
export function buildReview(answers: SubmissionAnswer[]): ReviewItem[] {
    const out: ReviewItem[] = [];
    let i = 0;
    let lastPassage: string | null | undefined;
    while (i < answers.length) {
        const a = answers[i];
        const kind = kindOf(a.type || '');
        const sectionName = a.section_name || '';
        const number = out.length + 1;
        if (kind === 'truefalse') {
            const group = [a];
            if (a.passage_id) {
                while (i + group.length < answers.length) {
                    const n = answers[i + group.length];
                    if (kindOf(n.type || '') !== 'truefalse' || n.passage_id !== a.passage_id
                        || (n.section_name || '') !== sectionName) break;
                    group.push(n);
                }
            }
            const statements = group.map((g, k) => ({
                key: String.fromCharCode(97 + k), html: g.question_text || '',
                answer: toBool(g.answer), correct: toBool(g.correct), ok: statementOk(g),
            }));
            const score = group.reduce((t, g) => t + (g.score || 0), 0);
            const maxScore = group.reduce((t, g) => t + (g.max_score || 0), 0);
            const okCount = statements.filter(s => s.ok).length;
            out.push({
                number, kind, sectionName,
                prompt: group.length > 1 || a.passage ? (a.passage || '') : '',
                passage: null, score: Math.round(score * 10000) / 10000, maxScore,
                status: okCount === statements.length ? 'correct' : okCount === 0 ? 'wrong' : 'partial',
                options: [], statements, answer: '', correctText: null, comment: a.comment || null,
            });
            lastPassage = a.passage_id;
            i += group.length;
            continue;
        }
        const passage = a.passage && a.passage_id !== lastPassage ? a.passage : null;
        lastPassage = a.passage ? a.passage_id : undefined;
        const pending = a.score === null || a.score === undefined;
        out.push({
            number, kind, sectionName,
            prompt: a.question_text || '',
            passage,
            score: pending ? null : a.score,
            maxScore: a.max_score,
            status: kind === 'essay' ? (pending ? 'pending' : 'graded') : pending ? 'pending' : isFull(a) ? 'correct' : 'wrong',
            options: kind === 'choice' ? (a.answers || []).map((o, k) => ({
                key: String.fromCharCode(65 + k), html: o.value || '',
                chosen: !!a.answer && (a.answer === o.id || a.answer === o.value),
                correct: !!a.correct_id && o.id === a.correct_id,
            })) : [],
            statements: [],
            answer: a.answer || '',
            correctText: kind === 'short' ? (a.correct || null) : null,
            comment: a.comment || null,
        });
        i += 1;
    }
    return out;
}

export type PartRow = {
    name: string;
    /** "10 / 12", "14 / 16 ý", "—" for essays. */
    correct: string;
    score: number | null;
    maxScore: number;
    pending: boolean;
};

/** Result table by part (I–IV), in paper order. Uses BE's `phan` sums for the scores. */
export function partRows(detail: SubmissionDetail): PartRow[] {
    const items = buildReview(detail.answers || []);
    const sections = detail.phan && detail.phan.length ? detail.phan : [];
    return sections.map(p => {
        const its = items.filter(it => (it.sectionName || 'Khác') === p.ten);
        const tf = its.filter(it => it.kind === 'truefalse');
        const auto = its.filter(it => it.kind !== 'essay' && it.kind !== 'truefalse');
        let correct = '—';
        if (tf.length && !auto.length) {
            const all = tf.flatMap(it => it.statements);
            correct = `${all.filter(s => s.ok).length} / ${all.length} ý`;
        } else if (auto.length) {
            correct = `${auto.filter(it => it.status === 'correct').length} / ${auto.length}`;
        }
        return {name: p.ten, correct, score: p.pending ? null : p.score, maxScore: p.max_score, pending: p.pending > 0};
    });
}

export type ReviewFilter = 'all' | 'wrong' | 'correct' | 'essay';

export function filterReview(items: ReviewItem[], f: ReviewFilter): ReviewItem[] {
    if (f === 'wrong') return items.filter(it => it.status === 'wrong' || it.status === 'partial');
    if (f === 'correct') return items.filter(it => it.status === 'correct');
    if (f === 'essay') return items.filter(it => it.kind === 'essay');
    return items;
}

/** "Sai · 0 điểm", "Đúng · 0,25 điểm", "2 / 4 ý · 0,25 / 1", "Chờ giáo viên chấm". */
export function reviewBadge(it: ReviewItem): string {
    if (it.status === 'pending') return 'Chờ giáo viên chấm';
    const sc = formatDecimal(it.score || 0);
    if (it.kind === 'truefalse') {
        const ok = it.statements.filter(s => s.ok).length;
        return `${ok} / ${it.statements.length} ý · ${sc} / ${formatDecimal(it.maxScore)}`;
    }
    if (it.kind === 'essay') return `${sc} / ${formatDecimal(it.maxScore)} điểm`;
    return `${it.status === 'correct' ? 'Đúng' : 'Sai'} · ${sc} điểm`;
}

/** BE dates are UTC without 'Z' (datetime.utcnow().isoformat()). */
export function parseServerDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const d = new Date(/[Z+]/.test(iso) ? iso : iso + 'Z');
    return isNaN(d.getTime()) ? null : d;
}

/** "20:47 · 21/10/2026" */
export function formatTimeDate(d: Date | null): string {
    if (!d) return '—';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** 4920 s → "82 phút" (minutes, rounded up so 30 s is "1 phút", 0/absent → "—"). */
export function formatMinutes(sec?: number | null): string {
    if (!sec || sec <= 0) return '—';
    return Math.ceil(sec / 60) + ' phút';
}
