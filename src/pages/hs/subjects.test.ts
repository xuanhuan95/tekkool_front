import {describe, it, expect} from 'vitest';

import {COMBOS, MAX_SUBJECTS, applyCombo, comboBlocked, comboPressed, pickStatus, sortSubjects, subjectKey, toggleSubject} from './subjects';

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
    const combo = (code: string) => COMBOS.find(c => c.code === code)!;
    const ids = (...n: string[]) => n.map(id).sort();
    const sorted = (a: string[]) => [...a].sort();

    it('combo not pressed: ADDS its subjects and keeps the ones already chosen', () => {
        const picked = applyCombo(combo('A00'), [id('Tiếng Anh')], subjects);
        expect(sorted(picked)).toEqual(ids('Tiếng Anh', 'Toán', 'Vật lý', 'Hóa học'));
        expect(picked[0]).toBe(id('Tiếng Anh'));   // earlier ticks keep their place
        expect(comboPressed(combo('A00'), picked, subjects)).toBe(true);
    });
    it('two combos stay pressed together (A00 + B00 = 4 subjects)', () => {
        const sel = applyCombo(combo('B00'), applyCombo(combo('A00'), [], subjects), subjects);
        expect(sorted(sel)).toEqual(ids('Toán', 'Vật lý', 'Hóa học', 'Sinh học'));
        expect(comboPressed(combo('A00'), sel, subjects)).toBe(true);
        expect(comboPressed(combo('B00'), sel, subjects)).toBe(true);
        expect(comboPressed(combo('A01'), sel, subjects)).toBe(false);   // Anh missing
    });
    it('pressed combo removes its subjects but keeps those still in another pressed combo', () => {
        const both = applyCombo(combo('B00'), applyCombo(combo('A00'), [], subjects), subjects);
        const noA = applyCombo(combo('A00'), both, subjects);   // Toán + Hóa stay (B00), Lý goes
        expect(sorted(noA)).toEqual(ids('Toán', 'Hóa học', 'Sinh học'));
        expect(comboPressed(combo('B00'), noA, subjects)).toBe(true);
        expect(applyCombo(combo('B00'), noA, subjects)).toEqual([]);
        // a hand-ticked subject outside the combo is not touched
        expect(applyCombo(combo('A00'), applyCombo(combo('A00'), [id('Lịch sử')], subjects), subjects)).toEqual([id('Lịch sử')]);
    });
    it('combo whose subject does not exist: no change, never pressed or blocked', () => {
        const noBio = subjects.filter(s => s.name !== 'Sinh học');
        expect(applyCombo(combo('B00'), ['k'], noBio)).toEqual(['k']);
        expect(comboPressed(combo('B00'), [id('Toán'), id('Hóa học')], noBio)).toBe(false);
        expect(comboBlocked(combo('B00'), Array.from({length: 7}, (_, i) => 'x' + i), noBio)).toBe(false);
    });
    it('adding a combo that would pass 7 subjects is refused; that combo is blocked, the pressed ones are not', () => {
        // Toán, Văn, Anh, Lý, Hóa, Sinh, Sử = 7 (the max7 artboard)
        const seven = [id('Toán'), id('Ngữ văn'), id('Tiếng Anh'), id('Vật lý'), id('Hóa học'), id('Sinh học'), id('Lịch sử')];
        expect(comboBlocked(combo('C00'), seven, subjects)).toBe(true);   // needs Địa
        expect(applyCombo(combo('C00'), seven, subjects)).toEqual(seven);
        for (const code of ['A00', 'A01', 'B00', 'D01']) {
            expect(comboPressed(combo(code), seven, subjects)).toBe(true);
            expect(comboBlocked(combo(code), seven, subjects)).toBe(false);
        }
        // 6 chosen, C00 needs Sử + Địa → 8: blocked
        expect(comboBlocked(combo('C00'), seven.slice(0, 6), subjects)).toBe(true);
        // 5 chosen incl. Văn, C00 needs only Sử + Địa → exactly 7: allowed
        const five = [id('Toán'), id('Ngữ văn'), id('Tiếng Anh'), id('Vật lý'), id('Hóa học')];
        expect(comboBlocked(combo('C00'), five, subjects)).toBe(false);
        expect(applyCombo(combo('C00'), five, subjects)).toHaveLength(7);
    });
});
