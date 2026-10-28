import type {ServerMark} from '../my/imageMarks';
import type {Submission, SubmissionAnswer, SubmissionDetail} from '../../types/submission';
import {formatDecimal, score10} from '../../lib/format';
import {kindOf} from './paper';
import type {QuestionKind} from './paper';
import {stripQuestionLabel, stripStatementLabel} from './stripLabel';

/*
 * Pure helpers for the result (HS-KetQua), review (HS-XemLai) and history (HS-LichSu) screens.
 * Everything here reads `exam/submission/<id>` / `exam/my_submissions` as BE returns them; correct
 * answers only exist there, i.e. after the attempt is submitted.
 */

export type ScoreSummary = {
    /** Score /10 so far (machine-graded part + graded essays). */
    score10: number;
    /** Essays still waiting: points on the 10 scale still open. 0 = final. */
    pendingPoints10: number;
    isProvisional: boolean;
    /**
     * Points this submission REALLY adds to the weekly board, computed by BE (SPT-60
     * `ranking_contribution`: 0 when it is not the best attempt of the week, blank paper…).
     * null = BE did not send it (older API) → the screen hides the line instead of guessing.
     */
    rankPoints: number | null;
};

export function summarize(s: Submission): ScoreSummary {
    const pendingPoints10 = s.pending_count > 0
        ? score10(Math.max(0, (s.max_score || 0) - (s.graded_max_score || 0)), s.max_score) ?? 0 : 0;
    return {
        score10: score10(s.score, s.max_score) ?? 0,
        pendingPoints10,
        isProvisional: s.pending_count > 0,
        rankPoints: typeof s.ranking_contribution === 'number' ? s.ranking_contribution : null,
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
    /** Essay: ids of the handwriting photos. */
    images: string[];
    /** Essay: teacher's marks on `images` (SPT-84); [] until the attempt is graded. */
    marks: ServerMark[];
    /** Short answer: accepted answers ('|' separated on BE). */
    correctText: string | null;
    comment: string | null;
    /** Lời giải (SPT-60), HTML; null when the teacher wrote none. */
    explanation: string | null;
};

/** Distinct non-empty explanations of a group, joined (Đúng/Sai: usually on one statement only). */
function joinExplanations(list: SubmissionAnswer[]): string | null {
    const seen: string[] = [];
    for (const a of list) {
        const e = (a.explanation || '').trim();
        if (e && !seen.includes(e)) seen.push(e);
    }
    return seen.length ? seen.join('') : null;
}

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
            const statements = group.map((g, k) => {
                const key = String.fromCharCode(97 + k);
                return {key, html: stripStatementLabel(g.question_text, key),
                        answer: toBool(g.answer), correct: toBool(g.correct), ok: statementOk(g)};
            });
            const score = group.reduce((t, g) => t + (g.score || 0), 0);
            const maxScore = group.reduce((t, g) => t + (g.max_score || 0), 0);
            const okCount = statements.filter(s => s.ok).length;
            out.push({
                number, kind, sectionName,
                prompt: group.length > 1 || a.passage ? stripQuestionLabel(a.passage) : '',
                passage: null, score: Math.round(score * 10000) / 10000, maxScore,
                status: okCount === statements.length ? 'correct' : okCount === 0 ? 'wrong' : 'partial',
                options: [], statements, answer: '', images: [], marks: [], correctText: null, comment: a.comment || null,
                explanation: joinExplanations(group),
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
            prompt: stripQuestionLabel(a.question_text),
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
            images: kind === 'essay' ? a.images || [] : [],
            marks: kind === 'essay' ? a.marks || [] : [],
            correctText: kind === 'short' ? (a.correct || null) : null,
            comment: a.comment || null,
            explanation: joinExplanations([a]),
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
