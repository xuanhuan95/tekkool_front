import {Fragment, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {Button, IconButton, Select, cx, icons} from '../../components/ui';
import {formatDecimal} from '../../lib/format';
import {BLOCK_LABELS, kindName, kindUnit, typeName} from './blockTypes';
import {EditText, Line} from './EditText';
import {
    addGroup, addItem, addPartAfter, canMove, edit, movePart, numbering, overflow, partCount, questionsOf, removeItem, removePart, roman, sameCount, setCount, needs, totalScore,
} from './layoutRules';
import type {Layout, LayoutItem, LayoutPart, Range} from './layoutRules';

const MAX_BLOCKS = 30;
const svg = (d: ReactNode, size = 18) => <svg viewBox='0 0 24 24' width={size} height={size} fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>{d}</svg>;
const ICONS: Record<string, ReactNode> = {
    reading: svg(<><path d='M3 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H3z'/><path d='M21 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z'/></>),
    paragraph: svg(<path d='M4 6h16M4 10h16M4 14h16M4 18h10'/>),
    essay: svg(<><path d='M6 3h9l4 4v14H6z'/><path d='M9 11h7M9 15h7M9 19h4'/></>),
};
const PLUS = svg(<path d='M12 5v14M5 12h14'/>);
const MINUS = svg(<path d='M5 12h14'/>);
const MORE = svg(<><circle cx='5' cy='12' r='1.2'/><circle cx='12' cy='12' r='1.2'/><circle cx='19' cy='12' r='1.2'/></>);

/** Blue number the screen computes itself. */
const Num = ({children}: {children: ReactNode}) => <span className='v3-n' title='Tự cập nhật theo số câu'>{children}</span>;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const range = (r: Range) => r.to < r.from ? '…' : r.from === r.to ? `câu ${r.from}` : `câu ${r.from}–${r.to}`;
const sizeOf = (type: string) => questionsOf({title: '', block_type: type, count: 1});

/** Box that opens over the sheet: Esc, ✕, "Xong" or a click outside close it; focus goes back to what opened it. */
function Pop({label, title, onClose, left, children}: {label: string; title: ReactNode; onClose: () => void; left?: boolean; children: ReactNode}) {
    const box = useRef<HTMLDivElement>(null);
    const [up, setUp] = useState(false);
    const close = useRef(onClose);
    close.current = onClose;
    // Under the thing that was clicked; above it only when the bottom of the window has no room.
    useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const anchor = el.parentElement?.getBoundingClientRect();
        if (anchor && r.bottom > window.innerHeight - 8 && anchor.top > r.height + 24) setUp(true);
    }, []);
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        box.current?.focus();
        if (!up) box.current?.scrollIntoView?.({block: 'nearest'});
        const off = (e: Event) => {
            if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.parentElement?.contains(e.target as Node)) close.current();
        };
        document.addEventListener('mousedown', off);
        document.addEventListener('keydown', off);
        return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off); opener?.focus?.(); };
    }, []);
    return <div ref={box} tabIndex={-1} className={cx('v3-pop', up && 'v3-pop--up', left && 'v3-pop--left')} role='dialog' aria-label={label}>
        <div className='v3-pop-head'><b>{title}</b>
            <IconButton label='Đóng' icon={<icons.IconClose size={18}/>} onClick={onClose}/></div>
        {children}
    </div>;
}

/** − 3 + : buttons act at once, a typed number when the field is left or Enter is pressed. */
function Stepper({value, unit, onChange}: {value: number; unit: string; onChange: (n: number) => void}) {
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);
    const commit = () => {
        const n = Math.min(MAX_BLOCKS, Math.max(1, parseInt(text, 10) || 1));
        setText(String(n));
        if (n !== value) onChange(n);
    };
    return <div className='vt-cfb-stepper'>
        <button type='button' aria-label={`Bớt 1 ${unit}`} disabled={value <= 1} onClick={() => onChange(value - 1)}>{MINUS}</button>
        <input aria-label={`Số ${unit}`} inputMode='numeric' value={text} onChange={e => setText(e.target.value.replace(/\D/g, ''))}
               onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}/>
        <button type='button' aria-label={`Thêm 1 ${unit}`} disabled={value >= MAX_BLOCKS} onClick={() => onChange(value + 1)}>{PLUS}</button>
    </div>;
}

/** "Phần I vẫn 3 điểm → mỗi câu 0,2 điểm (15 câu)": the points of a part are split evenly over its questions. */
function Split({part, questions, unit}: {part: LayoutPart; questions: number; unit: string}) {
    if (part.score == null || questions < 1) return null;
    return <p className='v3-muted'><b>{part.title} vẫn {formatDecimal(part.score)} điểm</b> → {questions === 1 ? 'câu này' : 'mỗi câu'} <b>{formatDecimal(part.score / questions)} điểm</b> ({questions} câu). Đổi số {unit} thì điểm mỗi câu tự đổi theo.</p>;
}

type Props = {
    name: string; minutes: number; onName: (v: string) => void; onMinutes: (n: number) => void;
    layout: Layout; onLayout: (l: Layout) => void;
    /** Blocks the bank has per type. */
    stock: Record<string, number>;
    bankId: string;
    /** The sample the sheet started from (null: blank sheet); "Như đề mẫu" in the part box compares with it. */
    base: Layout | null;
};

type Open = {kind: 'cell' | 'part'; g: number; p: number; i: number};

/**
 * The exam as the student will see it, edited in place (artboard APP-teacher-bank-v3-create-*):
 * text lines are typed over, a dashed frame stands for the questions drawn at random, and the frame / "(n điểm)" open a small box.
 */
export default function ExamSheet({name, minutes, onName, onMinutes, layout, onLayout, stock, bankId, base}: Props) {
    const titleId = useId();
    const num = numbering(layout);
    const over = overflow(layout, stock);
    const need = needs(layout);
    const [open, setOpen] = useState<Open | null>(null);
    const [fresh, setFresh] = useState<string | null>(null);   // ô just added: green "Mới"
    const [adding, setAdding] = useState<string | null>(null);   // Phần whose "gồm gì?" box is open
    const [note, setNote] = useState('');
    const blank = !base;
    const total = totalScore(layout);

    useEffect(() => {
        if (!fresh) return;
        const t = window.setTimeout(() => setFresh(null), 4000);
        return () => window.clearTimeout(t);
    }, [fresh]);

    const close = () => { setOpen(null); setFresh(null); setNote(''); };
    const toggle = (o: Open) => { setNote(''); setOpen(cur => cur && cur.kind === o.kind && cur.g === o.g && cur.p === o.p && cur.i === o.i ? null : o); };
    const stocked = Object.keys(BLOCK_LABELS).filter(t => (stock[t] || 0) > 0);
    let partNo = 0;

    /** "+" / "−" of the block box, and the sentence that says what changed on the sheet. */
    const count = (g: number, p: number, i: number, n: number) => {
        const before = layout[g].parts[p];
        const type = before.items[i].block_type;
        const have = sameCount(before, type);
        const next = setCount(layout, g, p, i, n);
        onLayout(next);
        const part = next[g].parts[p];
        const tag = `${roman(partCount(layout.slice(0, g)) + p + 1)}.`;
        const nr = numbering(next);
        const unit = kindUnit(type);
        const last = before.items.map(x => x.block_type).lastIndexOf(type);
        let said: string;
        if (n > have) {
            const at = before.items[i].title ? last + 1 : i;
            const r = nr.items[g][p][at], k = n - have;
            const rr = before.items[i].title ? {from: r.from, to: nr.items[g][p][at + k - 1].to} : {from: r.to - sizeOf(type) * k + 1, to: r.to};
            said = `Đã thêm ${before.items[i].title ? `${tag}${at + 1}${k > 1 ? `–${tag}${at + k}` : ''}` : `${k} ${unit}`} (${range(rr)}).`;
            if (before.items[i].title) setFresh(`${g}.${p}.${at}`);
        } else said = `Đã bớt ${have - n} ${unit}.`;
        if (/\{to\}/.test(part.lead)) said += ` Lời dẫn ${part.title} tự đổi thành “đến câu ${nr.parts[g][p].to}”.`;
        setNote(said);
    };

    const cell = (g: number, p: number, i: number, it: LayoutItem, r: Range) => {
        const key = `${g}.${p}.${i}`;
        const isOpen = open?.kind === 'cell' && open.g === g && open.p === p && open.i === i;
        const bad = over.find(o => o.g === g && o.p === p && o.i === i);
        const part = layout[g].parts[p];
        const type = it.block_type;
        const unit = kindUnit(type);
        const have = stock[type] || 0;
        const shrink = () => sameCount(part, type) > 1 ? count(g, p, i, sameCount(part, type) - 1) : onLayout(removeItem(layout, g, p, i));
        return <div className='v3-anchor' key={key}>
            <div className={cx('v3-ph', isOpen && 'is-active', !bad && fresh === key && 'is-new', bad && 'is-err')} role='button' tabIndex={0}
                 aria-label={`Sửa ${lower(kindName(type))}`} aria-expanded={isOpen}
                 onClick={() => toggle({kind: 'cell', g, p, i})}
                 onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle({kind: 'cell', g, p, i}); } }}>
                <span className='v3-ph-ic'>{ICONS[type] || ICONS.essay}</span>
                <span className='v3-ph-main'>
                    <b>{kindName(type)} · {questionsOf(it)} câu{!bad && fresh === key && <span className='v3-tag'>Mới</span>}</b>
                    <small>Rút ngẫu nhiên cho từng học sinh · ngân hàng có {have} {unit}</small>
                    {bad && <div className='v3-ph-err' role='alert' onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        {have === 0 ? <>Ngân hàng chưa có câu dạng “{typeName(type)}”, đề mẫu cần {need[type]} {unit}.</>
                            : <>Ngân hàng chỉ có {have} {lower(kindName(type))}, đề này cần {need[type]}.</>}
                        <span className='v3-acts'>
                            {have === 0
                                ? <><Button variant='secondary' size='sm' onClick={() => onLayout(removeItem(layout, g, p, i))}>Xoá {unit} này</Button>
                                    <Button variant='secondary' size='sm' onClick={() => toggle({kind: 'cell', g, p, i})}>Đổi dạng khác</Button></>
                                : <Button variant='secondary' size='sm' onClick={shrink}>Bớt 1 {unit}</Button>}
                            <Link className='vt-imp-link' to={`/import-exam?bank=${bankId}`}>Nhập thêm đề vào ngân hàng</Link>
                        </span>
                    </div>}
                </span>
                <span className='v3-ph-range'>Câu <Num>{r.from}</Num>{r.to > r.from && <>–<Num>{r.to}</Num></>}</span>
            </div>
            {isOpen && cellBox(g, p, i, part, it, unit, note)}
        </div>;
    };

    const cellBox = (g: number, p: number, i: number, part: LayoutPart, item: LayoutItem, unit: string, said: string) => {
        const type = item.block_type;
        const kinds = [...new Set([...stocked, type])];
        const pts = (numbering(layout).parts[g][p]);
        return <Pop label={`Sửa ${lower(kindName(type))}`} title={`${kindName(type)} · ${sizeOf(type)} câu`} onClose={close}>
            <div className='v3-pop-row'><span id={`${titleId}-n`}>Số {unit} ở {part.title}</span>
                <Stepper value={sameCount(part, type)} unit={lower(kindName(type))} onChange={n => count(g, p, i, n)}/></div>
            {said && <p className='v3-muted' role='status'>{said}</p>}
            <Split part={part} questions={pts.to - pts.from + 1} unit={unit}/>
            <Select label='Đổi thành' value={type} onChange={e => onLayout(edit.item(layout, g, p, i, x => ({...x, block_type: e.target.value})))}
                    options={kinds.map(t => ({value: t, label: `${kindName(t)}${sizeOf(t) > 1 ? ` (${sizeOf(t)} câu)` : ''} · có ${stock[t] || 0}`}))}/>
            <div className='v3-pop-foot'>
                <Button variant='ghost' size='sm' className='v3-danger' onClick={() => { onLayout(removeItem(layout, g, p, i)); close(); }}>Xoá {unit} này</Button>
                <span className='v3-grow'/>
                <Button variant='primary' size='sm' onClick={close}>Xong</Button>
            </div>
        </Pop>;
    };

    const partBox = (g: number, p: number, part: LayoutPart) => {
        const group = layout[g];
        const r = num.parts[g][p];
        const q = r.to - r.from + 1;
        const first = g === 0 && p === 0;
        const before = layout.slice(0, g).reduce((n, x) => n + x.parts.reduce((m, y) => m + y.items.reduce((s, it) => s + questionsOf(it), 0), 0), 0)
            + group.parts.slice(0, p).reduce((m, y) => m + y.items.reduce((s, it) => s + questionsOf(it), 0), 0);
        const prev = p > 0 ? group.parts[p - 1].title : g > 0 ? layout[g - 1].parts[layout[g - 1].parts.length - 1].title : '';
        const asBase = part.numbering === 'restart' && base?.[g]?.parts[p]?.numbering === 'restart';
        const only = layout.length === 1 && group.parts.length === 1;
        return <Pop label={`Sửa ${part.title}`} title={part.title} onClose={close} left>
            <div className='v3-pop-row'><label htmlFor={`${titleId}-score`}><b>Điểm cả phần</b></label>
                <span className='v3-score-wrap'>
                    <ScoreInput id={`${titleId}-score`} value={part.score} onDone={close} onChange={v => onLayout(edit.part(layout, g, p, x => ({...x, score: v})))}/>điểm</span></div>
            <p className='v3-muted'>{part.score == null ? 'Chưa nhập điểm.' : q < 1 ? 'Phần chưa có câu nào.'
                : `Phần có ${q} câu → ${q === 1 ? 'câu này' : 'mỗi câu'} ${formatDecimal(part.score / q)} điểm.`} Điểm chia đều cho các câu trong phần.</p>
            {!first && <label className='vt-bk-check v3-check'>
                <input type='checkbox' checked={part.numbering === 'restart'}
                       onChange={e => onLayout(edit.part(layout, g, p, x => ({...x, numbering: e.target.checked ? 'restart' : 'continue'})))}/>
                <span>Đánh số câu lại từ Câu 1<small>{asBase ? 'Như đề mẫu. ' : ''}Bỏ chọn thì nối tiếp {prev} (thành Câu {before + 1}).</small></span>
            </label>}
            <div className='v3-menu'>
                <button type='button' onClick={() => { onLayout(addPartAfter(layout, g, p)); close(); }}>Thêm phần ở dưới</button>
                {canMove(layout, g, p, -1) && <button type='button' onClick={() => { onLayout(movePart(layout, g, p, -1)); close(); }}>Chuyển lên trên</button>}
                {canMove(layout, g, p, 1) && <button type='button' onClick={() => { onLayout(movePart(layout, g, p, 1)); close(); }}>Chuyển xuống dưới</button>}
                {!only && <button type='button' className='v3-danger' onClick={() => { onLayout(removePart(layout, g, p)); close(); }}>Xoá {part.title}</button>}
            </div>
            <div className='v3-pop-foot'><span className='v3-grow'/><Button variant='primary' size='sm' onClick={close}>Xong</Button></div>
        </Pop>;
    };

    const choose = (g: number, p: number, part: LayoutPart) => <div className='v3-choose'>
        <b>{part.title} gồm gì? Bấm để thêm:</b>
        <div className='v3-choose-btns'>
            {stocked.map(t => <Button key={t} variant='secondary' icon={PLUS}
                                      onClick={() => { onLayout(addItem(layout, g, p, t)); setAdding(null); setFresh(`${g}.${p}.${part.items.length}`); }}>
                {kindName(t)}{sizeOf(t) > 1 ? ` (${sizeOf(t)} câu)` : ''}<small>có {stock[t]}</small></Button>)}
        </div>
        {stocked.length === 0 && <p className='v3-muted'>Ngân hàng chưa có đoạn hay câu nào. <Link className='vt-imp-link' to={`/import-exam?bank=${bankId}`}>Nhập thêm đề vào ngân hàng</Link></p>}
        <p className='v3-muted'>Mỗi học sinh rút ngẫu nhiên từ ngân hàng. Thêm nhiều lần để có nhiều đoạn/câu.</p>
    </div>;

    const bare = layout.every(g => g.parts.every(p => !p.items.length));   // blank sheet: nothing to total yet (as drawn)
    return <article className='v3-paper' aria-label='Tờ đề — bấm vào chữ hoặc khung để sửa'>
        <Line cls='v3-title'>
            <span className='v3-name'><EditText required label='Tên đề' value={name} placeholder='Tên đề' onCommit={onName}/></span>
            <small>Thời gian làm bài: <EditText numeric label='Thời gian làm bài (phút)' value={String(minutes)} onCommit={v => onMinutes(Number(v) || 0)}/> phút</small>
            {!bare && <small className='v3-total'>Tổng {formatDecimal(total.sum)} điểm</small>}
        </Line>
        {total.warn && !bare && <p className='v3-total v3-total--warn' role='status'>{total.warn}</p>}

        {layout.map((g, gi) => <Fragment key={gi}>
            {(g.title || blank) && <Line cls='v3-grp'>
                <EditText label='Tiêu đề nhóm' value={g.title} placeholder='Tiêu đề nhóm, ví dụ “A. TÔ TRÊN PHIẾU TRẢ LỜI TRẮC NGHIỆM” (không bắt buộc)'
                          onCommit={v => onLayout(edit.group(layout, gi, x => ({...x, title: v})))}/>
            </Line>}
            {g.parts.map((p, pi) => {
                const no = roman(++partNo);
                const key = `${gi}.${pi}`;
                const isOpen = open?.kind === 'part' && open.g === gi && open.p === pi;
                const pr = num.parts[gi][pi];
                const at = {kind: 'part' as const, g: gi, p: pi, i: 0};
                return <Fragment key={pi}>
                    <div className='v3-anchor'>
                        <Line cls='v3-prt' help>
                            <b><EditText required label={`Tên phần ${no}`} value={p.title} onCommit={v => onLayout(edit.part(layout, gi, pi, x => ({...x, title: v})))}/></b>{' '}
                            <button type='button' className={cx('v3-score', isOpen && 'is-open')} aria-expanded={isOpen}
                                    aria-label={`Điểm ${p.title}: ${p.score == null ? 'chưa có' : formatDecimal(p.score) + ' điểm'}, bấm để sửa`}
                                    onClick={() => toggle(at)}>{p.score == null ? '(… điểm)' : `(${formatDecimal(p.score)} điểm)`}</button><b>.</b>{' '}
                            <EditText label={`Lời dẫn ${p.title}`} value={p.lead} range={pr} placeholder='Lời dẫn (không bắt buộc)'
                                      onCommit={v => onLayout(edit.part(layout, gi, pi, x => ({...x, lead: v})))}/>
                            <button type='button' className={cx('v3-more', 'vt-tip', isOpen && 'is-open')} aria-label={`Thao tác với ${p.title}`} data-tip={`Thao tác với ${p.title}`}
                                    aria-expanded={isOpen} onClick={() => toggle(at)}>{MORE}</button>
                        </Line>
                        {isOpen && partBox(gi, pi, p)}
                    </div>
                    {p.description && <p className='v3-desc'>{p.description}</p>}
                    {p.items.map((it, ii) => <Fragment key={ii}>
                        {it.title && <Line cls='v3-sub' help>
                            <EditText label={`Tiêu đề ${no}.${ii + 1}`} value={it.title} range={num.items[gi][pi][ii]} n={ii + 1} flash={fresh === `${gi}.${pi}.${ii}`}
                                      onCommit={v => onLayout(edit.item(layout, gi, pi, ii, x => ({...x, title: v})))}/>
                        </Line>}
                        {cell(gi, pi, ii, it, num.items[gi][pi][ii])}
                    </Fragment>)}
                    {p.items.length === 0 || adding === key ? choose(gi, pi, p)
                        : <div className='v3-addslot'><button type='button' className='v3-add v3-add--quiet' onClick={() => setAdding(key)}>{PLUS}Thêm đoạn hoặc câu</button></div>}
                </Fragment>;
            })}
        </Fragment>)}
        <div className={cx('v3-addslot', 'v3-addslot--end', blank && 'is-shown')}>
            <Button variant='ghost' size='sm' icon={PLUS} onClick={() => onLayout(addPartAfter(layout, layout.length - 1, layout[layout.length - 1].parts.length - 1))}>Thêm phần</Button>
            <Button variant='ghost' size='sm' icon={PLUS} onClick={() => onLayout(addGroup(layout))}>Thêm nhóm (A., B.)</Button>
        </div>
    </article>;
}

/** Points of a Phần typed with a comma or a dot; empty = no points yet. */
function ScoreInput({id, value, onChange, onDone}: {id: string; value?: number | null; onChange: (v: number | null) => void; onDone: () => void}) {
    const [text, setText] = useState(value == null ? '' : formatDecimal(value));
    return <input id={id} className='vt-input v3-score-in' inputMode='decimal' value={text} aria-label='Điểm cả phần'
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onDone(); } }}
                  onChange={e => {
                      const t = e.target.value.replace(/[^\d.,]/g, '');
                      setText(t);
                      const v = parseFloat(t.replace(',', '.'));
                      onChange(t === '' ? null : Number.isFinite(v) ? Math.min(100, v) : null);
                  }}/>;
}
