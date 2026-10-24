import {Radio} from 'semantic-ui-react';

import {Editor} from '../../components/Editor';
import type {Question} from './Default';
import {TRUE_FALSE_STATEMENTS, tickOf} from './examRules';

type Props = {
    /** The ý of ONE Đúng/Sai question, in order. */
    unit: Question[];
    onPassage: (html: string) => void;
    onPatch: (id: string, data: Record<string, unknown>) => void;
    /** Append ý d) etc. when the block has fewer than 4. */
    onAddStatement: () => void;
};

/**
 * One Đúng/Sai question: a shared lead-in plus the ý a–d, each with its own Đúng/Sai.
 * ponytail: ý can only be removed with the whole block (the ✕ in Section) — a block that is not
 * exactly 4 ý cannot be saved. An old 1-ý question still renders here and says what is wrong.
 */
export default function TrueFalseBlock({unit, onPassage, onPatch, onAddStatement}: Props) {
    const wrong = unit.length !== TRUE_FALSE_STATEMENTS;

    return <div className='question true-false-block'>
        <div className='passage passage-edit'>
            <div className='passage-label'>Đề dẫn chung cho các ý a–d</div>
            <Editor text={unit[0].data.passage || ''} onChange={onPassage}
                    placeholder='Nhập đề dẫn chung của câu Đúng/Sai...'/>
        </div>

        {wrong && <div className='ui negative message' role='alert'>
            Câu Đúng/Sai này có {unit.length} ý, cần đúng {TRUE_FALSE_STATEMENTS} ý a–d.
            {unit.length < TRUE_FALSE_STATEMENTS ? ' Bấm "+ Thêm ý" để bổ sung.' : ' Xoá câu (nút ✕) và tạo lại.'}
        </div>}

        {unit.map((q, i) => {
            const tick = tickOf(q);
            const name = 'tf-' + q.id;
            const set = (value: boolean) => onPatch(q.id, {correctAnswer: value, answer: value});
            return <div key={q.id} className='tf-statement' style={{marginTop: 12}}>
                <strong>{String.fromCharCode(97 + i)})</strong>
                <Editor text={q.data.question || ''} placeholder='Nhập nội dung ý...'
                        onChange={(question: string) => onPatch(q.id, {question})}/>
                <Radio label='Đúng' name={name} checked={tick === true} onChange={() => set(true)}/>
                <Radio label='Sai' name={name} checked={tick === false} onChange={() => set(false)}
                       className='margin-left'/>
            </div>;
        })}

        {unit.length < TRUE_FALSE_STATEMENTS &&
        <button type='button' className='vt-add-statement' onClick={onAddStatement}>
            + Thêm ý {String.fromCharCode(97 + unit.length)})
        </button>}
    </div>;
}
