/** Folder: both a SUBJECT (root folder) and an EXAM SET (child folder) — BE does not separate the two. */
export type Folder = {
    id: string;
    name: string;
    parent?: string | null;
    /** Admin-hidden subject (SPT-65). Admin sees every hidden subject; a teacher gets only the hidden subjects that still hold their exams. */
    hidden?: boolean;
    /** Subject cards only (SPT-119): the teacher's own exams incl. child folders; absent on older BE. */
    exam_count?: number;
    draft_count?: number;
};

export type ExamStatus = 'draft' | 'published';

/** How the exam was made (Exam.source). `null` on old exams that have neither banks nor a source file. */
export type ExamSource = 'web' | 'word' | 'bank';

/** Exam as BE returns it on browse/take-exam screens (unlike Exam on the authoring screen). */
export type ExamSummary = {
    id: string;
    name: string;
    duration?: number;
    description?: string;
    question_count?: number;
    /** SPT-66: absent on old exams = published. */
    status?: ExamStatus;
    /** SPT-68: the exam has at least one attempt → cannot be deleted, only moved back to Nháp. */
    has_submissions?: boolean;
    /** `exam/list` (Môn & đề v2). All absent on an old BE. */
    source?: ExamSource | null;
    /** Word file name (`word`) or template file name (`bank`). */
    source_file?: string | null;
    bank_names?: string[];
    points_total?: number | null;
    /** Drawn exam: `question_count` is an estimate → show "~N câu". */
    approx?: boolean;
    /** ISO UTC; null on old exams until their next save. */
    created_at?: string | null;
    updated_at?: string | null;
    submission_count?: number;
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

/** `exam/detail/<id>` (no questions, no answers): the `/exam/:id` page. */
export type ExamDetail = {
    id: string;
    name: string;
    status?: ExamStatus;
    duration?: number;
    folder: {id: string; name: string} | null;
    source: ExamSource | null;
    source_file?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    question_count: number;
    points_total: number | null;
    approx: boolean;
    parts: ExamPart[];
    banks: {id: string; name: string; kind?: string}[];
    /** Only drawn exams. `capacity` = exams a student can draw without repeating a block. */
    draw: {capacity: number; bottleneck?: unknown; shortage: {block_type: string; name: string; need: number; have: number}[]} | null;
    submissions: {total: number; pending: number};
};

export type ExamPart = {
    group_title?: string | null;
    title: string;
    score?: number | null;
    question_count: number;
    points_total?: number | null;
    items: {block_type?: string | null; name?: string; type?: string; blocks?: number; questions?: number}[];
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
export type StructureSlot = {block_type: string; title: string};

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
    /** SPT-38/83: ids of the student's handwriting photos on an essay (`answer_image/view/<id>`). */
    markedImages?: string[];
};

export type TestSection = {
    id: string;
    name?: string | null;
    questions: TestQuestion[];
    /** Only on exams drawn from the bank: block type code (multiple_choice, true_false...). */
    block_type?: string | null;
    /** Exams drawn with a frame (BE `annotate`): first question number of this section, and the titles of the frame. */
    first_no?: number;
    group_title?: string | null;
    part_title?: string | null;
    /** Points of the Phần (first section of a Phần only); null = not stated. */
    part_score?: number | null;
    part_lead?: string | null;
    sub_title?: string | null;
    description?: string | null;
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
    /** «Cho biết» boxes (HTML) of the drawn exam — shown sticky for the whole attempt. */
    shared_info?: string[];
};

/** Bank kind: `block` = passage blocks drawn per slot, `paper` = whole exams, one drawn per attempt. Fixed at creation. */
export type BankKind = 'block' | 'paper';

/** `question_bank/list` row: `items` = blocks (kind block) or whole exams (kind paper). */
export type BankSummary = {id: string; name: string; subject: string; kind?: BankKind; items?: number; blocks: number;
    /** Exams imported into a block bank (BE `source_count`); absent on older replies. */
    source_count?: number;
    /** ISO creation time, used to tell same-named banks apart; absent → hidden. */
    created_at?: string};

/** `question_bank/papers` row (kind paper). */
export type BankPaperRow = {id: string; name: string; part_count: number; question_count: number; total_score: number; created_at: string};
export type BankPapersPage = {items: BankPaperRow[]; total: number; page: number; per_page: number};

/** `question_bank/paper?id=` — one whole exam with keys (owner/Admin only). */
export type BankPaper = {id: string; name: string; bank: string; duration: number; shared_info: string[]; sections: unknown[]};

/** `question_bank/blocks` (SPT-73): one block = a passage + its questions, or a single question. `data` carries the key + explanation. */
export type BankBlock = {
    id: string; block_type: string; block_type_name: string; question_type: string; count: number;
    passage?: string | null;
    /** Name of the exam it was imported from; blocks saved before this field are null. */
    source?: string | null;
    questions: {id: string; type: string; data: Record<string, any>}[];
};
export type BankBlocksPage = {total: number; page: number; per_page: number; blocks: BankBlock[]};
