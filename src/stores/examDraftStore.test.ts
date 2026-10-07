import {beforeEach, describe, expect, it} from 'vitest';

import {useExamDraftStore} from './examDraftStore';
import Default from '../pages/exam-creation/Default';

const reset = () => useExamDraftStore.setState({exam: null, version: 0});
const s = () => useExamDraftStore.getState();

beforeEach(reset);

describe('examDraftStore', () => {
    it('setExam resets version to 0 — opening another exam does not carry the old exam\'s version', () => {
        s().setExam(Default.exam());
        s().patchExam({name: 'x'});
        expect(s().version).toBe(1);

        s().setExam(Default.exam());
        expect(s().version).toBe(0);
    });

    it('patchExam mutates in place and bumps version — this is what forces components to re-render', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().patchExam({name: 'Đề thử', duration: 90});

        // Same object: Section/Preview hold this reference.
        expect(s().exam).toBe(exam);
        expect(exam.name).toBe('Đề thử');
        expect(exam.duration).toBe(90);
        expect(s().version).toBe(1);
    });

    it('addSection uses Default.section so it has question_type — without this field BE returns 500', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().addSection();

        expect(exam.sections).toHaveLength(1);
        expect(exam.sections[0]).toHaveProperty('question_type', '');
        expect(exam.sections[0].exam).toBe(exam.id);
    });

    it('removeSection deletes only the specified section', () => {
        const exam = Default.exam();
        s().setExam(exam);
        s().addSection();
        s().addSection();
        const [first, second] = exam.sections;

        s().removeSection(first.id);
        expect(exam.sections).toHaveLength(1);
        expect(exam.sections[0].id).toBe(second.id);
    });

    it('setSectionState writes all three fields, and only into the right section', () => {
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
        // The other section must not be touched.
        expect(b.name).toBe('');
        expect(b.questions).toHaveLength(0);
    });

    it('touch only bumps version, does not change exam — used when a question mutates its data in place', () => {
        const exam = Default.exam();
        s().setExam(exam);
        const before = s().version;

        s().touch();
        expect(s().exam).toBe(exam);
        expect(s().version).toBe(before + 1);
    });

    it('with no exam, every write is silently ignored, does not blow up', () => {
        expect(() => {
            s().patchExam({name: 'x'});
            s().addSection();
            s().removeSection('S_khong_co');
            s().setSectionState('S_khong_co', {name: 'x'});
        }).not.toThrow();
        expect(s().version).toBe(0);
    });
});
