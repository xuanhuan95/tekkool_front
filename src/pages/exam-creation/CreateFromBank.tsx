import {useRef, useState} from 'react';
import type {CSSProperties, DragEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';

import {Button, Card, CardTitle, ErrorState, PageTitle, SkeletonCard, TextField, buttonClass, cx,
    notify} from '../../components/ui';
import {errorText} from '../../lib/format';
import {useBankCapacity, useBanks, useCreateFromBank} from '../../queries/questionBank';
import {useFolders} from '../../queries/exams';
import type {StructureSlot} from '../../types/exam';
import {BLOCK_LABELS, blockStyle, blockLabel} from './blockTypes';
import {IconButton, icons} from '../../components/ui';
import './create-from-bank.css';

/** Structure slot with a stable key: reordering must not mix up the inputs between cards. */
type Slot = StructureSlot & {key: number};
/** What is being dragged: a block type from the side palette, or an existing card (at position `from`). */
type Dragged = {type: string} | {from: number};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** Suggested title by POSITION — reordering renumbers the parts automatically. */
const suggestedTitle = (i: number, type: string) => 'Phần ' + (ROMAN[i] || i + 1) + '. ' + blockLabel(type);

// Compare folder name with the bank's subject, ignoring accents and case: folder "Văn" still matches "Ngữ văn".
const normalize = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** SPT default (design §3.3): Toán and Ngữ văn 90 minutes, other subjects 60. */
export const suggestedMinutes = (subject?: string) =>
    !subject || ['toan', 'ngu van'].includes(normalize(subject)) ? 90 : 60;

let keyCounter = 0;

/**
 * The teacher builds the exam structure and saves it. The saved exam has no
 * questions: on each attempt the BE draws one block per slot, in the order set
 * here, avoiding blocks the student has already seen (`_rut_de` in
 * tekkool_back/apis/exam.py).
 */
export default function CreateFromBank() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const folder = params.get('folder') || '';
    const bankParam = params.get('bank');

    const banksQ = useBanks();
    const foldersQ = useFolders(!!folder);
    const save = useCreateFromBank();
    const banks = banksQ.data;

    // Preselect: coming from a bank's "Tạo đề" picks exactly that bank; from a subject folder, every bank of that subject.
    const [picked, setPicked] = useState<string[] | null>(null);
    const defaultSelected = (): string[] => {
        if (!banks) return [];
        if (bankParam) return banks.some(b => b.id === bankParam) ? [bankParam] : [];
        const f = (foldersQ.data || []).find(x => x.id === folder);
        const match = f && banks.find(b => b.subject && (normalize(b.subject).includes(normalize(f.name))
            || normalize(f.name).includes(normalize(b.subject))));
        return match ? banks.filter(b => b.subject === match.subject).map(b => b.id) : [];
    };
    const selected = picked ?? defaultSelected();

    const [name, setName] = useState('');
    const [typedMinutes, setTypedMinutes] = useState<number | null>(null);
    const [structure, setStructure] = useState<Slot[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const dragging = useRef<Dragged | null>(null);

    const slots: Record<string, number> = {};
    structure.forEach(x => { slots[x.loai] = (slots[x.loai] || 0) + 1; });
    // Asks the BE whenever the banks or the slot count per type change; editing a title does not refetch.
    // With no slots the BE uses the subject's standard matrix — still called for the stock (per_type).
    const capQ = useBankCapacity(selected, slots);
    const capacity = selected.length ? capQ.data : undefined;

    const selectedSubject = banks && selected.length ? (banks.find(b => b.id === selected[0]) || {}).subject : undefined;
    const minutes = typedMinutes ?? suggestedMinutes(selectedSubject);

    const stock = (capacity && capacity.per_type) || {};
    // A type whose stock is below its slot count → say exactly how many are missing, not just "0 runs".
    const missing = Object.keys(slots).filter(t => (stock[t] || 0) < slots[t]);
    const runs = capacity && structure.length ? capacity.capacity : null;
    const level = runs === null ? '' : runs <= 0 || missing.length ? 'low' : runs < 3 ? 'mid' : 'high';

    const toggleBank = (id: string) => setPicked(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

    const addSlot = (type: string, at = structure.length) =>
        setStructure(list => [...list.slice(0, at), {loai: type, tieu_de: '', key: ++keyCounter}, ...list.slice(at)]);
    const move = (from: number, to: number) => setStructure(list => {
        if (to < 0 || to > list.length) return list;
        const next = list.slice();
        const [x] = next.splice(from, 1);
        next.splice(to > from ? to - 1 : to, 0, x);
        return next;
    });
    const setTitle = (i: number, title: string) => setStructure(list => list.map((x, j) => j === i ? {...x, tieu_de: title} : x));
    const remove = (i: number) => setStructure(list => list.filter((_x, j) => j !== i));

    const dragStart = (e: DragEvent, item: Dragged) => {
        dragging.current = item;
        // Firefox does not start a drag if dataTransfer is empty.
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'type' in item ? item.type : String(item.from));
        }
    };
    const dragOver = (e: DragEvent, i: number) => {
        if (!dragging.current) return;
        e.preventDefault();
        if (overIndex !== i) setOverIndex(i);
    };
    const drop = (e: DragEvent, to: number) => {
        e.preventDefault();
        const item = dragging.current;
        if (item) {
            if ('type' in item) addSlot(item.type, to);
            else move(item.from, to);
        }
        dragging.current = null;
        setOverIndex(null);
    };
    const dragEnd = () => { dragging.current = null; setOverIndex(null); };

    const submit = async () => {
        setFormError(null);
        if (!name.trim()) return setFormError('Chưa đặt tên đề.');
        if (!selected.length) return setFormError('Chưa chọn ngân hàng đề.');
        if (!structure.length) return setFormError('Cấu trúc đề đang trống — kéo ít nhất một loại khối vào.');
        if (missing.length) return setFormError('Ngân hàng chưa đủ khối cho cấu trúc này.');
        try {
            await save.mutateAsync({
                banks: selected,
                name: name.trim(),
                duration: minutes,
                folder: folder || undefined,
                // An empty slot saves the suggested title: students must see "Phần I…", not a blank line.
                cau_truc: structure.map((x, i) => ({loai: x.loai, tieu_de: x.tieu_de.trim() || suggestedTitle(i, x.loai)})),
            });
        } catch (e) {
            return setFormError(errorText(e, 'Lưu đề thất bại, thử lại.'));
        }
        if (folder) navigate('/subject/' + folder);
        else {
            notify.success("Đã tạo đề. Đề đang ở 'Đề ngoài thư mục' — chọn môn để học sinh thấy.");
            navigate('/question-bank');
        }
    };

    const body = banksQ.isError
        ? <ErrorState title='Không tải được danh sách ngân hàng' description={errorText(banksQ.error, 'Kiểm tra mạng rồi thử lại.')}
                      onRetry={() => banksQ.refetch()} retrying={banksQ.isFetching}/>
        : !banks
            ? <div className='vt-cfb-layout'><SkeletonCard/><SkeletonCard/></div>
            : <div className='vt-cfb-layout'>
                <div className='vt-cfb-main'>
                    <Card>
                        <div className='vt-cfb-info'>
                            <TextField label='Tên đề' placeholder='Ví dụ: Đề luyện thi — Ngữ văn' value={name}
                                       onChange={e => setName(e.target.value)} className='vt-cfb-name'/>
                            <TextField label='Thời gian (phút)' type='number' inputMode='numeric' min={0} value={minutes}
                                       onChange={e => setTypedMinutes(Math.max(0, Number(e.target.value) || 0))}
                                       hint={selectedSubject && typedMinutes === null
                                           ? 'Gợi ý cho ' + selectedSubject + ': ' + suggestedMinutes(selectedSubject) + ' phút' : undefined}/>
                        </div>
                        <div className='vt-cfb-banks' role='group' aria-label='Ngân hàng đề'>
                            <span className='vt-field-label'>Ngân hàng đề</span>
                            {banks.length === 0
                                ? <p className='vt-cfb-hint'>Chưa có ngân hàng nào — tạo ở mục Ngân hàng câu hỏi.</p>
                                : <div className='vt-cfb-chips'>
                                    {banks.map(b => {
                                        const on = selected.includes(b.id);
                                        // Mixing subjects would grade with wrong weights (the BE grades per subject).
                                        const off = !!selectedSubject && b.subject !== selectedSubject && !on;
                                        return <button key={b.id} type='button' aria-pressed={on} disabled={off}
                                                       className={cx('vt-cfb-chip', on && 'on')} onClick={() => toggleBank(b.id)}>
                                            {b.name}{b.subject ? ' · ' + b.subject : ''} · {b.blocks} khối{on ? ' ×' : ''}
                                        </button>;
                                    })}
                                </div>}
                            <p className='vt-cfb-hint'>
                                {folder ? 'Đề lưu vào thư mục môn đang mở và học sinh thấy ngay.'
                                    : 'Đề nằm ở "Đề ngoài thư mục" — chọn môn sau để học sinh thấy.'}
                            </p>
                        </div>
                    </Card>

                    <Card>
                        <div className='vt-cfb-title'>
                            <CardTitle>Cấu trúc đề</CardTitle>
                            <span>{structure.length} phần</span>
                        </div>
                        <p className='vt-cfb-hint'>Kéo loại khối từ cột phải vào, hoặc bấm +. Kéo để đổi thứ tự.</p>
                        <ol className='vt-cfb-list' onDragOver={e => dragOver(e, structure.length)} onDrop={e => drop(e, structure.length)}>
                            {structure.map((x, i) => {
                                const isLifted = dragging.current && 'from' in dragging.current && dragging.current.from === i;
                                return <li key={x.key} draggable
                                           className={cx('vt-cfb-slot', overIndex === i && 'over', isLifted && 'lifted')}
                                           style={{'--block-color': blockStyle(x.loai).color} as CSSProperties}
                                           onDragStart={e => dragStart(e, {from: i})}
                                           onDragOver={e => { e.stopPropagation(); dragOver(e, i); }}
                                           onDrop={e => { e.stopPropagation(); drop(e, i); }}
                                           onDragEnd={dragEnd}>
                                    <span className='vt-cfb-grip' aria-hidden='true'>⋮⋮</span>
                                    <div className='vt-cfb-slot-body'>
                                        <span className='vt-cfb-kind'>{blockLabel(x.loai)}</span>
                                        <input className='vt-input' value={x.tieu_de} aria-label={'Tiêu đề phần ' + (i + 1)}
                                               placeholder={suggestedTitle(i, x.loai)} maxLength={200}
                                               onChange={e => setTitle(i, e.target.value)}/>
                                    </div>
                                    <div className='vt-cfb-actions'>
                                        <IconButton variant='outline' label='Đưa lên' icon={<icons.IconArrowUp/>}
                                                    disabled={i === 0} onClick={() => move(i, i - 1)}/>
                                        <IconButton variant='outline' label='Đưa xuống' icon={<icons.IconArrowDown size={18}/>}
                                                    disabled={i === structure.length - 1} onClick={() => move(i, i + 2)}/>
                                        <IconButton variant='outline' label='Bỏ khối' tipEnd className='vt-iconbtn--danger'
                                                    icon={<icons.IconClose size={18}/>} onClick={() => remove(i)}/>
                                    </div>
                                </li>;
                            })}
                            <li className={cx('vt-cfb-drop', overIndex === structure.length && 'over', !structure.length && 'empty')}>
                                {structure.length ? 'Thả vào đây để thêm vào cuối'
                                    : 'Kéo loại khối từ bên phải vào đây, hoặc bấm nút + để thêm'}
                            </li>
                        </ol>
                    </Card>
                </div>

                <div className='vt-cfb-side'>
                    <Card size='md'>
                        <CardTitle>Loại khối</CardTitle>
                        {!selected.length && <p className='vt-cfb-hint'>Chọn ngân hàng để xem kho có những khối nào.</p>}
                        <div className='vt-cfb-palette'>
                            {Object.keys(BLOCK_LABELS).map(t => {
                                const have = stock[t] || 0;
                                const used = slots[t] || 0;
                                const off = !selected.length || !have;
                                return <div key={t} className={cx('vt-cfb-type', off && 'off')}
                                            style={{'--block-color': blockStyle(t).color} as CSSProperties}
                                            draggable={!off} onDragStart={e => dragStart(e, {type: t})} onDragEnd={dragEnd}>
                                    <div className='vt-cfb-type-text'>
                                        <b>{blockLabel(t)}</b>
                                        <small className={used > have ? 'short' : ''}>
                                            {selected.length ? (used ? 'dùng ' + used + ' / ' : '') + 'có ' + have + ' khối' : '—'}
                                        </small>
                                    </div>
                                    <IconButton variant='outline' label={'Thêm ' + blockLabel(t)} tipEnd disabled={off}
                                                icon={<span aria-hidden='true' style={{fontSize: 22, lineHeight: 1}}>+</span>}
                                                onClick={() => addSlot(t)}/>
                                </div>;
                            })}
                        </div>
                    </Card>

                    <Card size='md' className={cx('vt-cfb-capacity', level)}>
                        {capQ.isError && <p className='vt-cfb-err' role='alert'>Không tính được sức chứa ngân hàng</p>}
                        {runs === null
                            ? <p className='vt-cfb-hint'>Thêm khối vào cấu trúc để xem mỗi học sinh làm được bao nhiêu lần không lặp.</p>
                            : <>
                                <div className='vt-cfb-runs'><b>{runs}</b><span>lần làm không lặp<br/>cho mỗi học sinh</span></div>
                                {missing.length > 0 && <p>Thiếu khối: {missing.map(t =>
                                    blockLabel(t) + ' (cần ' + slots[t] + ', có ' + (stock[t] || 0) + ')').join('; ')}.</p>}
                                {!missing.length && runs < 3 && <p>Ít — học sinh làm lại sẽ sớm gặp khối cũ. Thêm khối vào ngân hàng
                                    {capacity && capacity.bottleneck ? ' loại ' + blockLabel(capacity.bottleneck[0]) : ''}.</p>}
                                {!missing.length && runs >= 3 && capacity && capacity.bottleneck &&
                                    <p>Loại hết trước: {blockLabel(capacity.bottleneck[0])}. Sau đó đề vẫn rút được, lặp khối ít gặp nhất.</p>}
                            </>}
                        {formError && <p className='vt-cfb-err' role='alert'>{formError}</p>}
                        <Button variant='primary' block size='lg' loading={save.isPending}
                                disabled={save.isPending || missing.length > 0} onClick={submit}>Lưu đề</Button>
                    </Card>
                </div>
            </div>;

    return <div className='vt-cfb'>
        <Link to='/question-bank' className={buttonClass({variant: 'ghost'})}>← Ngân hàng câu hỏi</Link>
        <PageTitle>Tạo đề từ ngân hàng</PageTitle>
        {body}
    </div>;
}
