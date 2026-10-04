/** Dữ liệu câu hỏi: mỗi loại dùng một tập field khác nhau. */
export type QuestionData = {
    question?: string;
    passage?: string;
    passageId?: string;
    max_words?: number;
    answers?: Array<{id: string; value: string}>;
    correctAnswerId?: string;
    /** CẢNH BÁO: nghĩa khác nhau tuỳ loại — TrueFalse đọc boolean, FillBlank đọc chuỗi HTML. */
    answer?: unknown;
};

/**
 * Đổi loại câu hỏi: giữ dữ liệu dùng chung, BỎ dữ liệu riêng của loại cũ.
 *
 * Nguy hiểm nhất là `data.answer` — TrueFalse đọc nó như boolean, FillBlank
 * đọc như chuỗi HTML. Mang nguyên sang là chấm máy ra điểm sai, nên hàm này
 * dựng object MỚI thay vì sửa object cũ.
 */
export function convertData(data: QuestionData, to: string): QuestionData {
    // question / passage / passageId / max_words dung chung moi loai.
    const {question, passage, passageId, max_words} = data;
    const next: QuestionData = {question};
    if (passage) { next.passage = passage; next.passageId = passageId; }

    if (to === 'MultipleChoice' || to === 'ErrorIdentify') {
        // Giu lai phuong an neu von la trac nghiem, khong thi giao vien tu them.
        next.answers = data.answers || [];
        if (data.correctAnswerId) next.correctAnswerId = data.correctAnswerId;
    } else if (to === 'FreeAnswer') {
        if (max_words) next.max_words = max_words;
    }
    // TrueFalse: khong set data.answer — TrueFalse.jsx coi undefined la CHUA CHON
    // va bo checked ca hai radio. Dat san true/false la gan bua dap an dung.
    // FillBlank: khong set data.answer — de trong cho giao vien go.
    return next;
}
