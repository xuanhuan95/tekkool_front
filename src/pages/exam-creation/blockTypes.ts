// Tên tiếng Việt của 8 loại khối — khớp TEN_LOAI trong core_question_bank.py.
// Để riêng vì hai màn dùng chung: DrawExam (rút đề) và ImportExam (tồn kho).
export const TEN_LOAI = {
    DocHieu: 'Đọc hiểu (ngữ liệu + 5 câu)',
    TracNghiem: 'Trắc nghiệm chọn đáp án',
    DungSai: 'Câu đúng/sai',
    TraLoiNgan: 'Viết đáp án (trả lời ngắn)',
    TuLuan: 'Giải bài (tự luận)',
    VietDoan: 'Viết đoạn văn',
    VietBai: 'Viết bài văn',
    DienTu: 'Bài điền từ',
} as const;

export type BlockType = keyof typeof TEN_LOAI;

/**
 * Tên tiếng Việt của một loại khối, không có thì trả lại chính mã loại.
 * ponytail: BE thêm loại mới là FE hiện mã thay vì rỗng — vẫn đọc được.
 */
export const tenLoai = (t: string) => (TEN_LOAI as Record<string, string>)[t] || t;
