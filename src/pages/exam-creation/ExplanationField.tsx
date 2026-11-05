import {useState} from 'react';
import type {ReactNode} from 'react';
import {Editor} from '../../components/Editor';
import {textLength} from '../../components/textLength';
import type {Question} from './Default';
import {EXPLANATION_MAX} from './examRules';

const Svg = ({children}: {children: ReactNode}) =>
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'
         strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>{children}</svg>;

/**
 * Per-question "Lời giải" (SPT-115, DS-Editor-LoiGiai): collapsed by default, one editor (teacher variant).
 * Stored in `data.explanation` of the unit's first question (Đúng/Sai: the whole block's solution sits on ý 1, BE rule).
 */
export default function ExplanationField({unit, onChange}: {unit: Question[]; onChange: (id: string, data: {explanation: string}) => void}) {
    const first = unit[0];
    const html: string = first.data.explanation || '';
    const [open, setOpen] = useState(!!html);
    const has = textLength(html) > 0 || /<img|data-latex/.test(html);
    const tooLong = textLength(html) > EXPLANATION_MAX;
    return <div className='vt-explain-field'>
        <button type='button' className='vt-explain-toggle' aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <Svg><path d='M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z'/><path d='M4 19a2 2 0 0 1 2-2h13'/></Svg>
            <b>Lời giải</b>
            <span className={'vt-explain-badge' + (has ? ' has' : '')}>{has ? 'Đã có lời giải' : 'Chưa có'}</span>
            <Svg><path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}/></Svg>
        </button>
        {open && <div className={tooLong ? 'vt-explain-over' : undefined}>
            <Editor key={first.id} variant='teacher' maxChars={EXPLANATION_MAX} text={html}
                    placeholder='Viết lời giải từng bước. Học sinh chỉ thấy lời giải sau khi nộp bài.'
                    onChange={(v: string) => onChange(first.id, {explanation: v})}/>
            {tooLong && <div className='vt-explain-err'>
                <Svg><path d='M12 4l10 17H2L12 4z'/><path d='M12 10v5M12 18v.5'/></Svg>
                <span>Lời giải quá dài. Rút gọn bớt hoặc chuyển phần hình ảnh dài sang ảnh minh hoạ.</span>
            </div>}
        </div>}
    </div>;
}
