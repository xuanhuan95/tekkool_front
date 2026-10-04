/** Dữ liệu bài nộp BE trả về. Tên field khớp `Submission.to_dict` bên BE. */
export type Submission = {
    id: string;
    score: number;
    max_score: number;
    /** Điểm tối đa của riêng phần ĐÃ chấm — không phải cả bài. */
    graded_max_score: number;
    /** Số câu còn chờ giáo viên chấm. > 0 nghĩa là chưa có điểm cuối. */
    pending_count: number;
    status: SubmissionStatus;
    duration_sec?: number;
    submitted_at?: string;
    exam_name?: string;
    /**
     * Điểm gom theo phần. Bài nộp trước khi BE lưu `section_name` thì không
     * có field này — optional thật, không phải để FE tự đoán.
     */
    phan?: ScoreSection[];
};

export type SubmissionStatus = 'GRADING' | 'GRADED';

/** Một phần trong bảng điểm ("Phần I", "Phần II"...). */
export type ScoreSection = {
    ten: string;
    score: number;
    max_score: number;
    /** Số câu trong phần này còn chờ chấm. */
    pending: number;
    block_type?: string | null;
};
