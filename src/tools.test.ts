import {describe, it, expect} from 'vitest';
import {setNestedValue, uuid} from './tools';

// Every real call in the app has the `a[id=X].b` form (Section.jsx,
// BaseQuestion, MultipleChoice, ErrorIdentify) — that is the path that must be most solid.
describe('setNestedValue', () => {
    it('edits the right element by id, leaving other elements alone', () => {
        const exam = {sections: [{id: 'S1', name: 'cũ'}, {id: 'S2', name: 'giữ'}]};
        setNestedValue(exam, 'sections[id=S1].name', 'mới');
        expect(exam.sections[0].name).toBe('mới');
        expect(exam.sections[1].name).toBe('giữ');
    });

    it('compares ids as strings — numeric id 1 must match "1"', () => {
        const o = {items: [{id: 1, v: 'a'}]};
        setNestedValue(o, 'items[id=1].v', 'b');
        expect(o.items[0].v).toBe('b');
    });

    it('a nonexistent id must not corrupt the array', () => {
        const o = {items: [{id: 'A', v: 1}]};
        expect(() => setNestedValue(o, 'items[id=ZZZ].v', 9)).toThrow();
        expect(o.items[0].v).toBe(1);
    });

    it('two levels deep: question inside section', () => {
        const section = {questions: [{id: 'Q1', data: {}}]};
        setNestedValue(section, 'questions[id=Q1].data', {x: 1});
        expect(section.questions[0].data).toEqual({x: 1});
    });

    it('plain integer index', () => {
        const o = {a: {b: [1, 2]}};
        setNestedValue(o, 'a.b[0]', 9);
        expect(o.a.b).toEqual([9, 2]);
    });

    it('flat key', () => {
        const o: Record<string, unknown> = {a: 1};
        setNestedValue(o, 'a', 2);
        expect(o.a).toBe(2);
    });

    it('mutates in place and returns the same object — after setState(obj) the new value must be visible', () => {
        const o = {a: 1};
        expect(setNestedValue(o, 'a', 2)).toBe(o);
    });
});

describe('uuid', () => {
    it('no duplicates in 500 runs — a duplicate question id overwrites another question\'s answer', () => {
        const s = new Set(Array.from({length: 500}, () => uuid()));
        expect(s.size).toBe(500);
    });

    it('matches the 8-4-4-4-12 format', () => {
        expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
});
