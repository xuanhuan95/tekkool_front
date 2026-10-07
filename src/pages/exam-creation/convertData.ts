/** Question data: each type uses a different set of fields. */
export type QuestionData = {
    question?: string;
    passage?: string;
    passageId?: string;
    max_words?: number;
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
    // question / passage / passageId / max_words are shared by every type.
    const {question, passage, passageId, max_words} = data;
    const next: QuestionData = {question};
    if (passage) { next.passage = passage; next.passageId = passageId; }

    if (to === 'MultipleChoice' || to === 'ErrorIdentify') {
        // Keep the options if it was already multiple choice; otherwise the teacher adds them.
        next.answers = data.answers || [];
        if (data.correctAnswerId) next.correctAnswerId = data.correctAnswerId;
    } else if (to === 'FreeAnswer') {
        if (max_words) next.max_words = max_words;
    }
    // TrueFalse: don't set data.answer — TrueFalse.jsx treats undefined as NOT CHOSEN
    // and unchecks both radios. Presetting true/false would assign a correct answer arbitrarily.
    // FillBlank: don't set data.answer — leave it empty for the teacher to type.
    return next;
}
