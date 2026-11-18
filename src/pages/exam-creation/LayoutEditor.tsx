import {useEffect, useId, useRef, useState} from 'react';
import type {MouseEvent, ReactNode} from 'react';

import {Button, IconButton, Select, TextField, cx, icons} from '../../components/ui';
import {BLOCK_LABELS, blockLabel} from './blockTypes';
import {edit, fill, insertNumbers, isToken, newGroup, newItem, newPart, numbering, pieces, shift, shortages} from './layoutRules';
import type {Layout, Range} from './layoutRules';

/**
 * A line of text with number tokens, drawn as ONE box (artboard `vt-bk-lead`): typed pieces are borderless fields that grow
 * with their text and wrap, `{from}`/`{to}` are chips showing the number the screen computes (dashed border = not typed by hand).
 * Editing a piece never touches the chips.
 */
export function Inline({value, onChange, range, label, placeholder}:
    {value: string; onChange: (v: string) => void; range: Range; label: string; placeholder?: string}) {
    const parts = pieces(value);
    const box = useRef<HTMLDivElement>(null);
    // A piece right after a number chip must not start with a letter/digit: it would stick to the number ("câu 10Mỗi").
    const gap = (i: number, t: string) => i > 0 && isToken(parts[i - 1]) && /^[\p{L}\p{N}]/u.test(t) ? ' ' + t : t;
    const set = (k: number, text: string) => onChange(parts.map((p, i) => i === k ? gap(i, text.replace(/\s*\n\s*/g, ' ')) : p).join(''));
    // A click on the empty end of the box lands the cursor in the last piece, like a real text field.
    const focusEnd = (e: MouseEvent) => {
        if (e.target !== box.current) return;
        e.preventDefault();
        const fields = box.current.querySelectorAll('textarea');
        fields[fields.length - 1]?.focus();
    };
    return <div ref={box} className='vt-cfb-inline' role='group' aria-label={label} onMouseDown={focusEnd}>
        {parts.map((p, k) => isToken(p)
            ? <span key={k} className='vt-cfb-num' title='Số câu tự tính lại sau khi rút'>{fill(p, range)}</span>
            : <span key={k} className='vt-cfb-seg-text'>
                <span aria-hidden='true'>{p || (parts.length === 1 ? placeholder : '') || ' '}{/\s$/.test(p) ? '' : ' '}</span>
                <textarea rows={1} value={p} aria-label={parts.length > 1 ? `${label} (đoạn ${k / 2 + 1})` : label}
                          placeholder={parts.length === 1 ? placeholder : undefined} maxLength={500}
                          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                          onChange={e => set(k, e.target.value)}/>
            </span>)}
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

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
export const roman = (n: number) => ROMAN[n] || String(n);

/** Two-way switch (artboard `vt-bk-seg`): the pressed one is ink on paper. */
function Segmented({label, value, options, onChange}: {label: string; value: string; options: {value: string; label: string}[]; onChange: (v: string) => void}) {
    const id = useId();
    return <div className='vt-field'>
        <span className='vt-field-label' id={id}>{label}</span>
        <div className='vt-cfb-seg' role='group' aria-labelledby={id}>
            {options.map(o => <button key={o.value} type='button' aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
        </div>
    </div>;
}

/** − 1 + (artboard `vt-bk-stepper`): typing is allowed, the buttons never go below 1. */
function Stepper({label, value, onChange}: {label: string; value: number; onChange: (n: number) => void}) {
    const id = useId();
    return <div className='vt-field'>
        <span className='vt-field-label' id={id}>{label}</span>
        <div className='vt-cfb-stepper' role='group' aria-labelledby={id}>
            <button type='button' aria-label='Bớt 1 khối' disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
            <input aria-label={label} inputMode='numeric' value={value} onChange={e => onChange(Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0)))}/>
            <button type='button' aria-label='Thêm 1 khối' onClick={() => onChange(value + 1)}>+</button>
        </div>
    </div>;
}

const Level = ({tag, children}: {tag: string; children: ReactNode}) => <div className='vt-cfb-lvl'><span className='vt-cfb-lvl-tag'>{tag}</span>{children}</div>;

/** Step 2: Nhóm → Phần → Tiểu mục, nested as in the artboard. Question numbers are computed here, never typed. */
export default function LayoutEditor({layout, onChange, stock, bankId}: Props) {
    const num = numbering(layout);
    const short = shortages(layout, stock);
    const empty = layout.every(g => !g.title && g.parts.every(p => !p.title && !p.lead && p.items.every(i => !i.title)));
    // Only the block types the bank has (plus whatever the row already holds); an empty bank still lists everything.
    const stocked = Object.keys(BLOCK_LABELS).filter(t => (stock[t] || 0) > 0);
    let partNo = 0;

    return <div className='vt-cfb-tree'>
        {layout.map((g, gi) => <section key={gi} className='vt-cfb-group' aria-label={`Nhóm ${gi + 1}`}>
            <Level tag='Nhóm'>
                <input className='vt-input' aria-label='Tiêu đề nhóm' maxLength={200} value={g.title}
                       placeholder='Ví dụ: A. PHẦN TRẮC NGHIỆM (bỏ trống nếu đề không chia nhóm)'
                       onChange={e => onChange(edit.group(layout, gi, x => ({...x, title: e.target.value})))}/>
                <RowMenu what={`nhóm ${gi + 1}`} up={gi > 0 ? () => onChange(shift(layout, gi, -1)) : undefined}
                         down={gi < layout.length - 1 ? () => onChange(shift(layout, gi, 1)) : undefined}
                         remove={layout.length > 1 ? () => onChange(layout.filter((_x, i) => i !== gi)) : undefined}/>
            </Level>

            {g.parts.map((p, pi) => {
                const prange = num.parts[gi][pi];
                const no = roman(++partNo);
                const move = (by: number) => onChange(edit.group(layout, gi, x => ({...x, parts: shift(x.parts, pi, by)})));
                return <div key={pi} className='vt-cfb-part' role='group' aria-label={`Phần ${pi + 1} của nhóm ${gi + 1}`}>
                    <Level tag='Phần'>
                        <input className='vt-input' aria-label='Tên phần' maxLength={200} placeholder='Ví dụ: PHẦN I. Đọc hiểu' value={p.title}
                               onChange={e => onChange(edit.part(layout, gi, pi, x => ({...x, title: e.target.value})))}/>
                        <RowMenu what={`phần ${pi + 1}`} up={pi > 0 ? () => move(-1) : undefined}
                                 down={pi < g.parts.length - 1 ? () => move(1) : undefined}
                                 remove={g.parts.length > 1 ? () => onChange(edit.group(layout, gi, x => ({...x, parts: x.parts.filter((_y, i) => i !== pi)}))) : undefined}/>
                    </Level>
                    <div className='vt-cfb-part-meta'>
                        <TextField label='Điểm' type='number' inputMode='decimal' min={0} max={100} step='0.25' value={p.score ?? ''}
                                   onChange={e => onChange(edit.part(layout, gi, pi, x => ({...x, score: e.target.value === '' ? null : Number(e.target.value)})))}/>
                        {p.description
                            ? <p className='vt-cfb-hint'>Phần này dùng mô tả của đề mẫu: {p.description}</p>
                            : <div className='vt-field'>
                                <span className='vt-field-label'>Lời dẫn</span>
                                <Inline value={p.lead} range={prange} label='Lời dẫn' placeholder='Ví dụ: Thí sinh trả lời từ câu … đến câu …'
                                        onChange={v => onChange(edit.part(layout, gi, pi, x => ({...x, lead: v})))}/>
                                {!/\{(from|to)\}/.test(p.lead) && /(từ\s+(câu\s+)?(…|\.{2,}|\d+)\s+đến)/i.test(p.lead) &&
                                    <Button variant='ghost' size='sm' onClick={() => onChange(edit.part(layout, gi, pi, x => ({...x, lead: insertNumbers(x.lead)})))}>Chèn số câu</Button>}
                            </div>}
                    </div>

                    <Segmented label='Đánh số câu' value={p.numbering} onChange={v => onChange(edit.part(layout, gi, pi, x => ({...x, numbering: v === 'restart' ? 'restart' : 'continue'})))}
                               options={[{value: 'continue', label: 'Tiếp tục số câu'}, {value: 'restart', label: 'Đánh lại từ câu 1'}]}/>

                    <div className='vt-cfb-subs'>
                        {p.items.map((it, ii) => {
                            const r = num.items[gi][pi][ii];
                            const lack = it.block_type && (stock[it.block_type] || 0) < it.count;
                            const need = short.find(s => s.type === it.block_type);
                            const tag = `Tiểu mục ${no}.${ii + 1}`;
                            const types = stocked.length ? [...new Set([...stocked, ...(it.block_type ? [it.block_type] : [])])] : Object.keys(BLOCK_LABELS);
                            return <div key={ii} className={cx('vt-cfb-subitem', lack && 'lack')}>
                                <Level tag={tag}>
                                    <span className='vt-cfb-grow'/>
                                    <IconButton variant='ghost' tipEnd label={`Xoá tiểu mục ${no}.${ii + 1}`} disabled={p.items.length < 2} icon={<icons.IconClose size={18}/>}
                                                onClick={() => onChange(edit.part(layout, gi, pi, x => ({...x, items: x.items.filter((_y, j) => j !== ii)})))}/>
                                </Level>
                                <div className='vt-field'>
                                    <span className='vt-field-label'>Tiêu đề tiểu mục <span className='vt-cfb-muted'>(không bắt buộc)</span></span>
                                    <Inline value={it.title} range={r} label={`Tiêu đề tiểu mục ${no}.${ii + 1}`} placeholder='Ví dụ: Chọn một đáp án (bỏ trống nếu không cần)'
                                            onChange={v => onChange(edit.item(layout, gi, pi, ii, x => ({...x, title: v})))}/>
                                </div>
                                <div className='vt-cfb-blk'>
                                    <Select label='Dạng khối' value={it.block_type}
                                            onChange={e => onChange(edit.item(layout, gi, pi, ii, x => ({...x, block_type: e.target.value})))}
                                            options={[{value: '', label: 'Chọn dạng khối'}, ...types.map(t => ({value: t, label: `${blockLabel(t)} · kho ${stock[t] || 0}`}))]}/>
                                    <Stepper label='Số khối' value={it.count} onChange={n => onChange(edit.item(layout, gi, pi, ii, x => ({...x, count: n})))}/>
                                    <span className='vt-cfb-range'>→ {r ? <b>{r.from === r.to ? `câu ${r.from}` : `câu ${r.from}–${r.to}`}</b> : 'chưa có câu'}</span>
                                </div>
                                {lack && need && <p className='vt-cfb-err' role='alert'>
                                    Ngân hàng chỉ có {need.have} khối {blockLabel(it.block_type)}, khung đang cần {need.need}. Bớt khối hoặc{' '}
                                    <a href={`/import-exam?bank=${bankId}`}>nhập thêm đề</a>.</p>}
                            </div>;
                        })}
                    </div>
                    <button type='button' className='vt-cfb-add' onClick={() => onChange(edit.part(layout, gi, pi, x => ({...x, items: [...x.items, newItem()]})))}>+ Thêm tiểu mục</button>
                </div>;
            })}
            <button type='button' className='vt-cfb-add' onClick={() => onChange(edit.group(layout, gi, x => ({...x, parts: [...x.parts, newPart()]})))}>+ Thêm phần</button>
        </section>)}
        <button type='button' className='vt-cfb-add' onClick={() => onChange([...layout, newGroup()])}>+ Thêm nhóm</button>
        {empty && <p className='vt-cfb-hint'>Khung còn trống. Chọn dạng khối và số khối cho từng tiểu mục; số câu sẽ tự tính. Trong lời dẫn có thể gõ "từ câu … đến câu …" rồi bấm "Chèn số câu".</p>}
    </div>;
}
