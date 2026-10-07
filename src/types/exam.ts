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
