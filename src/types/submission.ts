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
    /** Hết giờ, máy nộp thay. */
    auto_submitted?: boolean;
    exam_id?: string;
    teacher_comment?: string | null;
    graded_at?: string | null;
    attempt_id?: string | null;
    /**
     * Tên học sinh. CHỈ có ở hai endpoint cho giáo viên (`exam/to_grade/<id>`,
     * `exam/pending`) và `exam/submission/<id>` — `exam/my_submissions` không
     * trả, vì học sinh tự xem bài mình thì không cần tên mình.
     */
    student?: string | null;
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

/**
 * Một câu trong bài đã nộp (`exam/submission/<id>`). Chỉ endpoint này trả
 * `answers`; danh sách bài nộp không kèm để khỏi tải cả đề mỗi dòng.
 */
export type SubmissionAnswer = {
    question_id: string;
    question_text?: string;
    /** Bài học sinh làm: id phương án (trắc nghiệm) hoặc HTML (tự luận). */
    answer?: string | null;
    /** null = chưa chấm. 0 không phải chưa chấm. */
    score: number | null;
    max_score: number;
    /** Máy chấm được (trắc nghiệm, điền khuyết) -> giáo viên không sửa tay. */
    auto_graded?: boolean;
    comment?: string | null;
    /** Đáp án đúng dạng chữ, chỉ có ở câu máy chấm. */
    correct?: string | null;
    correct_id?: string | null;
    answers?: AnswerChoice[];
    /** Ngữ liệu đọc hiểu dùng chung cho cả nhóm câu. */
    passage?: string | null;
    passage_id?: string | null;
};

export type AnswerChoice = {
    id: string;
    value?: string;
};

/** Bài nộp kèm chi tiết từng câu — dạng `exam/submission/<id>` trả về. */
export type SubmissionDetail = Submission & {
    answers?: SubmissionAnswer[];
    /** BE tự quyết: true khi người gọi là chủ đề. Đây mới là quyền chấm. */
    can_grade?: boolean;
};
