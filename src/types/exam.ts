/** Thư mục: vừa là MÔN (folder gốc) vừa là BỘ ĐỀ (folder con) — BE không tách hai loại. */
export type Folder = {
    id: string;
    name: string;
    parent?: string | null;
};

/** Đề như BE trả về ở các màn duyệt/làm bài (khác Exam trong màn soạn đề). */
export type ExamSummary = {
    id: string;
    name: string;
    duration?: number;
    description?: string;
    question_count?: number;
    price?: number;
};
