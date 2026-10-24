import {uuid} from "../../tools";

export type Question = {
    id: string;
    type: string;
    exam: string;
    section: string;
    data: Record<string, any>;
};

export type Section = {
    id: string;
    exam: string;
    name: string;
    question_type: string;
    questions: Question[];
};

export type Exam = {
    id: string;
    name: string;
    section_label: string;
    duration: number;
    sections: Section[];
    /** Left/right corner headings of the printout. Not set on a newly created exam -> optional. */
    left_header?: string;
    right_header?: string;
    /** Owner. CreateExam sets it from the logged-in user before POST. */
    user?: string;
    /** SPT-66: new exams are drafts; absent on old exams = published. */
    status?: 'draft' | 'published';
};

export default class Default {
    // ponytail: original 2018 bug — BE apis/exam.py:39 reads data['section_label']
    // (required) but the FE has no such field anywhere -> every NEWLY CREATED exam
    // got a 500 KeyError on Save. The BE model uses a non-required StringField(), so
    // adding a default value here is enough, no need to touch tekkool_back.
    // ponytail: 45 minutes — the number DoExam used to hardcode, now an editable
    // default. 0 = no time limit.
    static DURATION = 45;

    static exam = (): Exam => ({
        id: 'E_' + uuid(),
        name: '',
        section_label: 'Phần',
        duration: Default.DURATION,
        sections: []
    });

    // ponytail: original 2018 bug — BE apis/exam.py:31 reads s['question_type'] (required)
    // but a section only has this field after the first question is added. Pressing Save (or
    // auto-save after 2 minutes) while the section is empty -> 500 KeyError. The BE model
    // uses a non-required StringField(), so a default value here is enough.
    static section = (examId: string): Section => ({
        id: 'S_' + uuid(),
        exam: examId,
        name: '',
        question_type: '',
        questions: []
    });

    static question = (type: string, examId: string, sectionId: string): Question => ({
        id: 'Q_' + uuid(),
        type: type,
        exam: examId,
        section: sectionId,
        data: {}
    });

    /** One Đúng/Sai question = 4 consecutive TrueFalse ý (a–d) sharing a new passageId. */
    static trueFalseGroup = (examId: string, sectionId: string): Question[] => {
        const passageId = 'P_' + uuid();
        return Array.from({length: 4}, () => ({
            ...Default.question('TrueFalse', examId, sectionId),
            data: {passage: '', passageId},
        }));
    };
}
