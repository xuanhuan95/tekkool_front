import {useState} from 'react';

import {Card, cx} from '../../components/ui';
import {blockLabel} from './blockTypes';
import {fill, needs, numbering} from './layoutRules';
import type {Layout} from './layoutRules';

/** Step 3: the frame as the student will see it. Numbers filled in; "Tô số tự tính" shows which ones the screen computed. */
export default function LayoutPreview({layout, name, minutes}: {layout: Layout; name: string; minutes: number}) {
    const [mark, setMark] = useState(false);
    const num = numbering(layout);
    const total = Object.values(needs(layout)).reduce((a, b) => a + b, 0);
    const text = (t: string, r: {from: number; to: number} | null) => {
        const out = fill(t, r);
        return mark && t !== out ? <mark className='vt-cfb-mark'>{out}</mark> : out;
    };
    return <Card className='vt-cfb-preview' as='section' aria-label='Xem trước đề'>
        <div className='vt-cfb-row'>
            <div><h2 className='vt-cfb-pname'>{name}</h2>
                <p className='vt-cfb-hint'>{minutes} phút · {total} khối · khoảng {num.total} câu</p></div>
            <label className='vt-imp-check'>
                <input type='checkbox' checked={mark} onChange={e => setMark(e.target.checked)}/> Tô số tự tính
            </label>
        </div>
        {layout.map((g, gi) => <div key={gi} className='vt-cfb-pgroup'>
            {g.title && <h3>{g.title}</h3>}
            {g.parts.map((p, pi) => {
                const pr = num.parts[gi][pi];
                return <div key={pi} className='vt-cfb-ppart'>
                    <h4>{p.title}{p.score ? ` (${p.score} điểm)` : ''}</h4>
                    {(p.description || p.lead) && <p>{p.description ? p.description : text(p.lead, pr)}</p>}
                    <ul>{p.items.map((it, ii) => <li key={ii} className={cx('vt-cfb-pitem')}>
                        {it.title && <b>{text(it.title, num.items[gi][pi][ii])} </b>}
                        {it.count} khối {blockLabel(it.block_type)} · rút ngẫu nhiên
                    </li>)}</ul>
                </div>;
            })}
        </div>)}
        <p className='vt-cfb-hint'>Khối thật được rút khi học sinh bấm làm bài; số câu chính xác tính lại sau khi rút.</p>
    </Card>;
}
