import type {Question} from './Default';
import {defaultScore, unitScore} from './examRules';

type Props = {
    unit: Question[];
    subject?: string | null;
    /** `score` undefined = back to default (clears max_score). */
    onChange: (unit: Question[], score: number | undefined) => void;
};

/** Per-question score: prefilled with the SPT default, editable; shows "đã chỉnh" + reset when it differs. */
export default function ScoreField({unit, subject, onChange}: Props) {
    const type = unit[0].type;
    const score = unitScore(unit, subject);
    const fallback = defaultScore(type, subject);
    const edited = unit.some(q => q.data.max_score !== undefined) && score !== fallback;
    const missing = type === 'FreeAnswer' && !(Number(score) > 0);

    return <div className='vt-score-field'>
        <label>
            Điểm câu{type === 'TrueFalse' ? ' (cả 4 ý)' : ''}:{' '}
            <input type='number' min={0} step={0.05} aria-label='Điểm câu'
                   value={score ?? ''} placeholder={type === 'FreeAnswer' ? 'bắt buộc' : ''}
                   onChange={e => onChange(unit, e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}/>
        </label>
        {edited && <>
            <span className='vt-score-edited'>đã chỉnh</span>
            <button type='button' className='vt-score-reset' onClick={() => onChange(unit, undefined)}>↺ mặc định</button>
        </>}
        {missing && <span className='vt-score-missing'>Chưa nhập điểm — chặn xuất bản</span>}
    </div>;
}
