/*
 * SPT-135: the 12 exam subjects as the design draws them (colour + icon key), the 5 combos, and the pure
 * rules of "choose 3–7 subjects" shared by sign-up step 2 and Hồ sơ → "Môn em thi".
 * BE stores folder ids (`exam_subjects`); names only decide colour/icon, so a renamed folder still works
 * (unknown name → neutral colour, generic icon).
 */

export type SubjectKey = 'math' | 'lit' | 'eng' | 'phys' | 'chem' | 'bio' | 'hist' | 'geo' | 'civ' | 'inf' | 'techi' | 'techa';

/** Display order of the design (also the order of the picker grid). */
export const SUBJECT_ORDER: SubjectKey[] = ['math', 'lit', 'eng', 'phys', 'chem', 'bio', 'hist', 'geo', 'civ', 'inf', 'techi', 'techa'];

export const MIN_SUBJECTS = 3;
export const MAX_SUBJECTS = 7;

/** "Hóa học" → "hoa hoc": lower-case, no accents, đ → d, only letters/digits. */
function plain(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Folder name → design key; null when the name is not one of the 12. */
export function subjectKey(name?: string | null): SubjectKey | null {
    const n = plain(name || '');
    if (!n) return null;
    if (n.includes('kinh te') && n.includes('phap luat')) return 'civ';
    if (/^cong nghe/.test(n)) return /(nong nghiep|dhnn|nn$)/.test(n) ? 'techa' : 'techi';
    if (n === 'toan' || n.startsWith('toan ')) return 'math';
    if (n.startsWith('ngu van') || n === 'van') return 'lit';
    if (n.startsWith('tieng anh') || n === 'anh') return 'eng';
    if (n.startsWith('vat ly') || n.startsWith('vat li')) return 'phys';
    if (n.startsWith('hoa')) return 'chem';
    if (n.startsWith('sinh')) return 'bio';
    if (n.startsWith('lich su')) return 'hist';
    if (n.startsWith('dia ly') || n.startsWith('dia li')) return 'geo';
    if (n.startsWith('tin hoc')) return 'inf';
    return null;
}

/** Sort rank: the 12 in design order, unknown names last (stable). */
export function subjectRank(name?: string | null): number {
    const k = subjectKey(name);
    return k ? SUBJECT_ORDER.indexOf(k) : SUBJECT_ORDER.length;
}

export function sortSubjects<T extends {name: string}>(list: T[]): T[] {
    return list.map((s, i) => ({s, i})).sort((a, b) => subjectRank(a.s.name) - subjectRank(b.s.name) || a.i - b.i).map(x => x.s);
}

export type Combo = {code: string; label: string; keys: SubjectKey[]};

export const COMBOS: Combo[] = [
    {code: 'A00', label: 'Toán · Lý · Hóa', keys: ['math', 'phys', 'chem']},
    {code: 'A01', label: 'Toán · Lý · Anh', keys: ['math', 'phys', 'eng']},
    {code: 'B00', label: 'Toán · Hóa · Sinh', keys: ['math', 'chem', 'bio']},
    {code: 'C00', label: 'Văn · Sử · Địa', keys: ['lit', 'hist', 'geo']},
    {code: 'D01', label: 'Toán · Văn · Anh', keys: ['math', 'lit', 'eng']},
];

type Named = {id: string; name: string};

/** Ids of a combo among the available subjects; null when one of its 3 subjects does not exist yet. */
export function comboIds(combo: Combo, subjects: Named[]): string[] | null {
    const ids = combo.keys.map(k => subjects.find(s => subjectKey(s.name) === k)?.id);
    return ids.every(Boolean) ? ids as string[] : null;
}

/** Combo button is "pressed" when the selection is exactly its subjects. */
export function comboPressed(combo: Combo, selected: string[], subjects: Named[]): boolean {
    const ids = comboIds(combo, subjects);
    return !!ids && ids.length === selected.length && ids.every(id => selected.includes(id));
}

/** Tick / untick one subject. Ticking beyond 7 is ignored. Order of ticking is kept. */
export function toggleSubject(selected: string[], id: string): string[] {
    if (selected.includes(id)) return selected.filter(x => x !== id);
    return selected.length >= MAX_SUBJECTS ? selected : [...selected, id];
}

/** Click a combo: select exactly its subjects; click the pressed combo again: clear. */
export function applyCombo(combo: Combo, selected: string[], subjects: Named[]): string[] {
    const ids = comboIds(combo, subjects);
    if (!ids) return selected;
    return comboPressed(combo, selected, subjects) ? [] : ids;
}

export type PickStatus = {ok: boolean; full: boolean; note: string | null; tone: 'err' | 'muted'};

/** Footer state of the picker: can submit (3–7), the grid is full (7), and the sentence under the button. */
export function pickStatus(count: number): PickStatus {
    if (count < MIN_SUBJECTS) return {ok: false, full: false, note: `Chọn thêm ${MIN_SUBJECTS - count} môn để tiếp tục.`, tone: 'err'};
    if (count >= MAX_SUBJECTS) return {ok: true, full: true, note: `Đã đủ ${MAX_SUBJECTS} môn.`, tone: 'muted'};
    return {ok: true, full: false, note: null, tone: 'muted'};
}
