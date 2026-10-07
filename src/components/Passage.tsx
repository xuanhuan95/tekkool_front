import renderHTML from './SafeHtml';
import type {Question} from '../pages/exam-creation/Default';

/** List of passageIds in order of appearance within the section (deduplicated). */
const groupsInSection = (questions: Question[]): (string | undefined)[] => {
    const out: (string | undefined)[] = [];
    for (const q of questions || []) {
        const id = q.data && q.data.passageId;
        if (q.data && q.data.passage && !out.includes(id)) out.push(id);
    }
    return out;
};

/**
 * Reading passage shared by a whole group of questions ("Read text 1 and answer
 * questions 1 to 5").
 *
 * ponytail: every question in the group keeps ONE COPY of the passage
 * (data.passage) along with data.passageId. Printing as-is would repeat it 5
 * times. This component filters by passageId so it prints only at the FIRST
 * question of the group — the logic is the same in the exam-taking, preview,
 * print and authoring screens, so it lives in one place, fixed once.
 *
 * `prev` is the question right before in the same section (questions in the same
 * group are always adjacent). `questions` is the whole section, used only to
 * number the texts.
 */
export default function Passage(
    {question, prev, questions}: {question: Question; prev?: Question; questions?: Question[]},
) {
    const {passage, passageId} = question.data || {};
    if (!passage) return null;
    if (prev && prev.data && prev.data.passageId === passageId) return null;

    // Number by POSITION IN THE EXAM BEING VIEWED, not the original exam's number:
    // a block pulled from the bank that carries its old number would show "Part I"
    // as "Text 2", and two blocks pulled into the same exam would share a number.
    // A single text is not numbered — "Text 1" standing alone is surplus wording.
    const groups = groupsInSection(questions || []);
    const num = groups.length > 1 ? groups.indexOf(passageId) + 1 : 0;

    return <div className='passage'>
        {num > 0 && <p><b>VĂN BẢN {num}</b></p>}
        {renderHTML(passage)}
    </div>;
}
