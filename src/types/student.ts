/** Shapes of the student endpoints used by the HS screens (read from tekkool_back apis/*.py). */

/** `folder/subjects` — one root folder = one subject, with the viewer's progress. */
export type SubjectSummary = {
    id: string;
    name: string;
    /** Admin only: hidden subjects are listed for Admin and absent for everyone else (SPT-65). */
    hidden?: boolean;
    /** Exams in the subject (its folder + child folders). */
    exams: number;
    /** Exams the viewer has submitted at least once. */
    done: number;
    last: {
        id: string;
        exam_id: string;
        exam_name?: string | null;
        status?: string | null;
        score?: number | null;
        max_score?: number | null;
        submitted_at?: string | null;
    } | null;
};

/** `exam/fetch/<id>` — metadata only (no questions, no answers). */
export type ExamMeta = {
    id: string;
    name: string;
    duration?: number | null;
    /** Folder id (subject or a child set). */
    folder?: string | null;
    /** Serialised Section references — only the count is used. */
    sections?: unknown[];
    /** Bank exam structure: one slot per part. */
    cau_truc?: Array<{loai?: string; tieu_de?: string}>;
    bank?: unknown;
    /** SPT-60 `exam/fetch`: structure preview, one row per (part, question type). No content. */
    parts?: ExamPart[];
};

export type ExamPartType = 'mcq' | 'tf' | 'short' | 'essay';

export type ExamPart = {
    name: string | null;
    type: ExamPartType;
    /** Questions (Đúng/Sai counted per 4-statement question); for bank exams: blocks → approx. */
    count: number;
    /** null when unknown (bank exam of a subject without weights). */
    points_total: number | null;
    /** Bank exam: drawn per attempt, numbers are indicative ("khoảng"). */
    approx?: boolean;
};

/** Student title tiers (SPT-64, computed by BE core_title.py): newbie < diligent < warrior < conqueror. */
export type TitleKey = 'newbie' | 'diligent' | 'warrior' | 'conqueror';

/** Next tier and how to get there — a ready-made sentence from BE ("Còn 3 bài nữa trong tháng này…"). */
export type TitleHint = {name: string; hint: string};

/** Title as BE sends it; `next` only on me/profile (null at the top tier). */
export type StudentTitle = {key: TitleKey; name: string; next?: TitleHint | null};

/** `me/profile`. */
export type MeProfile = {
    id: string;
    name: string;
    email: string;
    group: string | null;
    hide_ranking_name: boolean;
    /** SPT-64: null = no tier reached (or not a student). */
    title?: StudentTitle | null;
    /** SPT-64: next tier hint, present even when `title` is null (students only). */
    title_next?: TitleHint | null;
};

/** One row of `ranking/week` / `ranking/achievements` (core_ranking.rank_board). */
export type BoardEntry = {
    /** null only for the viewer's own row when they have nothing on this board yet. */
    rank: number | null;
    is_me: boolean;
    hidden: boolean;
    /** "Học sinh ẩn danh" for hidden people (except yourself). */
    name: string;
    points: number;
    exams?: number;
    attempts?: number;
    duration_sec?: number;
    provisional?: boolean;
    /** achievements only */
    exam?: string;
    exam_name?: string | null;
    submitted_at?: string | null;
    /** SPT-64: that student's title, null when none. */
    title?: StudentTitle | null;
};

export type Board = {
    board: 'week' | 'achievements';
    total: number;
    limit: number;
    offset: number;
    entries: BoardEntry[];
    me: BoardEntry | null;
    week_start?: string;
    week_end?: string;
    exam?: string | null;
};
