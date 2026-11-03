import {useMemo, useReducer, useState} from 'react';
import type {ReactNode} from 'react';

import {Editor} from '../../components/Editor';
import {Button, Modal} from '../../components/ui';
import {uuid} from '../../tools';
import {questionTypes} from './Section';
import TrueFalseBlock from './TrueFalseBlock';
import {isClusterQuestion} from './importRules';
import type {ImportQuestion, QuestionUnit} from './importRules';

type Props = {
    unit: QuestionUnit;
    no: number;
    /** Above the editor: the type picker and its "tách A–D" button (they change the exam at once, then this dialog is rebuilt). */
    header?: ReactNode;
    onSave: (questions: ImportQuestion[]) => void;
    onClose: () => void;
};

/**
 * "Sửa câu": the editor's own question components (MultipleChoice, FillBlank, TrueFalseBlock …) on a COPY of the question.
 * They mutate `question.data` in place and say "re-render" through `setSectionState`; nothing reaches the exam until Lưu.
 */
export default function ImportQuestionModal({unit, no, header, onSave, onClose}: Props) {
    const [draft] = useState<ImportQuestion[]>(() => JSON.parse(JSON.stringify(unit.questions)));
    const [, bump] = useReducer((n: number) => n + 1, 0);
    // The editor components only read `section.questions` (by id) and write back into it.
    const section = useMemo(() => ({id: '', exam: '', name: '', question_type: '', questions: draft}), [draft]);
    const first = draft[0];
    const QuestionView = questionTypes[first.type];
    const passageId = first.data.passageId;

    const setPassage = (html: string) => { draft.forEach(q => { q.data.passage = html; }); bump(); };
    const patch = (id: string, data: Record<string, unknown>) => { Object.assign(draft.find(q => q.id === id)!.data, data); bump(); };

    return <Modal open onClose={onClose} title={'Sửa câu ' + no} size='md' className='vt-imp-edit' showClose
                  footer={<>
                      <Button variant='secondary' onClick={onClose}>Huỷ</Button>
                      <Button variant='primary' onClick={() => onSave(draft)}>Lưu câu</Button>
                  </>}>
        {header}
        {first.type === 'TrueFalse'
            ? <TrueFalseBlock unit={draft as never} onPatch={patch} onPassage={setPassage}
                              onAddStatement={() => { draft.push({id: uuid(), type: 'TrueFalse', data: {passage: first.data.passage || '', passageId}}); bump(); }}/>
            : <>
                {first.data.passage !== undefined && <div className='vt-imp-passage'>
                    <div className='vt-imp-passage-label'>Ngữ liệu dùng chung — sửa ở đây áp dụng cho cả nhóm câu</div>
                    <Editor text={first.data.passage} onChange={setPassage}/>
                </div>}
                {first.type !== 'TrueFalse' && !isClusterQuestion(first) && <span className='vt-imp-edit-label'>Câu hỏi</span>}
                {!QuestionView
                    ? <div role='alert' className='ui warning message'>Chưa hỗ trợ sửa loại câu hỏi “{first.type}”. Câu này được giữ nguyên khi lưu.</div>
                    // câu chùm: every ý is its own FillBlank, the dẫn liệu is above
                    : (isClusterQuestion(first) ? draft : [first]).map(q =>
                        <QuestionView key={q.id} question={q} section={section} setSectionState={bump}/>)}
            </>}
    </Modal>;
}
