import type {SemanticICONS} from 'semantic-ui-react';

// Display labels for the 8 block types — must match TEN_LOAI in core_question_bank.py.
// Keys are backend codes, never rename them. Shared by DrawExam and ImportExam.
export const BLOCK_LABELS = {
    reading: 'Đọc hiểu (ngữ liệu + 5 câu)',
    multiple_choice: 'Trắc nghiệm chọn đáp án',
    true_false: 'Câu đúng/sai',
    short_answer: 'Viết đáp án (trả lời ngắn)',
    short_answer_group: 'Câu chùm (dẫn liệu + 4 ý)',
    problem: 'Giải bài (tự luận)',
    paragraph: 'Viết đoạn văn',
    essay: 'Viết bài văn',
    cloze: 'Bài điền từ',
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
    reading: {icon: 'book', color: 'var(--tk-block-reading)'},
    multiple_choice: {icon: 'list ol', color: 'var(--tk-block-choice)'},
    true_false: {icon: 'balance scale', color: 'var(--tk-block-truefalse)'},
    short_answer: {icon: 'i cursor', color: 'var(--tk-block-short)'},
    short_answer_group: {icon: 'sitemap', color: 'var(--tk-block-short)'},
    problem: {icon: 'calculator', color: 'var(--tk-block-essay-math)'},
    paragraph: {icon: 'paragraph', color: 'var(--tk-block-paragraph)'},
    essay: {icon: 'pencil alternate', color: 'var(--tk-block-essay)'},
    cloze: {icon: 'puzzle piece', color: 'var(--tk-block-cloze)'},
};

// Hand-written exams have no block type → app primary color.
export const blockStyle = (t?: string | null) =>
    (t && BLOCK_STYLES[t]) || {icon: 'file alternate outline' as SemanticICONS, color: 'var(--tk-primary)'};

/** What the create-from-bank sheet calls a block: a teacher thinks "đoạn đọc hiểu", never "khối". */
const SHEET_KINDS: Record<string, {name: string; unit: string}> = {
    reading: {name: 'Đoạn đọc hiểu', unit: 'đoạn'},
    paragraph: {name: 'Câu viết đoạn văn', unit: 'câu'},
    essay: {name: 'Câu viết bài văn', unit: 'câu'},
};
export const kindName = (t: string) => SHEET_KINDS[t]?.name ?? blockLabel(t).replace(/\s*\(.*\)$/, '');
export const kindUnit = (t: string) => SHEET_KINDS[t]?.unit ?? 'câu';
/** Type as a teacher names it in a sentence: "Viết đoạn văn", "Đọc hiểu" (the label without the bracket). */
export const typeName = (t: string) => blockLabel(t).replace(/\s*\(.*\)$/, '');
