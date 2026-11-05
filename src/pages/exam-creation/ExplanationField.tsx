import {useState} from 'react';
import {Editor} from '../../components/Editor';
import {textLength} from '../../components/textLength';
import type {Question} from './Default';

export const EXPLANATION_MAX = 5000;

/**
 * Per-question "Lời giải" (SPT-115, DS-Editor-LoiGiai): collapsed by default, one editor (teacher variant).
 * Stored in `data.explanation` of the unit's first question (Đúng/Sai: the whole block's solution sits on ý 1, BE rule).
 */
export default function ExplanationField({unit, onChange}: {unit: Question[]; onChange: (id: string, data: {explanation: string}) => void}) {
    const first = unit[0];
    const html: string = first.data.explanation || '';
    const [open, setOpen] = useState(!!html);
    const has = textLength(html) > 0 || /<img|data-latex/.test(html);
    return <div className='vt-explain-field'>
        <button type='button' className='vt-explain-toggle' aria-expanded={open} onClick={() => setOpen(o => !o)}>
            Lời giải <span className='vt-muted'>· {has ? 'Đã có lời giải' : 'Chưa có'}</span>
        </button>
        {open && <Editor key={first.id} variant='teacher' maxChars={EXPLANATION_MAX} text={html}
                         placeholder='Nhập lời giải (học sinh chỉ thấy sau khi nộp bài)…'
                         onChange={(v: string) => onChange(first.id, {explanation: v})}/>}
    </div>;
}
