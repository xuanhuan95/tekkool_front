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

/** Tồn kho ngân hàng câu hỏi — `question_bank/stats`. */
export type BankStats = {
    /** Số khối đang có, theo từng loại. Loại chưa có khối nào thì vắng mặt. */
    per_type: Record<string, number>;
    total?: number;
};

/** Sức chứa ngân hàng — `question_bank/capacity`. */
export type BankCapacity = {
    /** Ma trận: mỗi đề cần bao nhiêu khối mỗi loại. BE lấy từ MA_TRAN của môn. */
    slots: Record<string, number>;
    /** Số lần một học sinh làm lại được mà không gặp lại khối cũ. */
    capacity: number;
    /**
     * Loại đang chặn `capacity`. BE trả [loại, số lần] chứ không phải chuỗi —
     * FE chỉ đọc phần tử [0].
     */
    bottleneck?: [string, number] | null;
    subject?: string;
    /** Tồn kho theo loại. Có mặt khi hỏi theo `bank` — ImportExam đọc để vẽ bảng. */
    per_type?: Record<string, number>;
};

/** Một ngân hàng câu hỏi — `question_bank/list`. */
export type QuestionBank = {
    id: string;
    name: string;
    subject?: string;
};
