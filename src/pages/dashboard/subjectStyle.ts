import type {SemanticICONS} from 'semantic-ui-react';

export type SubjectStyle = {
    key: string;
    icon: SemanticICONS;
    bg: string;
    /** Design palette (HomeDesktop.dc.html subjectColors): card tint, glyph disc colour, glyph text. */
    tint: string;
    fg: string;
    glyph: string;
    match?: string[];
};

// Icon + colour are chosen by subject NAME, not by position in the list — if a teacher
// adds a new subject at the front, every later subject changes icon, Math becomes a leaf.
//
// Icon names were checked against semantic-ui-css/components/icon.css: a mistyped name
// makes Semantic render an empty box with no error. 'atom', 'microscope',
// 'landmark' are NOT in this set — don't substitute them.
export const SUBJECTS: SubjectStyle[] = [
    {key: 'van',     icon: 'pencil alternate', bg: 'linear-gradient(135deg,#f97316,#ea580c)', tint: '#E6EEFF', fg: '#2D5FE0', glyph: 'Văn', match: ['van', 'ngu van']},
    {key: 'anh',     icon: 'language',   bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', tint: '#FFE9EC', fg: '#C93A4E', glyph: 'Aa', match: ['tieng anh', 'anh', 'english', 'ngoai ngu']},
    {key: 'toan',    icon: 'calculator', bg: 'linear-gradient(135deg,#6366f1,#4338ca)', tint: '#EEE9FF', fg: '#6B4BD6', glyph: '∑', match: ['toan']},
    {key: 'ly',      icon: 'magnet',     bg: 'linear-gradient(135deg,#f59e0b,#b45309)', tint: '#E4F6EA', fg: '#25834A', glyph: 'Lý', match: ['ly', 'vat ly']},
    {key: 'hoa',     icon: 'flask',      bg: 'linear-gradient(135deg,#14b8a6,#0f766e)', tint: '#FFF0DE', fg: '#B85F00', glyph: 'Hóa', match: ['hoa', 'hoa hoc']},
    {key: 'sinh',    icon: 'dna',        bg: 'linear-gradient(135deg,#16a34a,#15803d)', tint: '#E0F5F3', fg: '#16766F', glyph: 'Sinh', match: ['sinh', 'sinh hoc']},
    {key: 'su',      icon: 'hourglass half', bg: 'linear-gradient(135deg,#b45309,#78350f)', tint: '#FFF6D6', fg: '#8F6400', glyph: 'Sử', match: ['lich su', 'su']},
    {key: 'dia',     icon: 'map outline', bg: 'linear-gradient(135deg,#0891b2,#155e75)', tint: '#E8ECFF', fg: '#4352C9', glyph: 'Địa', match: ['dia ly', 'dia li', 'dia']},
    {key: 'gdcd',    icon: 'balance scale', bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', tint: '#EEE9FF', fg: '#6B4BD6', glyph: 'CD', match: ['gdcd', 'giao duc cong dan', 'cong dan']},
    {key: 'tin',     icon: 'laptop',     bg: 'linear-gradient(135deg,#64748b,#334155)', tint: '#E8ECFF', fg: '#4352C9', glyph: 'Tin', match: ['tin hoc', 'tin']},
];

// An unknown subject (named by the teacher) must still have an icon — never blank.
export const FALLBACK: SubjectStyle = {
    key: 'khac', icon: 'folder open', bg: 'linear-gradient(135deg,#94a3b8,#475569)', tint: '#E6EEFF', fg: '#2D5FE0', glyph: '•',
};

// Strip accents so 'Hoá' and 'Hóa', 'Địa lý' and 'Dia ly' match the same entry.
// ponytail: normalize('NFD') + removing tone marks is the stdlib way, no Vietnamese
// accent-stripping library needed. 'đ' alone is not a combining-accent character so it is handled separately.
export function stripAccents(s?: string | null): string {
    return (s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().trim();
}

export function subjectStyle(name?: string | null): SubjectStyle {
    const n = stripAccents(name);
    // Match the whole phrase first, then the prefix — 'Lịch sử' must give 'su' and
    // not get caught by 'sinh'. Compare on word boundaries, not includes().
    for (const s of SUBJECTS) {
        if (s.match!.some(m => n === m)) return s;
    }
    for (const s of SUBJECTS) {
        if (s.match!.some(m => n.startsWith(m + ' ') || n.endsWith(' ' + m))) return s;
    }
    return FALLBACK;
}
