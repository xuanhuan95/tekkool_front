/** Question data: each type uses a different set of fields. */
export type QuestionData = {
    question?: string;
    passage?: string;
    passageId?: string;
    max_words?: number;
    max_chars?: number;
    /** Set by the Word import (SPT-62): score of the question and the HTML solution shown after submitting. */
    max_score?: number;
    explanation?: string;
    /** Import hint for the bank slot (short answer in Toán/Lí/Hoá = 'short_answer'); only valid for the type it was set for. */
    block_type?: string;
    /** SPT-97 câu chùm: the ý's own label ("a)", "1)"), kept apart from the question text. */
    label?: string;
    answers?: Array<{id: string; value: string}>;
    correctAnswerId?: string;
    /** WARNING: the meaning differs per type — TrueFalse reads a boolean, FillBlank reads an HTML string. */
    answer?: unknown;
};

/**
 * Change the question type: keep the shared data, DROP the old type's own data.
 *
 * The most dangerous is `data.answer` — TrueFalse reads it as a boolean, FillBlank
 * as an HTML string. Carrying it over makes auto-grading give wrong scores, so this
 * function builds a NEW object instead of mutating the old one.
 */
export function convertData(data: QuestionData, to: string): QuestionData {
    // question / passage / passageId / max_words / max_score / explanation are shared by every type.
    // block_type is NOT: it was guessed for the old type, the backend re-derives it.
    const {question, passage, passageId, max_words, max_chars, max_score, explanation} = data;
    const next: QuestionData = {question};
    if (max_score !== undefined) next.max_score = max_score;
    if (explanation) next.explanation = explanation;
    if (passage) { next.passage = passage; next.passageId = passageId; }

    if (to === 'MultipleChoice' || to === 'ErrorIdentify') {
        // Keep the options if it was already multiple choice; otherwise the teacher adds them.
        next.answers = data.answers || [];
        if (data.correctAnswerId) next.correctAnswerId = data.correctAnswerId;
    } else if (to === 'FreeAnswer') {
        // no UI sets these any more, but the BE sorts Ngữ văn blocks (short_answer/paragraph/essay) by them
        if (max_words) next.max_words = max_words;
        if (max_chars) next.max_chars = max_chars;
    }
    // TrueFalse: don't set data.answer — TrueFalse.jsx treats undefined as NOT CHOSEN
    // and unchecks both radios. Presetting true/false would assign a correct answer arbitrarily.
    // FillBlank: don't set data.answer — leave it empty for the teacher to type.
    return next;
}
