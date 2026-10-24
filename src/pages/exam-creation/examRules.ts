import type {Question, Section} from './Default';

/** An SPT exam asks exactly 4 ý (a–d) per Đúng/Sai question; the backend refuses to save anything else (SPT-63). */
export const TRUE_FALSE_STATEMENTS = 4;

type Unitable = {type?: string; data?: {passageId?: string}};

/**
 * Group consecutive TrueFalse questions that share a passageId into one unit — the rule the backend
 * grades and validates by (core_grading._question_units). Every other question is a unit of its own.
 */
export function toUnits<T extends Unitable>(questions: T[]): T[][] {
    const units: T[][] = [];
    for (const q of questions) {
        const last = units[units.length - 1];
        const pid = q.data?.passageId;
        if (last && q.type === 'TrueFalse' && pid
            && last[0].type === 'TrueFalse' && last[0].data?.passageId === pid) last.push(q);
        else units.push([q]);
    }
    return units;
}

/** The editor stores the tick as `correctAnswer` (what the backend validates); `answer` is the older name. */
export const tickOf = (q: Question): boolean | undefined => {
    const v = q.data.correctAnswer ?? q.data.answer;
    return typeof v === 'boolean' ? v : undefined;
};

const letter = (i: number) => String.fromCharCode(97 + i);

/** Why the exam cannot be saved, worded like the backend ("Câu 3: ..."). Empty = fine. */
export function examProblems(sections: Section[]): string[] {
    const out: string[] = [];
    let no = 0;
    for (const unit of sections.flatMap(s => toUnits(s.questions))) {
        no++;
        const q = unit[0];
        if (q.type === 'MultipleChoice' || q.type === 'ErrorIdentify') {
            const id = q.data.correctAnswerId;
            if (!id) out.push(`Câu ${no}: chưa chọn đáp án đúng`);
            else if (!(q.data.answers || []).some((a: {id: string}) => a.id === id))
                out.push(`Câu ${no}: đáp án đúng trỏ tới phương án không tồn tại`);
        } else if (q.type === 'TrueFalse') {
            if (unit.length !== TRUE_FALSE_STATEMENTS)
                out.push(`Câu ${no}: câu Đúng/Sai có ${unit.length} ý (cần đúng ${TRUE_FALSE_STATEMENTS} ý)`);
            unit.forEach((s, i) => {
                if (tickOf(s) === undefined) out.push(`Câu ${no}: ý ${letter(i)}) chưa đặt Đúng/Sai`);
            });
        }
    }
    return out;
}

/** Messages from a 400 `invalid_questions` response (docs/api.md "Lỗi câu hỏi"); null = some other error. */
export function backendProblems(e: unknown): string[] | null {
    const list = (e as {invalid_questions?: Array<{message?: string}>} | null)?.invalid_questions;
    return Array.isArray(list) && list.length ? list.map(x => x.message || '') : null;
}

/** Blocks Xuất bản and In: examProblems + a tự luận must have a score (BE: essay_missing_score). */
export function publishProblems(sections: Section[]): string[] {
    const out = examProblems(sections);
    let no = 0;
    for (const unit of sections.flatMap(s => toUnits(s.questions))) {
        no++;
        const q = unit[0];
        if (q.type === 'FreeAnswer' && !(Number(q.data.max_score) > 0)) out.push(`Câu ${no}: tự luận chưa nhập điểm`);
    }
    return out;
}

/** SPT default score of a question (Ngữ văn trắc nghiệm 0,3). Tự luận has none: the teacher must enter it. */
export function defaultScore(type: string, subject?: string | null): number | undefined {
    if (type === 'TrueFalse') return 1;
    if (type === 'FreeAnswer') return undefined;
    const literature = (subject || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('ngu van');
    return type === 'FillBlank' || !literature ? 0.25 : 0.3;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Score of one question unit as the teacher sees it. Đúng/Sai is scored for the whole question,
 * but the BE keeps `max_score` per ý (the question total is their sum), so it is split in 4.
 */
export function unitScore(unit: Question[], subject?: string | null): number | undefined {
    const q = unit[0];
    if (q.type === 'TrueFalse') {
        const share = (defaultScore('TrueFalse') as number) / TRUE_FALSE_STATEMENTS;
        return round(unit.reduce((sum, y) => sum + (y.data.max_score ?? share), 0));
    }
    const v = q.data.max_score;
    return v === undefined || v === '' || v === null ? defaultScore(q.type, subject) : Number(v);
}

/** `max_score` to write on each question of the unit for a total of `score`. */
export const scoreData = (unit: Question[], score: number): Array<[string, number]> =>
    unit.map(q => [q.id, unit[0].type === 'TrueFalse' ? round(score / unit.length) : score]);

/** Copy of the sections with every missing default score filled in, so the BE grades what the teacher sees. */
export function withDefaultScores(sections: Section[], subject?: string | null): Section[] {
    return sections.map(s => ({
        ...s,
        questions: s.questions.map(q => {
            if (q.data.max_score !== undefined) return q;
            const d = q.type === 'TrueFalse' ? 1 / TRUE_FALSE_STATEMENTS : defaultScore(q.type, subject);
            return d === undefined ? q : {...q, data: {...q.data, max_score: d}};
        }),
    }));
}

export function examTotal(sections: Section[], subject?: string | null): number {
    const sum = sections.flatMap(s => toUnits(s.questions)).reduce((t, u) => t + (unitScore(u, subject) || 0), 0);
    return round(sum);
}

/** Does not block anything: shown as "Nên xem lại". */
export function reviewHints(sections: Section[], subject?: string | null): string[] {
    const out: string[] = [];
    let no = 0;
    for (const unit of sections.flatMap(s => toUnits(s.questions))) {
        no++;
        const q = unit[0];
        if (q.type === 'MultipleChoice' && (q.data.answers || []).length < 4) out.push(`Câu ${no}: trắc nghiệm không đủ 4 phương án`);
    }
    const total = examTotal(sections, subject);
    if (sections.some(s => s.questions.length) && total !== 10)
        out.push(`Tổng điểm đề là ${String(total).replace('.', ',')} (khác 10) — vẫn xuất bản được`);
    return out;
}
