import type {TestExam, TestQuestion, TestSection} from '../../types/exam';
import type {TrueFalseValue} from '../../components/ui';
import {stripQuestionLabel, stripStatementLabel} from './stripLabel';
import {formatDecimal} from '../../lib/format';

/*
 * Turns `exam/during_test` into the SPT paper the student sees, and maps answers both ways.
 *
 * The DB keeps the legacy shape: ONE Question per Đúng/Sai statement (core_docx splits the 4
 * statements, they share data.passageId = the stem). The paper shows them as ONE question
 * "Câu 13" with a)–d), exactly like BE grades them (core_grading.grade_items groups consecutive
 * TrueFalse with the same passageId). Answers stay keyed by the RAW question id — that is what
 * `exam/save_answer/<id>` stores and what `markedAnswer` gives back after F5.
 */

export type QuestionKind = 'choice' | 'truefalse' | 'short' | 'essay';

export type PaperOption = {key: string; id: string; value: string};
export type PaperStatement = {key: string; questionId: string; html: string};

export type PaperQuestion = {
    number: number;
    kind: QuestionKind;
    /** Raw ids this question saves to (4 for Đúng/Sai, 1 otherwise). */
    questionIds: string[];
    /** HTML of the question text (Đúng/Sai: the shared stem). */
    prompt: string;
    options: PaperOption[];
    statements: PaperStatement[];
    /** Max score when the paper says it (data.max_score); BE weights are not sent. */
    maxScore: number | null;
    maxChars?: number;
    maxWords?: number;
    /** Raw question + its predecessor in the section, for the shared reading text (Passage). */
    raw: TestQuestion;
    rawPrev?: TestQuestion;
    sectionIndex: number;
};

export type PaperPart = {
    id: string;
    /** "Phần I · Trắc nghiệm" */
    title: string;
    note: string;
    kind: QuestionKind;
    questions: PaperQuestion[];
    /** Raw questions of the section (Passage numbers its reading texts with them). */
    rawQuestions: TestQuestion[];
};

export type Paper = {
    parts: PaperPart[];
    questions: PaperQuestion[];
};

/** Raw answers as the server stores them: raw question id → string ('' = cleared). */
export type RawAnswers = Record<string, string>;

const KIND_LABEL: Record<QuestionKind, string> = {
    choice: 'Trắc nghiệm', truefalse: 'Đúng / Sai', short: 'Trả lời ngắn', essay: 'Tự luận',
};
const KIND_HINT: Record<QuestionKind, string> = {
    choice: 'chọn 1 đáp án',
    truefalse: 'đúng 1 ý 0,1đ · 2 ý 0,25đ · 3 ý 0,5đ · 4 ý 1đ',
    short: 'chỉ ghi kết quả',
    essay: 'trình bày lời giải',
};

export function kindOf(type: string): QuestionKind {
    if (type === 'MultipleChoice' || type === 'ErrorIdentify') return 'choice';
    if (type === 'TrueFalse') return 'truefalse';
    if (type === 'FreeAnswer') return 'essay';
    return 'short';   // ShortAnswer, FillBlank, unknown → one-line answer
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const roman = (n: number) => ROMAN[n - 1] || String(n);

export function stripHtml(html?: string | null): string {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function toNumber(v: unknown): number | null {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Old exams can have empty placeholder questions — the old screen skipped them, so do we. */
const isEmptyQuestion = (q: TestQuestion) => !q.data || !Object.keys(q.data).length;

function partTitle(section: TestSection, index: number, kind: QuestionKind): string {
    const name = stripHtml(section.name);
    // Teachers often already write "Phần I. Trắc nghiệm" — do not prefix it twice.
    if (/^phần(\s|$)/i.test(name)) return name;
    return `Phần ${roman(index + 1)} · ${name || KIND_LABEL[kind]}`;
}

function partNote(questions: PaperQuestion[], kind: QuestionKind): string {
    if (!questions.length) return '';
    const from = questions[0].number, to = questions[questions.length - 1].number;
    const range = from === to ? `Câu ${from}` : `Câu ${from}–${to}`;
    const scores = questions.map(q => q.maxScore);
    const same = scores[0] !== null && scores.every(s => s === scores[0]);
    const points = same ? `${formatDecimal(scores[0] as number)} điểm/câu` : null;
    return [range, points, KIND_HINT[kind]].filter(Boolean).join(' · ');
}

/** Build the numbered paper. Numbering is continuous across parts (Câu 1…23). */
export function buildPaper(exam: TestExam): Paper {
    const parts: PaperPart[] = [];
    const all: PaperQuestion[] = [];

    (exam.sections || []).forEach((section, sectionIndex) => {
        const raws = (section.questions || []).filter(q => !isEmptyQuestion(q));
        const questions: PaperQuestion[] = [];
        let i = 0;
        while (i < raws.length) {
            const q = raws[i];
            const kind = kindOf(q.type);
            const base = {
                number: all.length + questions.length + 1,
                kind,
                raw: q,
                rawPrev: i > 0 ? raws[i - 1] : undefined,
                sectionIndex,
                maxChars: q.data.max_chars,
                maxWords: q.data.max_words,
            };
            if (kind === 'truefalse') {
                // Consecutive statements sharing a passageId = one SPT question (same rule as BE grading).
                const group = [q];
                const pid = q.data.passageId;
                if (pid) {
                    while (i + group.length < raws.length) {
                        const next = raws[i + group.length];
                        if (next.type !== 'TrueFalse' || next.data.passageId !== pid) break;
                        group.push(next);
                    }
                }
                const grouped = group.length > 1 || !!q.data.passage;
                const scores = group.map(x => toNumber(x.data.max_score));
                questions.push({
                    ...base,
                    questionIds: group.map(x => x.id),
                    prompt: grouped ? stripQuestionLabel(q.data.passage) : '',
                    options: [],
                    statements: group.map((x, k) => {
                        const key = String.fromCharCode(97 + k);
                        return {key, questionId: x.id, html: stripStatementLabel(x.data.question, key)};
                    }),
                    maxScore: scores.every(s => s !== null) ? scores.reduce((t, s) => t + (s as number), 0) : null,
                });
                i += group.length;
                continue;
            }
            questions.push({
                ...base,
                questionIds: [q.id],
                prompt: stripQuestionLabel(q.data.question),
                options: kind === 'choice'
                    ? (q.data.answers || []).map((a, k) => ({
                        key: String.fromCharCode(65 + k), id: String(a.id), value: String(a.value ?? ''),
                    }))
                    : [],
                statements: [],
                maxScore: toNumber(q.data.max_score),
            });
            i += 1;
        }
        if (!questions.length) return;
        const kind = questions[0].kind;
        parts.push({
            id: 'phan-' + (parts.length + 1),
            title: partTitle(section, parts.length, kind),
            note: partNote(questions, kind),
            kind,
            questions,
            rawQuestions: raws,
        });
        all.push(...questions);
    });

    return {parts, questions: all};
}

/** Server state after F5: raw id → markedAnswer (null → absent). */
export function initialAnswers(exam: TestExam): RawAnswers {
    const out: RawAnswers = {};
    for (const s of exam.sections || []) for (const q of s.questions || []) {
        if (q.markedAnswer !== null && q.markedAnswer !== undefined) out[q.id] = String(q.markedAnswer);
    }
    return out;
}

const TRUE_WORDS = ['true', 't', '1', 'đ', 'đúng', 'dung', 'yes'];
const FALSE_WORDS = ['false', 'f', '0', 's', 'sai', 'no'];

function toBool(v: string | undefined): boolean | null {
    if (v === undefined) return null;
    const s = v.trim().toLowerCase();
    if (TRUE_WORDS.includes(s)) return true;
    if (FALSE_WORDS.includes(s)) return false;
    return null;
}

/** Option key the stored answer points at. The old screen saved the option VALUE, accept the id too. */
export function choiceKey(q: PaperQuestion, answers: RawAnswers): string | null {
    const raw = answers[q.questionIds[0]];
    if (!raw) return null;
    const hit = q.options.find(o => o.id === raw) || q.options.find(o => o.value === raw);
    return hit ? hit.key : null;
}

export function trueFalseValue(q: PaperQuestion, answers: RawAnswers): TrueFalseValue {
    const out: TrueFalseValue = {};
    for (const s of q.statements) out[s.key] = toBool(answers[s.questionId]);
    return out;
}

/** Text of a short/essay answer. Old FillBlank answers were editor HTML — show them as text. */
export function textValue(q: PaperQuestion, answers: RawAnswers): string {
    const raw = answers[q.questionIds[0]] || '';
    return q.kind === 'short' && raw.includes('<') ? stripHtml(raw) : raw;
}

/**
 * Raw writes for a UI change. Choice saves the option VALUE (what BE grading and the teacher's
 * review screens read today); Đúng/Sai writes only the statements that changed, '' = cleared.
 */
export function choiceWrites(q: PaperQuestion, key: string): RawAnswers {
    const opt = q.options.find(o => o.key === key);
    if (!opt) return {};
    return {[q.questionIds[0]]: opt.value || opt.id};
}

export function trueFalseWrites(q: PaperQuestion, prev: TrueFalseValue, next: TrueFalseValue): RawAnswers {
    const out: RawAnswers = {};
    for (const s of q.statements) {
        const a = prev[s.key] ?? null, b = next[s.key] ?? null;
        if (a !== b) out[s.questionId] = b === null ? '' : b ? 'true' : 'false';
    }
    return out;
}

/** Answered = something the grader can read (any statement for Đúng/Sai, non-blank text). */
export function isAnswered(q: PaperQuestion, answers: RawAnswers): boolean {
    if (q.kind === 'choice') return choiceKey(q, answers) !== null || !!answers[q.questionIds[0]];
    if (q.kind === 'truefalse') return Object.values(trueFalseValue(q, answers)).some(v => v !== null);
    return stripHtml(answers[q.questionIds[0]]) !== '';
}
