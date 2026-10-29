import {useEffect, useState} from 'react';
import type {MouseEvent, ReactNode} from 'react';

import {Button, IconButton, Modal} from '../../components/ui';
import {answerImageUrl} from '../exam/answerImageUrl';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {
    CLUSTER_GAP, MARK_NAME, MAX_MARKS_PER_IMAGE, MAX_NOTE_LENGTH, clusterMarks, displayToImage, imageToDisplay, nextRotation, tempId,
} from './imageMarks';
import type {Mark, MarkType, Rotation} from './imageMarks';
import './image-marker.css';

const ZOOMS = [1, 1.5, 2, 3];
const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n * 100) / 100));

type Tool = 'select' | MarkType;
type Editing = {mark: Mark; isNew: boolean};
type Loaded = {key: string; status: 'ok' | 'error'; ratio: number};

const Ico = ({children, size = 22}: {children: ReactNode; size?: number}) =>
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4'
         strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>{children}</svg>;
const TICK = <path d='M5 12.5l4.5 4.5L19 7'/>;
const CROSS = <path d='M6 6l12 12M18 6L6 18'/>;
const glyph = (t: MarkType) => t === 'check' ? TICK : t === 'cross' ? CROSS : <path d='M5 6h14M12 6v13M9 19h6'/>;

/** Name of one mark for screen readers: "Dấu đúng 2", "Ghi chữ 3: Sai dấu ở dòng 3". */
const markLabel = (m: Mark, n: number) => MARK_NAME[m.type] + ' ' + n + (m.type === 'text' && m.text ? ': ' + m.text : '');

/** The ✓ / ✗ button on the photo; notes are drawn as a chip (plain text — never HTML). */
function MarkDot({mark, n, shown, onPick}: {mark: Mark; n: number; shown: {x: number; y: number}; onPick: (m: Mark) => void}) {
    return <button type='button' className={'mk-dot mk-dot--' + mark.type} aria-label={markLabel(mark, n)}
                   style={{left: shown.x + '%', top: shown.y + '%'}}
                   onClick={e => { e.stopPropagation(); onPick(mark); }}>
        {mark.type === 'text' ? <span className='mk-chip'>{mark.text}</span> : <Ico size={18}>{glyph(mark.type)}</Ico>}
    </button>;
}

/** Marks as a list: beside the score box, and in the "N dấu ở vị trí này" sheet. */
function MarkList({marks, all, onPick, onDelete}: {marks: Mark[]; all: Mark[]; onPick: (m: Mark) => void; onDelete?: (m: Mark) => void}) {
    return <ul className='mk-list'>
        {marks.map(m => {
            const n = all.indexOf(m) + 1;
            return <li key={m.id} className='mk-row'>
                <button type='button' className='mk-row-main' onClick={() => onPick(m)} aria-label={markLabel(m, n) + (onDelete ? ' — sửa' : '')}>
                    <span className={'mk-glyph mk-glyph--' + m.type}><Ico size={16}>{glyph(m.type)}</Ico></span>
                    <span className='mk-row-name'>{MARK_NAME[m.type]}{m.type === 'text' && <> · “{m.text}”</>}</span>
                </button>
                {onDelete && <IconButton label={`Xoá ${MARK_NAME[m.type].toLowerCase()} ${n}`} tipEnd
                                         icon={<Ico size={18}><path d='M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13'/></Ico>} onClick={() => onDelete(m)}/>}
            </li>;
        })}
    </ul>;
}

function MarkDialog({edit, onSave, onDelete, onClose}: {edit: Editing; onSave: (m: Mark) => void; onDelete: () => void; onClose: () => void}) {
    const {mark, isNew} = edit;
    const [text, setText] = useState(mark.text || '');
    const isText = mark.type === 'text';
    const empty = !text.trim();
    return <Modal open onClose={onClose} title={isText ? (isNew ? 'Ghi chữ' : 'Sửa ghi chú') : MARK_NAME[mark.type]}
                  footer={<>
                      {!isNew && <Button variant='danger' onClick={onDelete}>Xoá dấu</Button>}
                      {!isText && <Button variant='secondary' onClick={() => onSave({...mark, type: mark.type === 'check' ? 'cross' : 'check'})}>
                          Đổi thành {mark.type === 'check' ? 'dấu sai ✗' : 'dấu đúng ✓'}</Button>}
                      <Button variant='secondary' onClick={onClose}>{isText ? 'Huỷ' : 'Đóng'}</Button>
                      {isText && <Button variant='primary' disabled={empty} onClick={() => onSave({...mark, text: text.trim()})}>Xong</Button>}
                  </>}>
        {isText
            ? <label className='mk-note-field'>
                <span>Ghi chú cho học sinh (chữ thường)</span>
                <textarea rows={3} value={text} maxLength={MAX_NOTE_LENGTH} autoFocus onChange={e => setText(e.target.value)}
                          placeholder='Ví dụ: Sai dấu ở dòng 3'/>
                <span className='mk-note-count vt-num'>{text.length}/{MAX_NOTE_LENGTH}</span>
            </label>
            : <p>Bạn muốn đổi hay xoá dấu này?</p>}
    </Modal>;
}

export interface ImageMarkerProps {
    /** Ids of the answer photos (`answer_image/view/<id>`). */
    ids: string[];
    /** Current marks keyed by image id (the grader's unsaved edits win over the server's list). */
    marks: Record<string, Mark[]>;
    /** Teacher: called with the NEW full list of one image. Omit for read-only (student). */
    onChange?: (imageId: string, list: Mark[]) => void;
    /** Score + comment form: next to the photo on a computer, in a pull-up sheet on a phone. */
    side?: ReactNode;
    /** One line on the phone bottom bar, e.g. "Câu 23 · 1,25 / 1,5". */
    summary?: ReactNode;
    startIndex?: number;
    /** Already inside a dialog: no full-screen button. */
    noFullscreen?: boolean;
}

/**
 * Photo viewer with marks (SPT-84, CA-* artboards). Zoom, rotate (view only), prev/next, full screen.
 * Teacher (`onChange`): tools ✓ / ✗ / note — tap the photo while a tool is held to place, tap a mark to edit or delete.
 * Student: same viewer with no tools. A mark is stored as % of the ORIGINAL photo, so rotating only changes where it is drawn.
 */
export default function ImageMarker({ids, marks, onChange, side, summary, startIndex = 0, noFullscreen}: ImageMarkerProps) {
    const compact = !useMediaQuery(DESKTOP);
    const [idx, setIdx] = useState(Math.min(Math.max(startIndex, 0), Math.max(ids.length - 1, 0)));
    const [tool, setTool] = useState<Tool>('select');
    const [zi, setZi] = useState(0);
    const [rots, setRots] = useState<Record<string, Rotation>>({});
    const [tries, setTries] = useState<Record<string, number>>({});
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [group, setGroup] = useState<Mark[] | null>(null);
    const [note, setNote] = useState<Mark | null>(null);
    const [sheet, setSheet] = useState(false);
    const [full, setFull] = useState(false);
    const [limitMsg, setLimitMsg] = useState<string | null>(null);

    const id = ids[idx];
    const edit = !!onChange;
    const list = marks[id] || [];
    const rot = rots[id] || 0;
    const key = id + ':' + (tries[id] || 0);
    const st = loaded && loaded.key === key ? loaded : null;
    const status = st ? st.status : 'loading';
    const ratio = st ? st.ratio : 4 / 3;
    const odd = rot === 90 || rot === 270;
    const shownRatio = odd ? 1 / ratio : ratio;

    useEffect(() => {
        if (!full) return;
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [full]);

    const go = (to: number) => { setIdx(to); setNote(null); setLimitMsg(null); };
    const setList = (next: Mark[]) => { setLimitMsg(null); onChange?.(id, next); };
    const save = (m: Mark) => {
        setList(list.some(x => x.id === m.id) ? list.map(x => x.id === m.id ? m : x) : [...list, m]);
        setEditing(null);
    };
    const remove = (m: Mark) => { setList(list.filter(x => x.id !== m.id)); setEditing(null); setGroup(g => g && g.filter(x => x.id !== m.id)); };

    const place = (e: MouseEvent<HTMLDivElement>) => {
        if (!edit || tool === 'select' || status !== 'ok') return;
        if (list.length >= MAX_MARKS_PER_IMAGE) return setLimitMsg(`Mỗi ảnh tối đa ${MAX_MARKS_PER_IMAGE} dấu.`);
        const r = e.currentTarget.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const p = displayToImage(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, rot);
        const m: Mark = {id: tempId(), type: tool, x: clamp(p.x), y: clamp(p.y), ...(tool === 'text' ? {text: ''} : {})};
        if (tool === 'text') setEditing({mark: m, isNew: true}); else setList([...list, m]);
    };

    const pick = (m: Mark) => {
        setGroup(null); setSheet(false);
        if (edit) setEditing({mark: m, isNew: false}); else if (m.type === 'text') setNote(m);
    };

    const shown = list.map(m => ({m, ...imageToDisplay(m.x, m.y, rot)}));
    const groups = compact ? clusterMarks(shown, CLUSTER_GAP) : shown.map(s => [s]);
    const locked = status !== 'ok';

    const toolBtn = (t: Tool, label: string, icon: ReactNode) =>
        <IconButton key={t} label={label} variant='outline' aria-pressed={tool === t} disabled={locked}
                    className={tool === t ? 'mk-tool mk-tool--on' : 'mk-tool'} icon={icon}
                    onClick={() => setTool(tool === t ? 'select' : t)}/>;

    const toolbar = <div role='toolbar' aria-label='Công cụ chấm trên ảnh' className='mk-toolbar'>
        {edit && <>
            {toolBtn('check', 'Đặt dấu đúng (✓)', <Ico>{TICK}</Ico>)}
            {toolBtn('cross', 'Đặt dấu sai (✗)', <Ico>{CROSS}</Ico>)}
            {toolBtn('text', 'Ghi chữ ngắn', <Ico>{glyph('text')}</Ico>)}
            {toolBtn('select', 'Chọn dấu (không đặt thêm)', <Ico><path d='M6 3l12 8-5 1.5L11 18z'/></Ico>)}
            <span className='mk-sep' aria-hidden='true'/>
        </>}
        <IconButton label='Thu nhỏ' variant='outline' disabled={locked || zi === 0} icon={<Ico><circle cx='11' cy='11' r='6'/><path d='M8 11h6M20 20l-4.5-4.5'/></Ico>} onClick={() => setZi(zi - 1)}/>
        <IconButton label='Phóng to' variant='outline' disabled={locked || zi === ZOOMS.length - 1} icon={<Ico><circle cx='11' cy='11' r='6'/><path d='M8 11h6M11 8v6M20 20l-4.5-4.5'/></Ico>} onClick={() => setZi(zi + 1)}/>
        <IconButton label='Xoay ảnh' variant='outline' disabled={locked} icon={<Ico><path d='M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5'/></Ico>}
                    onClick={() => setRots({...rots, [id]: nextRotation(rot)})}/>
    </div>;

    const panel = <>
        {side}
        {edit && <section aria-label='Dấu trên ảnh'>
            <h4 className='mk-list-title'>Dấu trên ảnh {idx + 1} · <span className='vt-num'>{list.length}</span></h4>
            {list.length
                ? <MarkList marks={list} all={list} onPick={pick} onDelete={remove}/>
                : <p className='mk-empty'>Chưa có dấu nào. Chọn ✓, ✗ hoặc ghi chữ rồi bấm vào ảnh.</p>}
        </section>}
    </>;

    const hint = !edit ? null
        : tool === 'select' ? 'Chọn công cụ ✓, ✗ hoặc ghi chữ rồi bấm vào ảnh để đặt. Bấm dấu đã đặt để sửa hoặc xoá.'
        : `Đang chọn ${tool === 'check' ? 'dấu đúng' : tool === 'cross' ? 'dấu sai' : 'ghi chữ'} — bấm vào ảnh để đặt. Bấm dấu đã đặt để sửa hoặc xoá.`;

    if (!id) return null;

    return <div className={'mk' + (full ? ' mk--full' : '') + (side && !compact ? ' mk--split' : '')}>
        <div className='mk-main'>
            <div className='mk-head'>
                {!noFullscreen && <span className='mk-title'>Ảnh bài làm</span>}
                <div className='mk-nav'>
                    {ids.length > 1 && <IconButton label='Ảnh trước' variant='outline' disabled={idx === 0} icon={<Ico><path d='M15 6l-6 6 6 6'/></Ico>} onClick={() => go(idx - 1)}/>}
                    <span className='mk-count vt-num' aria-live='polite'>Ảnh {idx + 1} / {ids.length}</span>
                    {ids.length > 1 && <IconButton label='Ảnh sau' variant='outline' disabled={idx === ids.length - 1} icon={<Ico><path d='M9 6l6 6-6 6'/></Ico>} onClick={() => go(idx + 1)}/>}
                    {!noFullscreen && <IconButton label={full ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'} variant='outline' tipEnd aria-pressed={full}
                                                  icon={<Ico>{full ? <path d='M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'/> : <path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'/>}</Ico>}
                                                  onClick={() => setFull(!full)}/>}
                </div>
            </div>
            {!compact && toolbar}
            <div className='mk-view'>
                <div className='mk-stage' data-tool={tool} onClick={place}
                     style={{'--mk-r': shownRatio, '--mk-z': ZOOMS[zi], '--mk-h': full ? '82vh' : '66vh'} as React.CSSProperties}>
                    <div className='mk-rot' style={{width: odd ? 100 / shownRatio + '%' : '100%', height: odd ? 100 * shownRatio + '%' : '100%',
                                                     transform: `translate(-50%, -50%) rotate(${rot}deg)`}}>
                        <img key={key} src={answerImageUrl(id) + (tries[id] ? '&retry=' + tries[id] : '')} alt={`Ảnh bài làm ${idx + 1}`} draggable={false}
                             className={status === 'ok' ? '' : 'mk-img--wait'}
                             onLoad={e => setLoaded({key, status: 'ok', ratio: e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 4 / 3})}
                             onError={() => setLoaded({key, status: 'error', ratio: 4 / 3})}/>
                    </div>
                    {status === 'loading' && <div className='mk-ph mk-ph--load' role='status' aria-label='Đang tải ảnh'/>}
                    {status === 'error' && <div className='mk-ph mk-ph--err' role='alert'>
                        <b>Không tải được ảnh</b>
                        <span>Kiểm tra mạng rồi thử lại.{edit && ' Điểm và nhận xét vẫn chấm được.'}</span>
                        <Button variant='secondary' size='sm' onClick={e => { e.stopPropagation(); setTries({...tries, [id]: (tries[id] || 0) + 1}); }}>Thử lại</Button>
                    </div>}
                    {status === 'ok' && groups.map(g => g.length === 1
                        ? <MarkDot key={g[0].m.id} mark={g[0].m} n={list.indexOf(g[0].m) + 1} shown={g[0]} onPick={pick}/>
                        : <button key={g.map(s => s.m.id).join()} type='button' className='mk-cluster' aria-label={`${g.length} dấu ở vị trí này`}
                                  style={{left: g[0].x + '%', top: g[0].y + '%'}}
                                  onClick={e => { e.stopPropagation(); setGroup(g.map(s => s.m)); }}>{g.length}</button>)}
                </div>
            </div>
            {compact && toolbar}
            {hint && <p className='mk-hint' role='status'>{limitMsg || hint}</p>}
            {note && <p className='mk-notebar' role='status'><b>Giáo viên:</b> “{note.text}”</p>}
            {ids.length > 1 && <ul className='mk-thumbs' aria-label='Chọn ảnh'>
                {ids.map((t, i) => <li key={t}>
                    <button type='button' className={'mk-thumb' + (i === idx ? ' mk-thumb--on' : '')} aria-label={`Ảnh ${i + 1}`} aria-current={i === idx} onClick={() => go(i)}>
                        <img src={answerImageUrl(t)} alt='' loading='lazy'/>
                        {(marks[t] || []).length > 0 && <span className='mk-thumb-n vt-num'>{marks[t].length}</span>}
                    </button>
                </li>)}
            </ul>}
        </div>

        {side !== undefined || edit
            ? compact
                ? <>
                    <button type='button' className='mk-bar' onClick={() => setSheet(true)}>
                        <span>{summary}</span><b>Điểm &amp; nhận xét ▲</b>
                    </button>
                    <Modal open={sheet} onClose={() => setSheet(false)} placement='sheet' showClose title='Chấm câu này'
                           footer={<Button variant='primary' onClick={() => setSheet(false)}>Xong</Button>}>
                        {panel}
                    </Modal>
                </>
                : <aside className='mk-side'>{panel}</aside>
            : null}

        {editing && <MarkDialog key={editing.mark.id} edit={editing} onSave={save} onDelete={() => remove(editing.mark)} onClose={() => setEditing(null)}/>}
        <Modal open={!!group?.length} onClose={() => setGroup(null)} placement='sheet' showClose title={`${group?.length || 0} dấu ở vị trí này`}>
            {group && <MarkList marks={group} all={list} onPick={pick} onDelete={edit ? remove : undefined}/>}
        </Modal>
    </div>;
}
