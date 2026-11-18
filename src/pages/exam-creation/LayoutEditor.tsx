import {useEffect, useRef, useState} from 'react';

import {Button, Card, IconButton, Select, TextField, cx} from '../../components/ui';
import {BLOCK_LABELS, blockLabel} from './blockTypes';
import {edit, fill, insertNumbers, isToken, newGroup, newItem, newPart, numbering, pieces, shift, shortages} from './layoutRules';
import type {Layout, Range} from './layoutRules';

/**
 * A line of text with number tokens: typed pieces are inputs, `{from}`/`{to}` are chips showing the number the screen
 * computes (dashed border = not typed by hand). Editing a piece never touches the chips.
 */
export function Inline({value, onChange, range, label, placeholder}:
    {value: string; onChange: (v: string) => void; range: Range; label: string; placeholder?: string}) {
    const parts = pieces(value);
    const set = (k: number, text: string) => onChange(parts.map((p, i) => i === k ? text : p).join(''));
    return <div className='vt-cfb-inline' role='group' aria-label={label}>
        {parts.map((p, k) => isToken(p)
            ? <span key={k} className='vt-cfb-num' title='Số câu tự tính theo khung'>{fill(p, range)}</span>
            : <input key={k} className='vt-input' value={p} aria-label={parts.length > 1 ? `${label} (đoạn ${k / 2 + 1})` : label}
                     placeholder={parts.length === 1 ? placeholder : undefined} maxLength={500}
                     size={Math.max(2, p.length)} onChange={e => set(k, e.target.value)}/>)}
    </div>;
}

/** ⋯ menu of a row: move up / down / delete (artboard). Closes on Esc and on a click outside. */
function RowMenu({what, up, down, remove}: {what: string; up?: () => void; down?: () => void; remove?: () => void}) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!open) return;
        const off = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', off); document.addEventListener('keydown', off);
        return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off); };
    }, [open]);
    const item = (label: string, fn?: () => void, danger?: boolean) => <button type='button' role='menuitem' disabled={!fn}
        className={cx(danger && 'vt-cfb-menu-danger')} onClick={() => { setOpen(false); fn?.(); }}>{label}</button>;
    return <span className='vt-cfb-moves' ref={box}>
        <IconButton variant='outline' tipEnd label={`Thao tác với ${what}`} aria-expanded={open} aria-haspopup='menu'
                    icon={<span aria-hidden='true'>⋯</span>} onClick={() => setOpen(o => !o)}/>
        {open && <div className='vt-cfb-menu' role='menu'>
            {item('Đưa lên', up)}{item('Đưa xuống', down)}{item('Xoá', remove, true)}
        </div>}
    </span>;
}

type Props = {layout: Layout; onChange: (l: Layout) => void; stock: Record<string, number>; bankId: string};

/** Step 2: Nhóm → Phần → Tiểu mục. Question numbers are computed here, never typed. */
export default function LayoutEditor({layout, onChange, stock, bankId}: Props) {
    const num = numbering(layout);
    const short = shortages(layout, stock);
    const types = Object.keys(BLOCK_LABELS);
    const empty = layout.every(g => !g.title && g.parts.every(p => !p.title && !p.lead && p.items.every(i => !i.title)));

    return <div className='vt-cfb-frame'>
        {layout.map((g, gi) => <Card key={gi} className='vt-cfb-group'>
            <div className='vt-cfb-row'>
                <TextField label={`Nhóm ${gi + 1}`} placeholder='Ví dụ: A. PHẦN TRẮC NGHIỆM (bỏ trống nếu đề không chia nhóm)' value={g.title}
                           onChange={e => onChange(edit.group(layout, gi, x => ({...x, title: e.target.value})))}/>
                <RowMenu what={`nhóm ${gi + 1}`} up={gi > 0 ? () => onChange(shift(layout, gi, -1)) : undefined}
                         down={gi < layout.length - 1 ? () => onChange(shift(layout, gi, 1)) : undefined}
                         remove={layout.length > 1 ? () => onChange(layout.filter((_x, i) => i !== gi)) : undefined}/>
            </div>

            {g.parts.map((p, pi) => {
                const prange = num.parts[gi][pi];
                const move = (by: number) => onChange(edit.group(layout, gi, x => ({...x, parts: shift(x.parts, pi, by)})));
                return <section key={pi} className='vt-cfb-part' aria-label={`Phần ${pi + 1} của nhóm ${gi + 1}`}>
                    <div className='vt-cfb-row'>
                        <TextField label='Tên phần' placeholder='Ví dụ: PHẦN I. Đọc hiểu' value={p.title}
                                   onChange={e => onChange(edit.part(layout, gi, pi, x => ({...x, title: e.target.value})))}/>
                        <TextField label='Điểm' type='number' inputMode='decimal' min={0} max={100} step='0.25' className='vt-cfb-score' value={p.score ?? ''}
                                   onChange={e => onChange(edit.part(layout, gi, pi, x => ({...x, score: e.target.value === '' ? null : Number(e.target.value)})))}/>
                        <RowMenu what={`phần ${pi + 1}`} up={pi > 0 ? () => move(-1) : undefined}
                                 down={pi < g.parts.length - 1 ? () => move(1) : undefined}
                                 remove={g.parts.length > 1 ? () => onChange(edit.group(layout, gi, x => ({...x, parts: x.parts.filter((_y, i) => i !== pi)}))) : undefined}/>
                    </div>

                    {p.description
                        ? <p className='vt-cfb-hint'>Phần này dùng mô tả của đề mẫu: {p.description}</p>
                        : <div className='vt-cfb-lead'>
                            <span className='vt-field-label'>Lời dẫn</span>
                            <Inline value={p.lead} range={prange} label='Lời dẫn' placeholder='Ví dụ: Thí sinh trả lời từ câu … đến câu …'
                                    onChange={v => onChange(edit.part(layout, gi, pi, x => ({...x, lead: v})))}/>
                            {!/\{(from|to)\}/.test(p.lead) && /(từ\s+(câu\s+)?(…|\.{2,}|\d+)\s+đến)/i.test(p.lead) &&
                                <Button variant='ghost' size='sm' onClick={() => onChange(edit.part(layout, gi, pi, x => ({...x, lead: insertNumbers(x.lead)})))}>Chèn số câu</Button>}
                        </div>}

                    <Select label='Đánh số câu' value={p.numbering} className='vt-cfb-numbering'
                            onChange={e => onChange(edit.part(layout, gi, pi, x => ({...x, numbering: e.target.value === 'restart' ? 'restart' : 'continue'})))}
                            options={[{value: 'continue', label: 'Tiếp tục số câu'}, {value: 'restart', label: 'Đánh lại từ câu 1'}]}/>

                    <ol className='vt-cfb-items'>
                        {p.items.map((it, ii) => {
                            const r = num.items[gi][pi][ii];
                            const lack = it.block_type && (stock[it.block_type] || 0) < it.count;
                            const need = short.find(s => s.type === it.block_type);
                            return <li key={ii} className={cx('vt-cfb-item', lack && 'lack')}>
                                <div className='vt-cfb-row'>
                                    <Select label='Dạng khối' value={it.block_type}
                                            onChange={e => onChange(edit.item(layout, gi, pi, ii, x => ({...x, block_type: e.target.value})))}
                                            options={[{value: '', label: 'Chọn dạng khối'}, ...types.map(t => ({value: t, label: `${blockLabel(t)} · kho ${stock[t] || 0}`}))]}/>
                                    <TextField label='Số khối' type='number' inputMode='numeric' min={1} className='vt-cfb-count' value={it.count}
                                               onChange={e => onChange(edit.item(layout, gi, pi, ii, x => ({...x, count: Math.max(0, Math.floor(Number(e.target.value) || 0))})))}/>
                                    <span className='vt-cfb-range'>{r ? `→ câu ${r.from}–${r.to}` : '→ chưa có câu'}</span>
                                    <RowMenu what={`tiểu mục ${ii + 1}`}
                                             up={ii > 0 ? () => onChange(edit.part(layout, gi, pi, x => ({...x, items: shift(x.items, ii, -1)}))) : undefined}
                                             down={ii < p.items.length - 1 ? () => onChange(edit.part(layout, gi, pi, x => ({...x, items: shift(x.items, ii, 1)}))) : undefined}
                                             remove={p.items.length > 1 ? () => onChange(edit.part(layout, gi, pi, x => ({...x, items: x.items.filter((_y, j) => j !== ii)}))) : undefined}/>
                                </div>
                                <div className='vt-cfb-lead'>
                                    <span className='vt-field-label'>Tiêu đề tiểu mục (không bắt buộc)</span>
                                    <Inline value={it.title} range={r} label={`Tiêu đề tiểu mục ${ii + 1}`} placeholder='Ví dụ: Chọn một đáp án (bỏ trống nếu không cần)'
                                            onChange={v => onChange(edit.item(layout, gi, pi, ii, x => ({...x, title: v})))}/>
                                </div>
                                {lack && need && <p className='vt-cfb-err' role='alert'>
                                    Ngân hàng chỉ có {need.have} khối {blockLabel(it.block_type)}, khung đang cần {need.need}. Bớt khối hoặc{' '}
                                    <a href={`/import-exam?bank=${bankId}`}>nhập thêm đề</a>.</p>}
                            </li>;
                        })}
                    </ol>
                    <Button variant='ghost' size='sm' onClick={() => onChange(edit.part(layout, gi, pi, x => ({...x, items: [...x.items, newItem()]})))}>Thêm tiểu mục</Button>
                </section>;
            })}
            <Button variant='ghost' size='sm' onClick={() => onChange(edit.group(layout, gi, x => ({...x, parts: [...x.parts, newPart()]})))}>Thêm phần</Button>
        </Card>)}
        <Button variant='secondary' onClick={() => onChange([...layout, newGroup()])}>Thêm nhóm</Button>
        {empty && <p className='vt-cfb-hint'>Khung còn trống. Chọn dạng khối và số khối cho từng tiểu mục; số câu sẽ tự tính. Trong lời dẫn có thể gõ "từ câu … đến câu …" rồi bấm "Chèn số câu".</p>}
    </div>;
}
