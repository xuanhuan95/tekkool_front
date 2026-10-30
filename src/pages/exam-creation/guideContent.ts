/**
 * Content of the "Lỗi thường gặp" page + the link from a coded warning (`issues[].code`, SPT-93) to its entry.
 * Wording is the draft in tekkool_back/docs/mau-de/loi-thuong-gap.md; Zeus edits the text here.
 */

export type GuideEntry = {
    id: string;          // anchor: /import-exam/loi-thuong-gap#<id>
    title: string;
    symptom: string;
    cause: string;
    steps: string[];
    wrong?: string;
    right?: string;
    soon?: boolean;      // listed under "Sắp thêm" in the side list
};

export const GUIDE: GuideEntry[] = [
    {
        id: 'mat-cau', title: 'Mất câu hoặc mất phương án',
        symptom: 'Đề có 27 câu nhưng chỉ đọc được 26; hoặc phương án A–D của một câu hiện thành câu tự luận.',
        cause: 'Câu hoặc phương án nằm chung đoạn với câu trên vì xuống dòng bằng Shift+Enter. Hệ thống chỉ nhận “Câu n.” và “A.” ở đầu đoạn.',
        steps: ['Đặt con trỏ trước “Câu n.” hoặc trước chữ A, B, C, D bị dính.', 'Bấm Enter để tách thành đoạn riêng (không dùng Shift+Enter).',
            'Tải lại file và kiểm tra con số “Số câu” ở đầu màn Xem trước.'],
        wrong: 'Câu 5. Chất nào sau đây …?↵ A. HCl B. CH₃COOH C. … D. …  (↵ = Shift+Enter, cùng một đoạn)',
        right: 'Câu 5. Chất nào sau đây …?¶ A. HCl¶ B. CH₃COOH¶  (¶ = Enter, mỗi dòng một đoạn)',
    },
    {
        id: 'mui-ten', title: 'Mũi tên phản ứng bị mất',
        symptom: 'Câu có sơ đồ hoặc cân bằng hoá học hiện “CaCO₃(s)  CaO(s)”: không còn mũi tên, điều kiện nằm lơ lửng.',
        cause: 'Mũi tên vẽ bằng ký tự lạ hoặc hình, hoặc dùng “↔” thay cho dấu cân bằng. Hệ thống đọc tốt nhất khi mũi tên và điều kiện nằm trong Equation của Word.',
        steps: ['Chọn đoạn có phản ứng, xoá phần mũi tên cũ.', 'Vào Insert › Equation, gõ lại phản ứng; dấu cân bằng dùng ký tự ⇌.',
            'Chỉ số dưới gõ bằng Subscript: H₂SO₄, không gõ “H2SO4”.'],
        wrong: 'CaCO₃(s) ↔ CaO(s) + CO₂(g)', right: 'CaCO₃(s) ⇌ CaO(s) + CO₂(g)  (trong Equation)',
    },
    {
        id: 'bang', title: 'Bảng bị làm phẳng',
        symptom: 'Bảng số liệu hiện thành một cột chữ: “Li, Na, K, 181, 98, 63”. Không biết số nào của chất nào.',
        cause: 'Bảng không phải bảng Word (dựng bằng dấu cách hoặc dán từ hình), hoặc bảng lồng trong bảng khác.',
        steps: ['Dựng lại bằng Insert › Table, mỗi giá trị một ô.', 'Không lồng bảng trong bảng.', 'Nếu bảng ở dạng hình ảnh, giữ nguyên là hình.'],
    },
    {
        id: 'latex', title: 'Công thức gõ thô (LaTeX)',
        symptom: 'Học sinh thấy chữ “\\(H_2X\\)” thay vì công thức.',
        cause: 'Công thức được gõ như văn bản bằng cú pháp LaTeX. Hệ thống chỉ hiển thị công thức tạo bằng Equation hoặc MathType.',
        steps: ['Xoá đoạn \\(…\\) và gõ lại bằng Insert › Equation.', 'Công thức cũ bằng MathType dạng ảnh WMF: gõ lại bằng Equation, hoặc chụp ảnh rồi chèn PNG.'],
    },
    {
        id: 'khong-dap-an', title: 'Không tìm thấy đáp án',
        symptom: 'Mọi câu hiện “Chưa có đáp án đúng”, phải chọn tay từng câu.',
        cause: 'File không đánh dấu đáp án theo cách nào hệ thống nhận, hoặc bảng ĐÁP ÁN không đứng sau dòng “HẾT”.',
        steps: ['Chọn một trong ba cách: gạch chân chữ cái, tô màu chữ cái, hoặc bảng ĐÁP ÁN sau “HẾT”.',
            'Bảng ĐÁP ÁN: dòng tiêu đề ghi “ĐÁP ÁN”, các phần ghi “Phần I”, “Phần II”.', 'Hoặc dùng “Dán đáp án nhanh” ngay trên màn Xem trước.'],
    },
    {
        id: 'tron-cach', title: 'File trộn nhiều cách đánh dấu đáp án',
        symptom: 'Báo đáp án khác nhau giữa bảng ĐÁP ÁN và dấu gạch chân / tô màu.',
        cause: 'Trong cùng một file có câu gạch chân, câu tô màu, hoặc bảng đáp án nói khác phần đánh dấu.',
        steps: ['Mỗi file chỉ dùng một cách đánh dấu đáp án.', 'Sửa các câu được báo, rồi nhập lại file.'],
    },
    {
        id: 'phu-luc', title: 'Phụ lục và ghi chú nội bộ lẫn trong đề',
        symptom: 'Đáp án trả lời ngắn là một đoạn chữ dài, hoặc nội dung câu có “[CẦN … KIỂM TRA]”.',
        cause: 'Trong file có phụ lục lời giải, phân tích cho chuyên gia hoặc ghi chú nội bộ nằm sau bảng đáp án.',
        steps: ['Xoá phụ lục, ghi chú “[CẦN … KIỂM TRA]”, mã phiếu khỏi file trước khi tải lên.', 'Để chúng ở một file riêng.'],
    },
    {
        id: 'cau-chum', title: 'Phần IV câu chùm không đọc được', soon: true,
        symptom: 'Phần có câu chùm (nhiều ý 1), 2), …) báo “không đọc được câu nào”.',
        cause: 'Dạng câu chùm chưa nhập tự động được; phần này không đưa vào đề, nội dung gốc vẫn xem được ở bản gốc.',
        steps: ['Xem nội dung ở cột Bản gốc.', 'Chờ bản cập nhật hỗ trợ câu chùm.'],
    },
];

// ponytail: only the codes with an entry above; the rest (PASTE_*, NO_DECLARED_COUNT, …) have no "Cách sửa" link.
const ANCHOR: Record<string, string> = {
    COUNT_MISMATCH: 'mat-cau', NUMBER_GAP: 'mat-cau', NUMBER_DUPLICATE: 'mat-cau', SWALLOWED_QUESTION: 'mat-cau', EMPTY_SECTION: 'mat-cau',
    OPTION_COUNT: 'mat-cau', TF_STATEMENT_COUNT: 'mat-cau', MC_AS_ESSAY: 'mat-cau', SECTION_TYPE_MIXED: 'mat-cau', IMAGE_BEFORE_QUESTION: 'mat-cau',
    TABLE_KEPT_FLAT: 'bang', RAW_LATEX: 'latex', UNREADABLE_FORMULA: 'latex',
    NO_ANSWERS: 'khong-dap-an', MISSING_ANSWER: 'khong-dap-an',
    ANSWER_CONFLICT: 'tron-cach', MIXED_MARKING: 'tron-cach', MULTI_MARK: 'tron-cach',
    INTERNAL_NOTE: 'phu-luc', APPENDIX_SKIPPED: 'phu-luc', UNSUPPORTED_CLUSTER: 'cau-chum',
};

export const GUIDE_PATH = '/import-exam/loi-thuong-gap';

/** `?bank=` / `?folder=` of the import screen, to carry to the guide and back (empty when neither is set). */
export const ctxQuery = (p: URLSearchParams) =>
    p.get('bank') ? '?bank=' + encodeURIComponent(p.get('bank')!) : p.get('folder') ? '?folder=' + encodeURIComponent(p.get('folder')!) : '';

/** Where "Cách sửa" goes for a warning code, or null when the guide has nothing for it. */
export const fixHref = (code: string, ctx = '') => ANCHOR[code] ? `${GUIDE_PATH}${ctx}#${ANCHOR[code]}` : null;

/** Short name of a warning for the chip on the question card. */
const LABEL: Record<string, string> = {
    RAW_LATEX: 'Công thức gõ thô', TABLE_KEPT_FLAT: 'Bảng bị làm phẳng', UNREADABLE_FORMULA: 'Công thức không đọc được',
    OPTION_COUNT: 'Số phương án khác 4', TF_STATEMENT_COUNT: 'Đúng/Sai không đủ 4 ý', MISSING_ANSWER: 'Chưa có đáp án',
    NUMBER_GAP: 'Số câu nhảy', NUMBER_DUPLICATE: 'Trùng số câu', MC_AS_ESSAY: 'Có A. B. C. D. nhưng không phải trắc nghiệm',
    SECTION_TYPE_MIXED: 'Dạng câu lệch tiêu đề phần', IMAGE_BEFORE_QUESTION: 'Hình đứng trước câu kế', SWALLOWED_QUESTION: 'Có câu bị dính vào',
    ANSWER_CONFLICT: 'Đáp án mâu thuẫn', MULTI_MARK: 'Nhiều phương án được đánh dấu', EMPTY_CONTENT: 'Nội dung rỗng',
    INTERNAL_NOTE: 'Còn ghi chú nội bộ', UNSUPPORTED_CLUSTER: 'Câu chùm chưa hỗ trợ',
};
export const issueLabel = (code: string) => LABEL[code] || 'Cần kiểm tra';
