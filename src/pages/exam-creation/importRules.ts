import {convertData, type QuestionData} from './convertData';

/**
 * Exam as returned by `import_docx/preview` — NOT saved yet, and exactly the payload that will be
 * sent to `question_bank/save` / `exam/create`. Unlike the editor's `Exam` it carries `source`
 * (the original text of the Word file) for the right column.
 */
export type ImportQuestion = {id: string; type: string; data: QuestionData};

export type ImportSection = {
    id: string;
    name: string;
    question_type?: string;
    questions: ImportQuestion[];
};

export type ImportedExam = {
    id: string;
    name: string;
    duration?: number;
    sections: ImportSection[];
    /** Each line of the original text, already escaped by the backend. */
    source?: string[];
};

/** Duplicate-check result for ONE question — `question_bank/check_trung`. */
export type DuplicateInfo = {
    score: number;
    khop: Array<{id?: string; khoi?: string; score: number; trong_file?: boolean}>;
};

/** An SPT exam asks exactly 4 ý (a–d) per Đúng/Sai question; grading depends on it. */
export const TRUE_FALSE_STATEMENTS = 4;

export const isChoice = (q: ImportQuestion) => q.type === 'MultipleChoice' || q.type === 'ErrorIdentify';

/** One question as the teacher and the student see it. A Đúng/Sai question is several stored questions (one per ý). */
export type QuestionUnit = {id: string; questions: ImportQuestion[]};

/**
 * Group consecutive TrueFalse questions that share a passageId into one unit — the same rule the
 * backend grades by (core_grading.grade_items) and the student paper uses (exam/paper.ts).
 * Every other question is a unit of its own.
 */
export function toUnits(questions: ImportQuestion[]): QuestionUnit[] {
    const units: QuestionUnit[] = [];
    for (const q of questions) {
        const last = units[units.length - 1];
        const pid = q.data.passageId;
        if (last && q.type === 'TrueFalse' && pid
            && last.questions[0].type === 'TrueFalse' && last.questions[0].data.passageId === pid) {
            last.questions.push(q);
        } else {
            units.push({id: q.id, questions: [q]});
        }
    }
    return units;
}

/** Q13: a Đúng/Sai question that does not have exactly 4 ý cannot be graded the SPT way. The editor will reuse this. */
export const isBadTrueFalse = (u: QuestionUnit) =>
    u.questions[0].type === 'TrueFalse' && u.questions.length !== TRUE_FALSE_STATEMENTS;

/** Q12: a pick-one question without a correct answer always scores 0. */
export const isMissingKey = (u: QuestionUnit) => isChoice(u.questions[0]) && !u.questions[0].data.correctAnswerId;

const plain = (html?: string) => String(html || '').replace(/<[^>]*>/g, '').trim();

export type NumberedUnit = {unit: QuestionUnit; no: number};

/** Units of the whole exam numbered 1..N in paper order (a Đúng/Sai group counts once). */
export function numberedUnits(exam: ImportedExam): NumberedUnit[] {
    return exam.sections.flatMap(s => toUnits(s.questions)).map((unit, i) => ({unit, no: i + 1}));
}

export const countQuestions = (exam: ImportedExam) => numberedUnits(exam).length;

export const missingKeys = (exam: ImportedExam) => numberedUnits(exam).filter(x => isMissingKey(x.unit)).length;

export const badTrueFalse = (exam: ImportedExam) => numberedUnits(exam).filter(x => isBadTrueFalse(x.unit)).length;

/** Rows of the "Thông tin đề" modal; rows with no question are left out. */
export function examStats(exam: ImportedExam) {
    const all = numberedUnits(exam);
    const choice = (x: NumberedUnit) => isChoice(x.unit.questions[0]);
    const rows: Array<[string, NumberedUnit[]]> = [
        ['Tổng số câu trắc nghiệm', all.filter(choice)],
        ['Tổng số câu khác (đúng/sai, trả lời ngắn, tự luận)', all.filter(x => !choice(x))],
        ['Câu trắc nghiệm chưa có đáp án đúng', all.filter(x => isMissingKey(x.unit))],
        ['Câu trắc nghiệm không đủ 4 lựa chọn',
            all.filter(x => choice(x) && (x.unit.questions[0].data.answers || []).length !== 4)],
        ['Câu Đúng/Sai không đủ 4 ý', all.filter(x => isBadTrueFalse(x.unit))],
        ['Câu nội dung rỗng', all.filter(x => !plain(x.unit.questions[0].data.question))],
    ];
    return {total: all.length, rows: rows.filter(r => r[1].length)};
}

/**
 * Q12 + Q13: why saving is blocked, over the ticked exams only. null = nothing blocks.
 * The teacher fixes the Word file and imports again (design Q13), or picks the answer here (Q12).
 */
export function saveBlocker(exams: ImportedExam[]): string | null {
    const keys = exams.reduce((n, e) => n + missingKeys(e), 0);
    const tf = exams.reduce((n, e) => n + badTrueFalse(e), 0);
    const parts = [
        keys && `Còn ${keys} câu chưa có đáp án`,
        tf && `Còn ${tf} câu Đúng/Sai chưa đủ 4 ý`,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
}

/** Backend upload messages (ASCII, no diacritics) → what a teacher can act on. */
export function importErrorText(raw: string): string {
    const t = raw.toLowerCase();
    if (t.includes('chi nhan file')) return 'Chỉ nhận file .docx. File .doc, .pdf hãy mở bằng Word rồi lưu lại dạng .docx.';
    if (t.includes('qua lon')) return 'File quá lớn (tối đa 10 MB).';
    if (t.includes('khong doc duoc file')) return 'Không đọc được file — file có thể bị hỏng hoặc đang đặt mật khẩu.';
    if (t.includes('khong tim thay de nao')) return "Không tìm thấy đề nào trong file — kiểm tra dòng mở câu dạng 'Câu 1.'";
    return 'Không đọc được file: ' + raw;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Checked in the browser before uploading; null = fine. */
export function fileProblem(file: {name: string; size: number}): string | null {
    if (!/\.docx$/i.test(file.name)) return importErrorText('Chi nhan file .docx');
    if (file.size > MAX_FILE_BYTES) return importErrorText('File qua lon');
    return null;
}

// ── pure edits, applied in place on the preview payload ────────────────────────────────

const mapQuestions = (exam: ImportedExam, fn: (q: ImportQuestion) => ImportQuestion): ImportedExam =>
    ({...exam, sections: exam.sections.map(s => ({...s, questions: s.questions.map(fn)}))});

export const patchQuestion = (exam: ImportedExam, qid: string, fn: (q: ImportQuestion) => ImportQuestion) =>
    mapQuestions(exam, q => q.id === qid ? fn(q) : q);

export const patchData = (exam: ImportedExam, qid: string, data: Partial<QuestionData>) =>
    patchQuestion(exam, qid, q => ({...q, data: {...q.data, ...data}}));

/**
 * Change the type of the questions in `ids` (all the ý of a Đúng/Sai group move together).
 * ponytail: section.question_type must follow — BE stores it from the section's first question.
 */
export function setType(exam: ImportedExam, ids: string[], type: string): ImportedExam {
    return {
        ...exam,
        sections: exam.sections.map(s => {
            if (!s.questions.some(q => ids.includes(q.id))) return s;
            const questions = s.questions.map(q => ids.includes(q.id) ? {...q, type, data: convertData(q.data, type)} : q);
            return {...s, questions, question_type: questions[0].type};
        }),
    };
}

/** The passage is a COPY inside every question of the group: write it back to the whole group by passageId. */
export const setPassage = (exam: ImportedExam, passageId: string | undefined, html: string) =>
    mapQuestions(exam, q => q.data.passageId === passageId ? {...q, data: {...q.data, passage: html}} : q);

export const setAnswer = (exam: ImportedExam, qid: string, answerId: string, value: string) =>
    patchQuestion(exam, qid, q => ({
        ...q, data: {...q.data, answers: (q.data.answers || []).map(a => a.id === answerId ? {...a, value} : a)},
    }));

/** Drop every question in `ids`; a section left empty goes too. */
export const removeQuestions = (exam: ImportedExam, ids: string[]): ImportedExam => ({
    ...exam,
    sections: exam.sections
        .map(s => ({...s, questions: s.questions.filter(q => !ids.includes(q.id))}))
        .filter(s => s.questions.length),
});
