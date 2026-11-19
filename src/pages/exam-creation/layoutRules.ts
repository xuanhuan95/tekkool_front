/**
 * Exam frame ("khung") of a block bank: Nhóm → Phần → Ô (C1). Same shape as `core_layout.py` on the BE.
 * `{from}` / `{to}` inside a title or lead stand for the first / last question number of what the text belongs to
 * (a Phần for its lead, an ô for its title) and `{n}` for the position of the ô in its Phần — the screen shows them
 * as numbers it computes itself. The BE does not know `{n}`: `toPayload` writes the number in before saving.
 */
export type LayoutItem = {title: string; block_type: string; count: number};
export type LayoutPart = {
    title: string; lead: string; description?: string | null; score?: number | null;
    numbering: 'continue' | 'restart'; items: LayoutItem[];
};
export type LayoutGroup = {title: string; parts: LayoutPart[]};
export type Layout = LayoutGroup[];

/** `to < from` = nothing to number yet (no block in the Phần): shown as "…". */
export type Range = {from: number; to: number};

/** Questions a student sees per block. Only reading is more than one; the real number is recounted after drawing. */
const QUESTIONS_PER_BLOCK: Record<string, number> = {reading: 5};
export const questionsOf = (i: LayoutItem) => Math.max(0, i.count) * (QUESTIONS_PER_BLOCK[i.block_type] ?? 1);

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
export const roman = (n: number) => ROMAN[n] || String(n);

/** A new Phần comes with the usual lead; the numbers in it are computed, so it stays right when blocks are added. */
export const newPart = (no = 1): LayoutPart => ({title: 'Phần ' + roman(no), lead: 'Thí sinh trả lời từ câu {from} đến câu {to}.', score: null, numbering: 'continue', items: []});
export const emptyLayout = (): Layout => [{title: '', parts: [newPart()]}];
export const partCount = (l: Layout) => l.reduce((n, g) => n + g.parts.length, 0);

export type Numbers = {items: Range[][][]; parts: Range[][]; total: number};

/** Question numbers of every ô and phần. A Phần with `restart` starts again at 1 (Văn: Phần II is "Câu 1"). */
export function numbering(layout: Layout): Numbers {
    let no = 0;
    const items: Range[][][] = [];
    const parts: Range[][] = [];
    layout.forEach(g => {
        const gi: Range[][] = [];
        const gp: Range[] = [];
        g.parts.forEach((p, pi) => {
            if (p.numbering === 'restart' && (items.length || pi)) no = 0;
            const start = no;
            gi.push(p.items.map(i => {
                const from = no + 1;
                no += questionsOf(i);
                return {from, to: no};
            }));
            gp.push({from: start + 1, to: no});
        });
        items.push(gi);
        parts.push(gp);
    });
    return {items, parts, total: no};
}

/** `{from}`/`{to}`/`{n}` → the numbers; "…" while the range is empty. */
export const fill = (text: string, r: Range, n = 1) => text
    .replace(/\{from\}/g, String(r.from)).replace(/\{to\}/g, r.to < r.from ? '…' : String(r.to)).replace(/\{n\}/g, String(n));

/** Text split into typed pieces and number tokens: [text, '{from}', text, '{to}', text]. */
export const pieces = (text: string) => text.split(/(\{from\}|\{to\}|\{n\})/);
export const isToken = (s: string) => s === '{from}' || s === '{to}' || s === '{n}';

/** Typed text back into the stored form: one line, and a letter/digit right after a number gets a space ("câu 10Mỗi"). */
export const tidy = (text: string) => text.replace(/\s*\n\s*/g, ' ').replace(/(\{(?:from|to|n)\})(?=[\p{L}\p{N}])/gu, '$1 ');

/** A sample's "I.2 … văn bản 2" becomes "I.{n} … văn bản {n}" so a copied ô renumbers itself (the BE has no `{n}` yet). */
export const numberize = (title: string, n: number) => /\{n\}/.test(title) ? title : title.replace(/\d+/g, m => m === String(n) ? '{n}' : m);

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

/** Why the frame cannot be saved yet (null = fine). One sentence, shown next to the locked button. */
export function frameProblem(layout: Layout, name: string): string | null {
    if (!name.trim()) return 'Chưa đặt tên đề.';
    if (!layout.some(g => g.parts.some(p => p.items.length > 0))) return 'Thêm ít nhất một đoạn hoặc câu để tạo đề.';
    if (layout.some(g => g.parts.some(p => p.items.length === 0))) return 'Có phần chưa có đoạn hoặc câu nào.';
    return null;
}

/** What goes to the BE: titles/leads trimmed, `{n}` written in as the position of the ô, score only when typed. */
export const toPayload = (layout: Layout): Layout => layout.map(g => ({
    title: g.title.trim(),
    parts: g.parts.map(p => ({
        title: p.title.trim(), lead: p.lead.trim(), numbering: p.numbering,
        ...(p.description ? {description: p.description} : {}),
        ...(p.score ? {score: p.score} : {}),
        items: p.items.map((i, k) => ({title: i.title.replace(/\{n\}/g, String(k + 1)).trim(), block_type: i.block_type, count: i.count})),
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

/** Blocks of one type in a Phần: what the "Số đoạn" stepper shows. */
export const sameCount = (p: LayoutPart, type: string) => p.items.filter(i => i.block_type === type).reduce((n, i) => n + i.count, 0);

/**
 * "+" / "−" in the block box: bring the Phần to `n` blocks of the type of ô `at`.
 * A titled ô (Văn: one ô per đoạn, "I.2 Đọc văn bản 2") is copied after the last ô of its type; an untitled one
 * (Hoá: "20 câu trắc nghiệm") gets a bigger count. Fewer: taken from the end.
 */
export function setCount(l: Layout, g: number, p: number, at: number, n: number): Layout {
    return edit.part(l, g, p, part => {
        const items = part.items.slice();
        const type = items[at].block_type;
        let have = sameCount(part, type);
        if (n > have) {
            if (items[at].title) {
                const last = items.map(i => i.block_type).lastIndexOf(type);
                items.splice(last + 1, 0, ...Array.from({length: n - have}, () => ({...items[last], count: 1})));
            } else items[at] = {...items[at], count: items[at].count + n - have};
        } else {
            for (let k = items.length - 1; k >= 0 && have > Math.max(1, n); k--) {
                if (items[k].block_type !== type) continue;
                const cut = Math.min(items[k].count, have - Math.max(1, n));
                have -= cut;
                if (cut >= items[k].count) items.splice(k, 1); else items[k] = {...items[k], count: items[k].count - cut};
            }
        }
        return {...part, items};
    });
}

export const addItem = (l: Layout, g: number, p: number, block_type: string): Layout =>
    edit.part(l, g, p, x => ({...x, items: [...x.items, {title: '', block_type, count: 1}]}));
export const removeItem = (l: Layout, g: number, p: number, i: number): Layout =>
    edit.part(l, g, p, x => ({...x, items: x.items.filter((_y, j) => j !== i)}));
export const addPartAfter = (l: Layout, g: number, p: number): Layout =>
    edit.group(l, g, x => ({...x, parts: [...x.parts.slice(0, p + 1), newPart(partCount(l) + 1), ...x.parts.slice(p + 1)]}));
export const removePart = (l: Layout, g: number, p: number): Layout =>
    l.map((x, i) => i === g ? {...x, parts: x.parts.filter((_y, j) => j !== p)} : x).filter(x => x.parts.length > 0);
export const movePart = (l: Layout, g: number, p: number, by: number): Layout => {
    const n = l[g].parts.length;
    if (p + by >= 0 && p + by < n) return edit.group(l, g, x => ({...x, parts: shift(x.parts, p, by)}));
    if (!canMove(l, g, p, by)) return l;
    const part = l[g].parts[p], to = g + Math.sign(by);   // across the edge: last of the Nhóm above / first of the Nhóm below
    return l.map((x, i) => i === g ? {...x, parts: x.parts.filter((_y, j) => j !== p)}
        : i === to ? {...x, parts: by < 0 ? [...x.parts, part] : [part, ...x.parts]} : x);
};
export const addGroup = (l: Layout): Layout => [...l, {title: '', parts: [newPart(partCount(l) + 1)]}];

/** Ô that the bank cannot fill (cumulative need of its type passes the stock), in sheet order; `tag` is "I.3". */
export function overflow(layout: Layout, stock: Record<string, number>) {
    const used: Record<string, number> = {};
    const out: {g: number; p: number; i: number; type: string; tag: string}[] = [];
    let part = 0;
    layout.forEach((g, gi) => g.parts.forEach((p, pi) => {
        part++;
        p.items.forEach((it, ii) => {
            used[it.block_type] = (used[it.block_type] || 0) + it.count;
            if (it.block_type && used[it.block_type] > (stock[it.block_type] || 0)) out.push({g: gi, p: pi, i: ii, type: it.block_type, tag: `${roman(part)}.${ii + 1}`});
        });
    }));
    return out;
}

/** How many times one student can sit the frame without meeting a block twice: the scarcest type decides. Null: nothing to draw. */
export function capacity(layout: Layout, stock: Record<string, number>): number | null {
    const need = Object.entries(needs(layout));
    return need.length ? Math.min(...need.map(([t, n]) => Math.floor((stock[t] || 0) / n))) : null;
}

/** Whether a Phần can move one place (`by` -1 up, +1 down); a Phần at the edge of a Nhóm crosses into the next one unless it is that Nhóm's only Phần. */
export function canMove(l: Layout, g: number, p: number, by: number): boolean {
    const edge = by < 0 ? p === 0 : p === l[g].parts.length - 1;
    return !edge || (l[g].parts.length > 1 && (by < 0 ? g > 0 : g < l.length - 1));
}

/** Sum of the points of all Phần and, when it is not 10 or a Phần has none, the yellow note (the student's score is scaled to 10 anyway). */
export function totalScore(l: Layout): {sum: number; warn: string} {
    const parts = l.flatMap(g => g.parts);
    const sum = Math.round(parts.reduce((n, p) => n + (p.score || 0), 0) * 100) / 100;
    const blank = parts.some(p => p.score == null);
    const warn = sum === 10 && !blank ? '' : blank && sum === 0 ? 'Chưa nhập điểm các phần — học sinh vẫn được quy về thang 10.'
        : `Tổng điểm đang là ${String(sum).replace('.', ',')}${blank ? ' (còn phần chưa nhập điểm)' : ''} — học sinh vẫn được quy về thang 10.`;
    return {sum, warn};
}
