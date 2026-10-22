/** Shapes of the student endpoints used by the HS screens (read from tekkool_back apis/*.py). */

/** `folder/subjects` — one root folder = one subject, with the viewer's progress. */
export type SubjectSummary = {
    id: string;
    name: string;
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
};

/** `me/profile`. */
export type MeProfile = {
    id: string;
    name: string;
    email: string;
    group: string | null;
    hide_ranking_name: boolean;
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
