// Đếm và cắt văn bản theo hạn mức từ/ký tự của đề.
// Tách khỏi Editor.tsx để test gọi được hàm THẬT — Editor kéo theo cả tiptap
// nên trước đây logic này không có cách nào kiểm riêng.

export type Unit = 'word' | 'char';

export const WORD: Unit = 'word';

/**
 * Đếm theo đơn vị giáo viên chọn.
 *
 * 'word': tách theo dấu cách — đúng cho CẢ Tiếng Anh ("I am a student" = 4 từ)
 *   lẫn Ngữ văn ("Trường Trung học phổ thông" = 5 chữ), vì tiếng Việt viết rời
 *   từng tiếng nên "đếm chữ/tiếng" chính là tách dấu cách.
 * 'char': ponytail: đếm THÔ (không trim, không gộp space) — trim thì space cuối
 *   tính 0 nên gõ space vô hạn được ở mốc 20/20, nhìn như hỏng.
 */
export function measure(text: string, unit: Unit): number {
    if (unit !== WORD) return text.length;
    const t = text.trim();
    return t === '' ? 0 : t.split(/\s+/).length;
}

/**
 * Cắt phần dán cho vừa hạn mức. Chặt nhị phân trên số ký tự rồi (nếu đếm từ)
 * lùi về ranh giới từ gần nhất — cắt giữa chữ thì "student" thành "stud".
 */
export function trimToFit(head: string, pasted: string, max: number, unit: Unit): string {
    let lo = 0, hi = pasted.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (measure(head + pasted.slice(0, mid), unit) <= max) lo = mid; else hi = mid - 1;
    }
    let cut = pasted.slice(0, lo);
    if (unit === WORD && lo < pasted.length) {
        // Bỏ từ bị cắt dở ("stud") VÀ space cuối. Giữ space thì head thành
        // "...rat " -> gõ tiếp 1 chữ là sang từ thứ 6 nên bị chặn, trong khi gõ
        // space lại lọt (trim bỏ đi, vẫn 5 từ) — đúng ngược ý muốn.
        cut = cut.replace(/\s*\S*$/, '');
    }
    return cut;
}
