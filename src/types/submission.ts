/** Submission data returned by BE. Field names match `Submission.to_dict` on BE. */
export type Submission = {
    id: string;
    score: number;
    max_score: number;
    /** Max score of only the part ALREADY graded — not the whole submission. */
    graded_max_score: number;
    /** Number of questions still waiting for the teacher to grade. > 0 means no final score yet. */
    pending_count: number;
    status: SubmissionStatus;
    duration_sec?: number;
    submitted_at?: string;
    exam_name?: string;
    /**
     * Score grouped by section. Submissions made before BE stored `section_name`
     * lack this field — truly optional, not something for FE to guess.
     */
    phan?: ScoreSection[];
    /** Time ran out, the machine submitted on the student's behalf. */
    auto_submitted?: boolean;
    exam_id?: string;
    teacher_comment?: string | null;
    graded_at?: string | null;
    attempt_id?: string | null;
    /**
     * Student name. ONLY present on the two teacher endpoints (`exam/to_grade/<id>`,
     * `exam/pending`) and `exam/submission/<id>` — `exam/my_submissions` does not
     * return it, since a student viewing their own submission does not need their own name.
     */
    student?: string | null;
};

export type SubmissionStatus = 'GRADING' | 'GRADED';

/** A section in the score table ("Phần I", "Phần II"...). */
export type ScoreSection = {
    ten: string;
    score: number;
    max_score: number;
    /** Number of questions in this section still waiting to be graded. */
    pending: number;
    block_type?: string | null;
};

/**
 * One question in a submitted attempt (`exam/submission/<id>`). Only this endpoint
 * returns `answers`; the submission list omits it to avoid loading the whole exam per row.
 */
export type SubmissionAnswer = {
    question_id: string;
    /** Question type at submit time (MultipleChoice, TrueFalse, ShortAnswer, FillBlank, FreeAnswer...). */
    type?: string;
    /** Part title snapshotted at submit ("Phần I", teacher's title...). */
    section_name?: string | null;
    block_type?: string | null;
    question_text?: string;
    /** The student's work: option id (multiple choice) or HTML (essay). */
    answer?: string | null;
    /** null = not graded yet. 0 does not mean not graded. */
    score: number | null;
    max_score: number;
    /** Machine-gradable (multiple choice, fill-in-the-blank) -> teachers do not edit by hand. */
    auto_graded?: boolean;
    comment?: string | null;
    /** Correct answer as text, only present on machine-graded questions. */
    correct?: string | null;
    correct_id?: string | null;
    answers?: AnswerChoice[];
    /** Reading passage shared by the whole group of questions. */
    passage?: string | null;
    passage_id?: string | null;
};

export type AnswerChoice = {
    id: string;
    value?: string;
};

/** Submission with per-question detail — the shape `exam/submission/<id>` returns. */
export type SubmissionDetail = Submission & {
    answers?: SubmissionAnswer[];
    /** BE decides: true when the caller owns the exam. This is the real grading permission. */
    can_grade?: boolean;
};
