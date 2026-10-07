import {create} from 'zustand';
import {setNestedValue} from '../tools';
import Default from '../pages/exam-creation/Default';
import type {Exam, Question, Section} from '../pages/exam-creation/Default';

/**
 * Draft of the exam being authored in CreateExam.
 *
 * ponytail: kept in a store instead of CreateExam's state because `Section` and
 * the two Preview modals sit deep in the tree (CreateExam -> Section -> Question)
 * and all need to read/write the same `exam`. Prop-drilling through 3 levels and
 * then passing callbacks back up — the store is shorter and matches what the old
 * version did.
 *
 * `exam` is still MUTATED IN PLACE (setNestedValue) like the old version; to tell
 * React something changed, we bump `version` on every write. Going immutable here
 * would mean rewriting all 5 question component files (they also call
 * setNestedValue on `question.data`) — not part of this slice.
 */
type ExamDraftState = {
    exam: Exam | null;
    /** Bumped each time `exam` is mutated in place. Components read it to know to re-render. */
    version: number;

    setExam: (exam: Exam) => void;
    /** Merge a few fields straight into `exam` (name, left_header, duration...). */
    patchExam: (data: Partial<Exam>) => void;
    addSection: () => void;
    removeSection: (sectionId: string) => void;
    /** Write name / questions / question_type for a section. */
    setSectionState: (sectionId: string, patch: SectionPatch) => void;
    /** Force a re-render after a question component mutates `question.data` itself. */
    touch: () => void;
};

export type SectionPatch = Partial<Pick<Section, 'name' | 'questions' | 'question_type'>>;

export const useExamDraftStore = create<ExamDraftState>((set, get) => ({
    exam: null,
    version: 0,

    setExam: (exam) => set({exam, version: 0}),

    patchExam: (data) => {
        const {exam} = get();
        if (!exam) return;
        Object.assign(exam, data);
        set(s => ({version: s.version + 1}));
    },

    addSection: () => {
        const {exam} = get();
        if (!exam) return;
        exam.sections = [...exam.sections, Default.section(exam.id)];
        set(s => ({version: s.version + 1}));
    },

    removeSection: (sectionId) => {
        const {exam} = get();
        if (!exam) return;
        exam.sections = exam.sections.filter(s => s.id !== sectionId);
        set(s => ({version: s.version + 1}));
    },

    setSectionState: (sectionId, patch) => {
        const {exam} = get();
        if (!exam) return;
        (Object.keys(patch) as Array<keyof SectionPatch>).forEach(key => {
            setNestedValue(exam, `sections[id=${sectionId}].${key}`, patch[key]);
        });
        set(s => ({version: s.version + 1}));
    },

    touch: () => set(s => ({version: s.version + 1})),
}));

export type {Exam, Question, Section};
