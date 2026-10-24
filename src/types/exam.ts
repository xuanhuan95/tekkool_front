/** Folder: both a SUBJECT (root folder) and an EXAM SET (child folder) — BE does not separate the two. */
export type Folder = {
    id: string;
    name: string;
    parent?: string | null;
};

/** Exam as BE returns it on browse/take-exam screens (unlike Exam on the authoring screen). */
export type ExamSummary = {
    id: string;
    name: string;
    duration?: number;
    description?: string;
    question_count?: number;
    price?: number;
    /** `exam/browse` only: the viewer's own attempts on this exam. */
    attempts?: number;
    last_score?: number | null;
    last_max?: number | null;
    last_status?: string | null;
    /** SPT-60 `exam/browse`: the viewer's BEST attempt (by score/max ratio, provisional included). */
    best_score?: number | null;
    best_max?: number | null;
};

/** Question bank inventory — `question_bank/stats`. */
export type BankStats = {
    /** Number of blocks available, per type. A type with no blocks is absent. */
    per_type: Record<string, number>;
    total?: number;
};

/** Question bank capacity — `question_bank/capacity`. */
export type BankCapacity = {
    /** Matrix: how many blocks of each type an exam needs. BE takes it from the subject's MA_TRAN. */
    slots: Record<string, number>;
    /** How many times a student can retake without meeting an old block again. */
    capacity: number;
    /**
     * The type that is limiting `capacity`. BE returns [type, count], not a string —
     * FE reads only element [0].
     */
    bottleneck?: [string, number] | null;
    subject?: string;
    /** Inventory per type. Present when queried by `bank` — ImportExam reads it to draw the table. */
    per_type?: Record<string, number>;
};

/** A question bank — `question_bank/list`. */
export type QuestionBank = {
    id: string;
    name: string;
    subject?: string;
};

/** A slot in a bank exam's structure — each slot draws one block, order preserved. */
export type StructureSlot = {loai: string; tieu_de: string};

/** An option of a multiple-choice question, as `exam/during_test` returns it (correct flags stripped). */
export type TestAnswerOption = {id: string; value?: string | null};

/**
 * A question inside `exam/during_test/<id>`. `data` already went through BE `public_data`
 * (no correct answer). `markedAnswer` is what the server holds for this student — the source
 * of truth after F5.
 */
export type TestQuestion = {
    id: string;
    type: string;
    data: {
        question?: string | null;
        answers?: TestAnswerOption[];
        /** Shared stem: a reading text, or the stem of a 4-statement Đúng/Sai question. */
        passage?: string | null;
        passageId?: string | null;
        max_score?: number | string | null;
        max_chars?: number;
        max_words?: number;
        [key: string]: unknown;
    };
    markedAnswer?: string | null;
};

export type TestSection = {
    id: string;
    name?: string | null;
    questions: TestQuestion[];
    /** Only on exams drawn from the bank: block type code (TracNghiem, DungSai...). */
    loai?: string | null;
};

/** `GET exam/during_test/<id>` — the paper of an open attempt. */
export type TestExam = {
    id: string;
    name?: string | null;
    /** Minutes. Only a fallback when `remaining_sec` is null (exam owner trying it). */
    duration?: number | null;
    sections: TestSection[];
    /** Seconds left, computed by the SERVER from the attempt's expires_at. null = no attempt clock. */
    remaining_sec?: number | null;
    /** SPT-60: absolute deadline, ISO UTC with "Z". null = no attempt (owner trying the exam). */
    expires_at?: string | null;
    /** SPT-60: subject of the original exam. */
    subject?: {id: string | null; name: string | null} | null;
    /** SPT-60: exam duration in minutes. */
    duration_min?: number | null;
};

/** `question_bank/list` row: `blocks` = passage blocks the bank holds now. */
export type BankSummary = {id: string; name: string; subject: string; blocks: number};
