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
