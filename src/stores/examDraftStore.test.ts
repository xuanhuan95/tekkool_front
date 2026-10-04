import {beforeEach, describe, expect, it} from 'vitest';

import {useExamDraftStore} from './examDraftStore';
import Default from '../pages/exam-creation/Default';

const reset = () => useExamDraftStore.setState({exam: null, version: 0});
const s = () => useExamDraftStore.getState();

beforeEach(reset);

describe('examDraftStore', () => {
    it('setExam đặt lại version về 0 — mở đề khác không mang version đề cũ', () => {
        s().setExam(Default.exam());
        s().patchExam({name: 'x'});
        expect(s().version).toBe(1);

        s().setExam(Default.exam());
        expect(s().version).toBe(0);
    });

    it('patchExam sửa tại chỗ và tăng version — đây là thứ ép component vẽ lại', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().patchExam({name: 'Đề thử', duration: 90});

        // Cùng một object: Section/Preview giữ tham chiếu này.
        expect(s().exam).toBe(exam);
        expect(exam.name).toBe('Đề thử');
        expect(exam.duration).toBe(90);
        expect(s().version).toBe(1);
    });

    it('addSection dùng Default.section nên có question_type — thiếu field này BE trả 500', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().addSection();

        expect(exam.sections).toHaveLength(1);
        expect(exam.sections[0]).toHaveProperty('question_type', '');
        expect(exam.sections[0].exam).toBe(exam.id);
    });

    it('removeSection chỉ xoá đúng section được chỉ định', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().addSection();
        s().addSection();
        const [first, second] = exam.sections;

        s().removeSection(first.id);
        expect(exam.sections).toHaveLength(1);
        expect(exam.sections[0].id).toBe(second.id);
    });

    it('setSectionState ghi được cả ba field, và chỉ vào đúng section', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().addSection();
        s().addSection();
        const [a, b] = exam.sections;

        const q = Default.question('MultipleChoice', exam.id, a.id);
        s().setSectionState(a.id, {name: 'Phần I', questions: [q], question_type: 'MultipleChoice'});

        expect(a.name).toBe('Phần I');
        expect(a.questions).toEqual([q]);
        expect(a.question_type).toBe('MultipleChoice');
        // Section kia không được đụng tới.
        expect(b.name).toBe('');
        expect(b.questions).toHaveLength(0);
    });

    it('touch chỉ tăng version, không đổi exam — dùng khi câu hỏi tự sửa data tại chỗ', () => {
        const exam = Default.exam();
        s().setExam(exam);
        const before = s().version;

        s().touch();
        expect(s().exam).toBe(exam);
        expect(s().version).toBe(before + 1);
    });

    it('chưa có exam thì mọi lệnh ghi im lặng bỏ qua, không nổ', () => {
        expect(() => {
            s().patchExam({name: 'x'});
            s().addSection();
            s().removeSection('S_khong_co');
            s().setSectionState('S_khong_co', {name: 'x'});
        }).not.toThrow();
        expect(s().version).toBe(0);
    });
});
