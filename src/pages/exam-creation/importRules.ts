import {convertData, type QuestionData} from './convertData';

/**
 * Exam as returned by `import_docx/preview` — NOT saved yet, and exactly the payload that will be
 * sent to `question_bank/save` / `exam/create`. Unlike the editor's `Exam` it carries `source`
 * (the original text of the Word file) for the right column.
 */
export type ImportQuestion = {id: string; type: string; data: QuestionData; /** Question number as printed in the Word file (BE, SPT-93). */ source_no?: number};

export type ImportSection = {
    id: string;
    name: string;
    question_type?: string;
    description?: string;
    questions: ImportQuestion[];
};

/** `stats` of `import_docx/preview`: what the file DECLARES vs what the reader found (SPT-93). */
export type ImportStats = {declared_questions?: number | null; read_questions?: number | null; total_score?: number | null};

export type ImportedExam = {
    id: string;
    name: string;
    duration?: number;
    sections: ImportSection[];
    stats?: ImportStats;
    /** Each line of the original text, already escaped by the backend. */
    source?: string[];
};

/** Duplicate-check result for ONE question — `question_bank/check_trung`. */
export type DuplicateInfo = {
    score: number;
    khop: Array<{id?: string; khoi?: string; score: number; trong_file?: boolean}>;
};

/** One coded warning of `import_docx/preview` (`issues`). `error` = Nặng (must be acknowledged before saving). */
export type ImportIssue = {
    code: string; level: 'error' | 'warning' | 'info'; exam_id: string | null; section_index: number | null;
    question_id: string | null; question_no: number | null; message: string;
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

/** Q12: a pick-one question without a correct answer always scores 0 (the BE also refuses a key that points at no option). */
export const isMissingKey = (u: QuestionUnit) => {
    const d = u.questions[0].data;
    return isChoice(u.questions[0]) && (!d.correctAnswerId || !(d.answers || []).some(a => a.id === d.correctAnswerId));
};

/** ý a), b)… of a Đúng/Sai question that have no Đúng/Sai set — the BE refuses to save these (`true_false_missing_answer`). */
export const missingTfStatements = (u: QuestionUnit) =>
    u.questions[0].type === 'TrueFalse' ? u.questions.flatMap((q, i) => typeof q.data.answer === 'boolean' ? [] : [String.fromCharCode(97 + i)]) : [];

export const plain = (html?: string) => String(html || '').replace(/<[^>]*>/g, '').trim();

export type NumberedUnit = {unit: QuestionUnit; no: number};

/** Units of the whole exam numbered 1..N in paper order (a Đúng/Sai group counts once). */
export function numberedUnits(exam: ImportedExam): NumberedUnit[] {
    return exam.sections.flatMap(s => toUnits(s.questions)).map((unit, i) => ({unit, no: i + 1}));
}

export const countQuestions = (exam: ImportedExam) => numberedUnits(exam).length;

export const missingKeys = (exam: ImportedExam) => numberedUnits(exam).filter(x => isMissingKey(x.unit)).length;

export const missingTf = (exam: ImportedExam) => numberedUnits(exam).filter(x => missingTfStatements(x.unit).length).length;

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
        ['Câu Đúng/Sai có ý chưa đặt Đúng/Sai', all.filter(x => missingTfStatements(x.unit).length)],
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
    const tfKey = exams.reduce((n, e) => n + missingTf(e), 0);
    const parts = [
        keys && `Còn ${keys} câu chưa có đáp án`,
        tf && `Còn ${tf} câu Đúng/Sai chưa đủ 4 ý`,
        tfKey && `Còn ${tfKey} câu Đúng/Sai chưa đặt Đúng/Sai cho từng ý`,
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

// ── coded warnings (SPT-93) ────────────────────────────────────────────────────────────

export const isSevere = (i: ImportIssue) => i.level === 'error';

/** Info is not shown to the teacher (the BE leaves it out of `warnings` too). */
const SHOWN = (i: ImportIssue) => i.level !== 'info';

/** The teacher renumbered the exam: the "number jumps" warnings no longer apply. */
const RENUMBERED = new Set(['NUMBER_GAP', 'NUMBER_DUPLICATE']);

export const issueKey = (i: ImportIssue) => [i.exam_id, i.code, i.section_index, i.question_id, i.message].join('|');

/** Warnings of ONE exam, in file order, without info and (after "Đánh số lại") without number-jump ones. */
export const examIssues = (issues: ImportIssue[], examId: string, renumbered = false) =>
    issues.filter(i => i.exam_id === examId && SHOWN(i) && !(renumbered && RENUMBERED.has(i.code)));

/** Severe warnings of the ticked exams the teacher has not pressed "Đã xem, cho phép lưu" on yet. */
export const unseenSevere = (issues: ImportIssue[], examIds: string[], seen: Record<string, boolean>, renumbered: Record<string, boolean> = {}) =>
    examIds.flatMap(id => examIssues(issues, id, renumbered[id]).filter(i => isSevere(i) && !seen[issueKey(i)]));

/**
 * Numbers printed in the Word file that the reader skipped, as [id of the question that follows, missing number] — "Thiếu Câu 6".
 * Compared inside one section only: the file restarts at "Câu 1" in every Phần.
 */
export function missingNumbers(exam: ImportedExam): Array<{beforeId: string; no: number}> {
    const out: Array<{beforeId: string; no: number}> = [];
    for (const s of exam.sections) {
        let prev: number | undefined;
        for (const u of toUnits(s.questions)) {
            const no = u.questions[0].source_no;
            if (no === undefined) { prev = undefined; continue; }
            // a gap this long is a numbering error in the file, not 40 lost questions
            if (prev !== undefined && no > prev + 1 && no - prev <= 10) for (let n = prev + 1; n < no; n++) out.push({beforeId: u.id, no: n});
            prev = no;
        }
    }
    return out;
}

/** Answered / answerable questions, counted live so "Dán đáp án" and picking an answer move the tile. */
export function answerCounts(exam: ImportedExam) {
    let total = 0, done = 0;
    for (const q of exam.sections.flatMap(s => s.questions)) {
        if (isChoice(q)) { total++; if (q.data.correctAnswerId) done++; }
        else if (q.type === 'TrueFalse') { total++; if (typeof q.data.answer === 'boolean') done++; }
        else if (q.type === 'FillBlank') { total++; if (plain(String(q.data.answer ?? ''))) done++; }
    }
    return {total, done};
}

// ── "Dán đáp án nhanh" (`import_docx/answers`) ─────────────────────────────────────────

/** What `import_docx/answers` sends back: question id → the value to set. */
export type PastedAnswers = Record<string, {correctAnswerId?: string; answer?: boolean | string}>;

/** The frame the BE needs (no images — the whole exam would break the 2 MB nginx cap), in paper order. */
export function answerFrame(exam: ImportedExam) {
    const types = ['MultipleChoice', 'TrueFalse', 'FillBlank', 'FreeAnswer'];
    return exam.sections.flatMap(s => s.questions).map(q => ({
        id: q.id, type: types.includes(q.type) ? q.type : 'FreeAnswer',
        answer_ids: (q.data.answers || []).map(a => a.id), group: q.data.passageId || undefined,
    }));
}

export const applyPasted = (exam: ImportedExam, pasted: PastedAnswers): ImportedExam =>
    mapQuestions(exam, q => {
        const p = pasted[q.id];
        if (!p) return q;
        return {...q, data: {...q.data, ...('correctAnswerId' in p ? {correctAnswerId: p.correctAnswerId} : {answer: p.answer})}};
    });

export type PasteRow = {no: number; type: string; now: string; next: string; status: 'new' | 'change' | 'same'};

const TF_TEXT = (v: unknown) => v === true ? 'Đ' : v === false ? 'S' : '';

/** One row per question the paste would touch; Đúng/Sai ý of one question share a row. */
export function pasteRows(exam: ImportedExam, pasted: PastedAnswers): PasteRow[] {
    const rows: PasteRow[] = [];
    numberedUnits(exam).forEach(({unit, no}) => {
        const qs = unit.questions.filter(q => pasted[q.id]);
        if (!qs.length) return;
        const first = unit.questions[0];
        let now: string, next: string;
        if (isChoice(first)) {
            const letter = (id?: string) => { const i = (first.data.answers || []).findIndex(a => a.id === id); return i < 0 ? '' : String.fromCharCode(65 + i); };
            now = letter(first.data.correctAnswerId); next = letter(pasted[first.id].correctAnswerId);
        } else if (first.type === 'TrueFalse') {
            now = unit.questions.map(q => TF_TEXT(q.data.answer)).join(' ');
            next = unit.questions.map(q => TF_TEXT(q.id in pasted ? pasted[q.id].answer : q.data.answer)).join(' ');
        } else {
            now = plain(String(first.data.answer ?? '')); next = String(pasted[first.id].answer ?? '');
        }
        const blank = now.replace(/\s/g, '') === '';
        rows.push({no, type: first.type, now, next, status: blank ? 'new' : now === next ? 'same' : 'change'});
    });
    return rows;
}

// ── "Đổi sang Trắc nghiệm và tách A–D" ─────────────────────────────────────────────────

/**
 * Cut "stem … A. … B. … C. … D. …" (one paragraph or several) into the stem and 4 options. null unless A, B, C, D all
 * appear in order. Works on the HTML text so inline formulas and images stay inside their piece.
 */
export function splitOptions(html: string): {stem: string; options: string[]} | null {
    const text = html.split(/<\/p>\s*<p[^>]*>|<br\s*\/?>/i).map(x => x.replace(/^\s*<p[^>]*>|<\/p>\s*$/gi, '')).join('\n');
    const marks: Array<{at: number; end: number}> = [];
    let from = 0;
    for (const letter of 'ABCD') {
        const m = new RegExp('(?:^|\\n|\\s)' + letter + '\\.\\s*').exec(text.slice(from));
        if (!m) return null;
        marks.push({at: from + m.index, end: from + m.index + m[0].length});
        from = marks[marks.length - 1].end;
    }
    const piece = (a: number, b: number) => text.slice(a, b).replace(/\n/g, '<br>').replace(/^(<br>)+|(<br>)+$/g, '').trim();
    return {
        stem: '<p>' + piece(0, marks[0].at) + '</p>',
        options: marks.map((m, i) => '<p>' + piece(m.end, i + 1 < marks.length ? marks[i + 1].at : text.length) + '</p>'),
    };
}

/** A question in its original type, kept when the teacher converts it so converting back brings everything back. */
export type Stash = Record<string, {type: string; data: QuestionData}>;
