/**
 * Exam frame ("khung") of a block bank: Nhóm → Phần → Tiểu mục (C1). Same shape as `core_layout.py` on the BE.
 * `{from}` / `{to}` inside a title or lead stand for the first / last question number of what the text belongs to
 * (a Phần for its lead, a Tiểu mục for its title) — the screen shows them as numbers it computes itself.
 */
export type LayoutItem = {title: string; block_type: string; count: number};
export type LayoutPart = {
    title: string; lead: string; description?: string | null; score?: number | null;
    numbering: 'continue' | 'restart'; items: LayoutItem[];
};
export type LayoutGroup = {title: string; parts: LayoutPart[]};
export type Layout = LayoutGroup[];

export type Range = {from: number; to: number} | null;

/** Questions a student sees per block. Only reading is more than one; the real number is recounted after drawing. */
const QUESTIONS_PER_BLOCK: Record<string, number> = {reading: 5};
export const questionsOf = (i: LayoutItem) => Math.max(0, i.count) * (QUESTIONS_PER_BLOCK[i.block_type] ?? 1);

export const newItem = (): LayoutItem => ({title: '', block_type: '', count: 1});
export const newPart = (): LayoutPart => ({title: '', lead: '', score: null, numbering: 'continue', items: [newItem()]});
export const newGroup = (): LayoutGroup => ({title: '', parts: [newPart()]});
export const emptyLayout = (): Layout => [newGroup()];

export type Numbers = {items: Range[][][]; parts: Range[][]; total: number};

const span = (ranges: Range[]): Range => {
    const real = ranges.filter((r): r is {from: number; to: number} => !!r);
    return real.length ? {from: real[0].from, to: real[real.length - 1].to} : null;
};

/** Question numbers of every tiểu mục and phần. A Phần with `restart` starts again at 1 (Văn: Phần II is "Câu 1"). */
export function numbering(layout: Layout): Numbers {
    let no = 0;
    const items: Range[][][] = [];
    const parts: Range[][] = [];
    layout.forEach(g => {
        const gi: Range[][] = [];
        const gp: Range[] = [];
        g.parts.forEach((p, pi) => {
            if (p.numbering === 'restart' && (items.length || pi)) no = 0;
            const pr: Range[] = p.items.map(i => {
                const n = questionsOf(i);
                const r = n > 0 ? {from: no + 1, to: no + n} : null;
                no += n;
                return r;
            });
            gi.push(pr);
            gp.push(span(pr));
        });
        items.push(gi);
        parts.push(gp);
    });
    return {items, parts, total: no};
}

/** `{from}`/`{to}` → the numbers; `?` while the range is unknown (no block chosen yet). */
export const fill = (text: string, r: Range) =>
    text.replace(/\{from\}/g, r ? String(r.from) : '?').replace(/\{to\}/g, r ? String(r.to) : '?');

/** "…từ câu … đến câu …" / "từ 1 đến 5" → "…từ câu {from} đến câu {to}" (the "Chèn số câu" button). */
export const insertNumbers = (text: string) =>
    text.replace(/(từ\s+(?:câu\s+)?)(…|\.{2,}|\d+)(\s+đến\s+(?:câu\s+)?)(…|\.{2,}|\d+)/i, '$1{from}$3{to}');

/** Text split into typed pieces and number tokens: [text, '{from}', text, '{to}', text]. Always odd-length around tokens. */
export const pieces = (text: string) => text.split(/(\{from\}|\{to\})/);
export const isToken = (s: string) => s === '{from}' || s === '{to}';

/** Blocks the frame needs per block type. */
export function needs(layout: Layout): Record<string, number> {
    const out: Record<string, number> = {};
    layout.forEach(g => g.parts.forEach(p => p.items.forEach(i => {
        if (i.block_type && i.count > 0) out[i.block_type] = (out[i.block_type] || 0) + i.count;
    })));
    return out;
}

/** Types whose stock is below what the frame needs, with how many are short. */
export const shortages = (layout: Layout, stock: Record<string, number>) =>
    Object.entries(needs(layout)).filter(([t, n]) => (stock[t] || 0) < n).map(([type, need]) => ({type, need, have: stock[type] || 0}));

/** Why the frame cannot be saved/previewed yet (null = fine). One sentence, shown next to the locked buttons. */
export function frameProblem(layout: Layout, name: string): string | null {
    const noType = layout.some(g => g.parts.some(p => p.items.some(i => !i.block_type)));
    const noCount = layout.some(g => g.parts.some(p => p.items.some(i => i.block_type && !(i.count >= 1))));
    if (!name.trim() && noType) return 'Chưa đặt tên đề và chưa chọn dạng khối.';
    if (!name.trim()) return 'Chưa đặt tên đề.';
    if (noType) return 'Chưa chọn dạng khối cho mọi tiểu mục.';
    if (noCount) return 'Số khối của mỗi tiểu mục phải từ 1 trở lên.';
    if (layout.some(g => g.parts.some(p => p.items.length === 0)) || layout.some(g => g.parts.length === 0)) return 'Có phần chưa có tiểu mục nào.';
    return null;
}

/** What goes to the BE: titles/leads trimmed, score only when typed. */
export const toPayload = (layout: Layout): Layout => layout.map(g => ({
    title: g.title.trim(),
    parts: g.parts.map(p => ({
        title: p.title.trim(), lead: p.lead.trim(), numbering: p.numbering,
        ...(p.description ? {description: p.description} : {}),
        ...(p.score ? {score: p.score} : {}),
        items: p.items.map(i => ({title: i.title.trim(), block_type: i.block_type, count: i.count})),
    })),
}));

/** Immutable edits, one place so the screen stays readable. */
export const edit = {
    group: (l: Layout, g: number, fn: (x: LayoutGroup) => LayoutGroup): Layout => l.map((x, i) => i === g ? fn(x) : x),
    part: (l: Layout, g: number, p: number, fn: (x: LayoutPart) => LayoutPart): Layout =>
        edit.group(l, g, x => ({...x, parts: x.parts.map((y, i) => i === p ? fn(y) : y)})),
    item: (l: Layout, g: number, p: number, i: number, fn: (x: LayoutItem) => LayoutItem): Layout =>
        edit.part(l, g, p, x => ({...x, items: x.items.map((y, j) => j === i ? fn(y) : y)})),
};

/** Move element `i` of a list by `by` (-1 up, +1 down); same list when it cannot move. */
export function shift<T>(list: T[], i: number, by: number): T[] {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}
