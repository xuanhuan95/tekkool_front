import {create} from 'zustand';
import {setNestedValue} from '../tools';
import Default from '../pages/exam-creation/Default';
import type {Exam, Question, Section} from '../pages/exam-creation/Default';

/**
 * Bản nháp đề đang soạn ở CreateExam.
 *
 * ponytail: để trong store thay vì state của CreateExam vì `Section` và hai
 * modal Preview nằm sâu trong cây (CreateExam -> Section -> Question) và đều
 * cần đọc/ghi cùng một `exam`. Prop-drill qua 3 tầng rồi lại phải truyền
 * ngược callback lên — store ngắn hơn và đúng với cái bản cũ đang làm.
 *
 * `exam` vẫn bị SỬA TẠI CHỖ (setNestedValue) giống bản cũ; để báo cho React
 * biết có thay đổi, mỗi lần ghi ta tăng `version`. Đổi sang immutable ở đây
 * phải viết lại cả 5 file question component (chúng cũng gọi setNestedValue
 * trên `question.data`) — không nằm trong lát này.
 */
type ExamDraftState = {
    exam: Exam | null;
    /** Tăng mỗi lần `exam` bị sửa tại chỗ. Component đọc để biết phải vẽ lại. */
    version: number;

    setExam: (exam: Exam) => void;
    /** Gộp vài field vào thẳng `exam` (name, left_header, duration...). */
    patchExam: (data: Partial<Exam>) => void;
    addSection: () => void;
    removeSection: (sectionId: string) => void;
    /** Ghi name / questions / question_type cho một section. */
    setSectionState: (sectionId: string, patch: SectionPatch) => void;
    /** Buộc vẽ lại sau khi question component tự sửa `question.data`. */
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
