import {describe, it, expect} from 'vitest';
import {setNestedValue, uuid} from './tools';

// Mọi lời gọi thật trong app đều là dạng `a[id=X].b` (Section.jsx,
// BaseQuestion, MultipleChoice, ErrorIdentify) — đó là đường phải chắc nhất.
describe('setNestedValue', () => {
    it('sửa đúng phần tử theo id, không đụng phần tử khác', () => {
        const exam = {sections: [{id: 'S1', name: 'cũ'}, {id: 'S2', name: 'giữ'}]};
        setNestedValue(exam, 'sections[id=S1].name', 'mới');
        expect(exam.sections[0].name).toBe('mới');
        expect(exam.sections[1].name).toBe('giữ');
    });

    it('so id bằng chuỗi — id số 1 phải khớp với "1"', () => {
        const o = {items: [{id: 1, v: 'a'}]};
        setNestedValue(o, 'items[id=1].v', 'b');
        expect(o.items[0].v).toBe('b');
    });

    it('id không tồn tại thì không được làm hỏng mảng', () => {
        const o = {items: [{id: 'A', v: 1}]};
        expect(() => setNestedValue(o, 'items[id=ZZZ].v', 9)).toThrow();
        expect(o.items[0].v).toBe(1);
    });

    it('lồng hai tầng: question trong section', () => {
        const section = {questions: [{id: 'Q1', data: {}}]};
        setNestedValue(section, 'questions[id=Q1].data', {x: 1});
        expect(section.questions[0].data).toEqual({x: 1});
    });

    it('chỉ số nguyên', () => {
        const o = {a: {b: [1, 2]}};
        setNestedValue(o, 'a.b[0]', 9);
        expect(o.a.b).toEqual([9, 2]);
    });

    it('key phẳng', () => {
        const o: Record<string, unknown> = {a: 1};
        setNestedValue(o, 'a', 2);
        expect(o.a).toBe(2);
    });

    it('sửa tại chỗ và trả về chính object đó — gọi xong setState(obj) phải thấy giá trị mới', () => {
        const o = {a: 1};
        expect(setNestedValue(o, 'a', 2)).toBe(o);
    });
});

describe('uuid', () => {
    it('không trùng trong 500 lần — id câu hỏi trùng là ghi đè đáp án câu khác', () => {
        const s = new Set(Array.from({length: 500}, () => uuid()));
        expect(s.size).toBe(500);
    });

    it('đúng dạng 8-4-4-4-12', () => {
        expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
});
