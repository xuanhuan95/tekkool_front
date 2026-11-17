import {describe, it, expect} from 'vitest';

import {COMBOS, MAX_SUBJECTS, applyCombo, comboPressed, pickStatus, sortSubjects, subjectKey, toggleSubject} from './subjects';

const NAMES = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý'];
const subjects = NAMES.map((name, i) => ({id: 's' + i, name}));
const id = (n: string) => subjects.find(s => s.name === n)!.id;

describe('subjectKey', () => {
    it('maps the 12 folder names (with or without accents)', () => {
        expect(subjectKey('Hóa học')).toBe('chem');
        expect(subjectKey('Hoa hoc')).toBe('chem');
        expect(subjectKey('Địa lý')).toBe('geo');
        expect(subjectKey('GD Kinh tế & Pháp luật')).toBe('civ');
        expect(subjectKey('Công nghệ (ĐHCN)')).toBe('techi');
        expect(subjectKey('Công nghệ (ĐHNN)')).toBe('techa');
        expect(subjectKey('Môn lạ')).toBeNull();
        expect(subjectKey(null)).toBeNull();
    });
    it('sorts in design order, unknown names last', () => {
        const out = sortSubjects([{name: 'Lạ'}, {name: 'Hóa học'}, {name: 'Toán'}]).map(s => s.name);
        expect(out).toEqual(['Toán', 'Hóa học', 'Lạ']);
    });
});

describe('choose 3–7 subjects', () => {
    it('toggles on and off, keeps the order of ticking', () => {
        let sel = toggleSubject([], 'a');
        sel = toggleSubject(sel, 'b');
        expect(sel).toEqual(['a', 'b']);
        expect(toggleSubject(sel, 'a')).toEqual(['b']);
    });
    it('ignores an 8th tick', () => {
        const seven = Array.from({length: MAX_SUBJECTS}, (_, i) => 'x' + i);
        expect(toggleSubject(seven, 'extra')).toEqual(seven);
        expect(toggleSubject(seven, 'x0')).toHaveLength(MAX_SUBJECTS - 1);
    });
    it('pickStatus: <3 blocks with a hint, 3–6 ok, 7 ok and full', () => {
        expect(pickStatus(0)).toMatchObject({ok: false, note: 'Chọn thêm 3 môn để tiếp tục.', tone: 'err'});
        expect(pickStatus(2)).toMatchObject({ok: false, note: 'Chọn thêm 1 môn để tiếp tục.'});
        expect(pickStatus(3)).toMatchObject({ok: true, full: false, note: null});
        expect(pickStatus(6).ok).toBe(true);
        expect(pickStatus(7)).toMatchObject({ok: true, full: true, note: 'Đã đủ 7 môn.'});
    });
    it('combo selects exactly its 3 subjects; pressing it again clears; missing subject → no change', () => {
        const a00 = COMBOS.find(c => c.code === 'A00')!;
        const picked = applyCombo(a00, ['zzz'], subjects);
        expect(picked.sort()).toEqual([id('Toán'), id('Vật lý'), id('Hóa học')].sort());
        expect(comboPressed(a00, picked, subjects)).toBe(true);
        expect(applyCombo(a00, picked, subjects)).toEqual([]);
        const b00 = COMBOS.find(c => c.code === 'B00')!;
        expect(applyCombo(b00, ['k'], subjects.filter(s => s.name !== 'Sinh học'))).toEqual(['k']);
    });
});
