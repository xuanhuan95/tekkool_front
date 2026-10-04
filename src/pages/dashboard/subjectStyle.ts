import type {SemanticICONS} from 'semantic-ui-react';

export type SubjectStyle = {
    key: string;
    icon: SemanticICONS;
    bg: string;
    match?: string[];
};

// Icon + màu nhận theo TÊN môn, không theo thứ tự trong danh sách — giáo viên
// thêm môn mới đứng trước là mọi môn sau đó đổi icon, Toán thành chiếc lá.
//
// Tên icon đã đối chiếu với semantic-ui-css/components/icon.css: gõ sai tên
// thì Semantic render ô trống chứ không báo lỗi. 'atom', 'microscope',
// 'landmark' KHÔNG có trong bộ này — đừng thay vào.
export const SUBJECTS: SubjectStyle[] = [
    {key: 'van',     icon: 'pencil alternate', bg: 'linear-gradient(135deg,#f97316,#ea580c)', match: ['van', 'ngu van']},
    {key: 'anh',     icon: 'language',   bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', match: ['tieng anh', 'anh', 'english', 'ngoai ngu']},
    {key: 'toan',    icon: 'calculator', bg: 'linear-gradient(135deg,#6366f1,#4338ca)', match: ['toan']},
    {key: 'ly',      icon: 'magnet',     bg: 'linear-gradient(135deg,#f59e0b,#b45309)', match: ['ly', 'vat ly']},
    {key: 'hoa',     icon: 'flask',      bg: 'linear-gradient(135deg,#14b8a6,#0f766e)', match: ['hoa', 'hoa hoc']},
    {key: 'sinh',    icon: 'dna',        bg: 'linear-gradient(135deg,#16a34a,#15803d)', match: ['sinh', 'sinh hoc']},
    {key: 'su',      icon: 'hourglass half', bg: 'linear-gradient(135deg,#b45309,#78350f)', match: ['lich su', 'su']},
    {key: 'dia',     icon: 'map outline', bg: 'linear-gradient(135deg,#0891b2,#155e75)', match: ['dia ly', 'dia li', 'dia']},
    {key: 'gdcd',    icon: 'balance scale', bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', match: ['gdcd', 'giao duc cong dan', 'cong dan']},
    {key: 'tin',     icon: 'laptop',     bg: 'linear-gradient(135deg,#64748b,#334155)', match: ['tin hoc', 'tin']},
];

// Môn lạ (giáo viên tự đặt tên) vẫn phải có icon — không để trống.
export const FALLBACK: SubjectStyle = {
    key: 'khac', icon: 'folder open', bg: 'linear-gradient(135deg,#94a3b8,#475569)',
};

// Bỏ dấu để 'Hoá' và 'Hóa', 'Địa lý' và 'Dia ly' cùng khớp một mục.
// ponytail: normalize('NFD') + xoá dấu thanh là cách stdlib, không cần thư viện
// bỏ dấu tiếng Việt. Riêng 'đ' không phải ký tự có dấu tổ hợp nên xử riêng.
export function bodau(s?: string | null): string {
    return (s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().trim();
}

export function subjectStyle(name?: string | null): SubjectStyle {
    const n = bodau(name);
    // Khớp cả cụm trước, rồi mới khớp tiền tố — 'Lịch sử' phải ra 'su' chứ
    // không dính vào 'sinh'. So bằng ranh giới từ, không dùng includes().
    for (const s of SUBJECTS) {
        if (s.match!.some(m => n === m)) return s;
    }
    for (const s of SUBJECTS) {
        if (s.match!.some(m => n.startsWith(m + ' ') || n.endsWith(' ' + m))) return s;
    }
    return FALLBACK;
}
