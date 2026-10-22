import type {SemanticICONS} from 'semantic-ui-react';

// Display labels for the 8 block types — must match TEN_LOAI in core_question_bank.py.
// Keys are backend codes, never rename them. Shared by DrawExam and ImportExam.
export const BLOCK_LABELS = {
    DocHieu: 'Đọc hiểu (ngữ liệu + 5 câu)',
    TracNghiem: 'Trắc nghiệm chọn đáp án',
    DungSai: 'Câu đúng/sai',
    TraLoiNgan: 'Viết đáp án (trả lời ngắn)',
    TuLuan: 'Giải bài (tự luận)',
    VietDoan: 'Viết đoạn văn',
    VietBai: 'Viết bài văn',
    DienTu: 'Bài điền từ',
} as const;

export type BlockType = keyof typeof BLOCK_LABELS;

/**
 * Label of a block type, falling back to the raw code.
 * ponytail: when BE adds a new type the FE shows its code instead of nothing.
 */
export const blockLabel = (t: string) => (BLOCK_LABELS as Record<string, string>)[t] || t;

/**
 * Icon and color per block type. The create screen and the exam screen share
 * them, so the color a teacher drags in is the color the student sees.
 * Colors are tokens in src/styles/tokens.css (white text on them ≥ 4.5:1).
 */
export const BLOCK_STYLES: Record<string, {icon: SemanticICONS; color: string}> = {
    DocHieu: {icon: 'book', color: 'var(--tk-block-reading)'},
    TracNghiem: {icon: 'list ol', color: 'var(--tk-block-choice)'},
    DungSai: {icon: 'balance scale', color: 'var(--tk-block-truefalse)'},
    TraLoiNgan: {icon: 'i cursor', color: 'var(--tk-block-short)'},
    TuLuan: {icon: 'calculator', color: 'var(--tk-block-essay-math)'},
    VietDoan: {icon: 'paragraph', color: 'var(--tk-block-paragraph)'},
    VietBai: {icon: 'pencil alternate', color: 'var(--tk-block-essay)'},
    DienTu: {icon: 'puzzle piece', color: 'var(--tk-block-cloze)'},
};

// Hand-written exams have no block type → app primary color.
export const blockStyle = (t?: string | null) =>
    (t && BLOCK_STYLES[t]) || {icon: 'file alternate outline' as SemanticICONS, color: 'var(--tk-primary)'};
