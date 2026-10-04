import {uuid} from "../../tools";

export type Question = {
    id: string;
    type: string;
    exam: string;
    section: string;
    data: Record<string, any>;
};

export type Section = {
    id: string;
    exam: string;
    name: string;
    question_type: string;
    questions: Question[];
};

export type Exam = {
    id: string;
    name: string;
    section_label: string;
    duration: number;
    sections: Section[];
    /** Tiêu đề góc trái/phải của bản in. Đề tạo mới chưa có -> optional. */
    left_header?: string;
    right_header?: string;
    /** Chủ đề. CreateExam gán từ người đang đăng nhập trước khi POST. */
    user?: string;
};

export default class Default {
    // ponytail: bug gốc 2018 — BE apis/exam.py:39 đọc data['section_label']
    // (bắt buộc) nhưng FE không có field này ở đâu cả -> mọi đề TẠO MỚI đều
    // 500 KeyError khi Save. Model BE để StringField() không required nên
    // thêm giá trị mặc định ở đây là đủ, không phải chạm tekkool_back.
    // ponytail: 45 phut — dung con so DoExam hardcode truoc day, nay thanh mac
    // dinh sua duoc. 0 = khong gioi han gio.
    static DURATION = 45;

    static exam = (): Exam => ({
        id: 'E_' + uuid(),
        name: '',
        section_label: 'Phần',
        duration: Default.DURATION,
        sections: []
    });

    // ponytail: bug gốc 2018 — BE apis/exam.py:31 đọc s['question_type'] (bắt buộc)
    // nhưng section chỉ có field này sau khi thêm câu hỏi đầu tiên. Bấm Save (hoặc
    // auto-save sau 2 phút) khi section còn rỗng -> 500 KeyError. Model BE để
    // StringField() không required nên giá trị mặc định ở đây là đủ.
    static section = (examId: string): Section => ({
        id: 'S_' + uuid(),
        exam: examId,
        name: '',
        question_type: '',
        questions: []
    });

    static question = (type: string, examId: string, sectionId: string): Question => ({
        id: 'Q_' + uuid(),
        type: type,
        exam: examId,
        section: sectionId,
        data: {}
    });
}
