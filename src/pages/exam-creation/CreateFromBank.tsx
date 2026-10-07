import {useEffect, useRef, useState} from 'react';
import type {CSSProperties, DragEvent} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Button, Dropdown, Form, Icon, Message} from 'semantic-ui-react';

import Loading from '../../components/Loading';
import Api from '../../services/api';
import type {BankCapacity, StructureSlot, Folder, QuestionBank} from '../../types/exam';
import {BLOCK_LABELS, blockStyle, blockLabel} from './blockTypes';

type Bank = QuestionBank & {blocks?: number};
/** Structure slot with a stable key: reordering must not mix up the inputs between cards. */
type Slot = StructureSlot & {key: number};
/** What is being dragged: a block type from the side palette, or an existing card (at position `from`). */
type Dragged = {type: string} | {from: number};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** Suggested title by POSITION — reordering renumbers the parts automatically. */
const suggestedTitle = (i: number, type: string) => 'Phần ' + (ROMAN[i] || i + 1) + '. ' + blockLabel(type);

const errorMessage = (e: unknown, fallback: string) => {
    const x = e as {error?: string; message?: string} | null;
    return (x && (x.error || x.message)) || fallback;
};

// Compare folder name with the bank's subject, ignoring accents and case: folder "Văn" still matches "Ngữ văn".
const normalize = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

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

    const [banks, setBanks] = useState<Bank[] | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [name, setName] = useState('');
    const [minutes, setMinutes] = useState(90);
    const [structure, setStructure] = useState<Slot[]>([]);
    const [capacity, setCapacity] = useState<BankCapacity | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const dragging = useRef<Dragged | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [list, folders]: [Bank[], Folder[]] = await Promise.all([
                    Api.get('question_bank/list'),
                    folder ? Api.get('folder/list') : Promise.resolve([]),
                ]);
                if (cancelled) return;
                setBanks(list);
                // Preselect: coming from a bank's "Tạo đề" button picks exactly that
                // bank; coming from a subject folder picks every bank of that subject.
                const bank = params.get('bank');
                const f = folders.find(x => x.id === folder);
                if (bank) setSelected(list.some(b => b.id === bank) ? [bank] : []);
                else if (f) {
                    const matchedBank = list.find(b => b.subject && (normalize(b.subject).includes(normalize(f.name))
                        || normalize(f.name).includes(normalize(b.subject))));
                    if (matchedBank) setSelected(list.filter(b => b.subject === matchedBank.subject).map(b => b.id));
                }
            } catch (e) {
                if (!cancelled) setError(errorMessage(e, 'Không tải được danh sách ngân hàng'));
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const slots: Record<string, number> = {};
    structure.forEach(x => { slots[x.loai] = (slots[x.loai] || 0) + 1; });
    const slotsKey = JSON.stringify(slots);

    // Ask the BE whenever the banks or the slot count per type change. Editing a
    // title does not change the key, so no re-fetch. With no slots the BE uses the
    // subject's standard matrix — still called to get the stock (per_type) for the type palette.
    useEffect(() => {
        if (!selected.length) return setCapacity(null);
        let cancelled = false;
        Api.post('question_bank/capacity', {banks: selected, slots})
            .then((c: BankCapacity) => { if (!cancelled) setCapacity(c); })
            .catch(e => { if (!cancelled) setError(errorMessage(e, 'Không tính được sức chứa ngân hàng')); });
        return () => { cancelled = true; };
    }, [selected.join(','), slotsKey]);

    if (!banks && !error) return <Loading/>;

    const stock = (capacity && capacity.per_type) || {};
    const selectedSubject = banks && selected.length ? (banks.find(b => b.id === selected[0]) || {}).subject : undefined;

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

    // A type whose stock is below its slot count → say exactly how many are missing, not just "0 runs".
    const missing = Object.keys(slots).filter(t => (stock[t] || 0) < slots[t]);
    const runs = capacity && structure.length ? capacity.capacity : null;
    const level = runs === null ? '' : runs <= 0 ? 'low' : runs < 3 ? 'mid' : 'high';

    const save = async () => {
        setError(null);
        if (!name.trim()) return setError('Chưa đặt tên đề.');
        if (!selected.length) return setError('Chưa chọn ngân hàng đề.');
        if (!structure.length) return setError('Cấu trúc đề đang trống — kéo ít nhất một loại khối vào.');
        if (missing.length) return setError('Ngân hàng chưa đủ khối cho cấu trúc này.');
        setSaving(true);
        try {
            await Api.post('exam/create_from_bank', {
                banks: selected,
                name: name.trim(),
                duration: minutes,
                folder: folder || undefined,
                // An empty slot saves the suggested title: students must see "Phần I…", not a blank line.
                cau_truc: structure.map((x, i) => ({loai: x.loai, tieu_de: x.tieu_de.trim() || suggestedTitle(i, x.loai)})),
            });
            navigate('/');
        } catch (e) {
            setSaving(false);
            setError(errorMessage(e, 'Lưu đề thất bại, thử lại.'));
        }
    };

    const options = (banks || []).map(b => ({
        key: b.id, value: b.id,
        text: b.name + (b.subject ? ' · ' + b.subject : ''),
        description: (b.blocks || 0) + ' khối',
        // Mixing subjects would grade with wrong weights (the BE grades per subject) — only allow the same subject.
        disabled: !!selectedSubject && b.subject !== selectedSubject && !selected.includes(b.id),
    }));

    return <div className='tk-cfb'>
        <div className='tk-cfb-head'>
            <h2><Icon name='random'/> Tạo đề từ ngân hàng</h2>
            <p>Mỗi lượt làm, học sinh nhận một đề rút ngẫu nhiên theo cấu trúc dưới đây, không lặp khối đã gặp.</p>
        </div>

        <div className='tk-cfb-layout'>
            <div className='tk-cfb-main'>
                <div className='tk-cfb-card'>
                    <Form>
                        <Form.Group widths='equal'>
                            <Form.Input label='Tên đề' placeholder='Ví dụ: Đề luyện thi vào 10 — Ngữ văn'
                                        value={name} onChange={(_e, {value}) => setName(value)} width={12}/>
                            <Form.Input label='Thời gian (phút)' type='number' min={0}
                                        value={minutes} width={4}
                                        onChange={(_e, {value}) => setMinutes(Math.max(0, Number(value) || 0))}/>
                        </Form.Group>
                        <Form.Field>
                            <label>Ngân hàng đề</label>
                            <Dropdown multiple search selection fluid options={options} value={selected}
                                      placeholder={banks && banks.length ? 'Chọn một hoặc nhiều ngân hàng cùng môn'
                                                                         : 'Chưa có ngân hàng nào — tạo ở mục Ngân hàng đề'}
                                      onChange={(_e, {value}) => setSelected(value as string[])}/>
                        </Form.Field>
                    </Form>
                </div>

                <div className='tk-cfb-card'>
                    <div className='tk-cfb-title'>
                        <h3>Cấu trúc đề</h3>
                        <span>{structure.length} phần</span>
                    </div>
                    <ol className='tk-cfb-list' onDragOver={e => dragOver(e, structure.length)} onDrop={e => drop(e, structure.length)}>
                        {structure.map((x, i) => {
                            const m = blockStyle(x.loai);
                            const isLifted = dragging.current && 'from' in dragging.current && dragging.current.from === i;
                            return <li key={x.key} draggable
                                       className={'tk-cfb-slot' + (overIndex === i ? ' over' : '') + (isLifted ? ' lifted' : '')}
                                       style={{'--block-color': m.color} as CSSProperties}
                                       onDragStart={e => dragStart(e, {from: i})}
                                       onDragOver={e => { e.stopPropagation(); dragOver(e, i); }}
                                       onDrop={e => { e.stopPropagation(); drop(e, i); }}
                                       onDragEnd={dragEnd}>
                                <Icon name='bars' className='tk-cfb-grip' aria-hidden='true'/>
                                <span className='tk-cfb-num'>{i + 1}</span>
                                <div className='tk-cfb-slot-body'>
                                    <span className='tk-cfb-kind'><Icon name={m.icon}/>{blockLabel(x.loai)}</span>
                                    <input className='tk-cfb-input' value={x.tieu_de} aria-label={'Tiêu đề phần ' + (i + 1)}
                                           placeholder={suggestedTitle(i, x.loai)} maxLength={200}
                                           onChange={e => setTitle(i, e.target.value)}/>
                                </div>
                                <div className='tk-cfb-actions'>
                                    <button type='button' aria-label='Lên' disabled={i === 0}
                                            onClick={() => move(i, i - 1)}><Icon name='arrow up'/></button>
                                    <button type='button' aria-label='Xuống' disabled={i === structure.length - 1}
                                            onClick={() => move(i, i + 2)}><Icon name='arrow down'/></button>
                                    <button type='button' aria-label='Xoá' className='remove'
                                            onClick={() => remove(i)}><Icon name='close'/></button>
                                </div>
                            </li>;
                        })}
                        <li className={'tk-cfb-drop' + (overIndex === structure.length ? ' over' : '') + (structure.length ? '' : ' empty')}>
                            <Icon name='hand pointer outline'/>
                            {structure.length ? 'Thả vào đây để thêm vào cuối'
                                      : 'Kéo loại khối từ bên phải vào đây, hoặc bấm nút + để thêm'}
                        </li>
                    </ol>
                </div>
            </div>

            <div className='tk-cfb-side'>
                <div className='tk-cfb-card'>
                    <h3>Loại khối</h3>
                    {!selected.length && <p className='tk-cfb-hint'>Chọn ngân hàng để xem kho có những khối nào.</p>}
                    <div className='tk-cfb-palette'>
                        {Object.keys(BLOCK_LABELS).map(t => {
                            const m = blockStyle(t);
                            const have = stock[t] || 0;
                            const used = slots[t] || 0;
                            const off = !selected.length || !have;
                            return <div key={t} className={'tk-cfb-type' + (off ? ' off' : '')}
                                        style={{'--block-color': m.color} as CSSProperties}
                                        draggable={!off} onDragStart={e => dragStart(e, {type: t})} onDragEnd={dragEnd}>
                                <span className='tk-cfb-type-icon'><Icon name={m.icon}/></span>
                                <div className='tk-cfb-type-text'>
                                    <b>{blockLabel(t)}</b>
                                    <small className={used > have ? 'short' : ''}>
                                        {selected.length ? (used ? 'dùng ' + used + ' / ' : '') + 'có ' + have + ' khối' : '—'}
                                    </small>
                                </div>
                                <button type='button' aria-label={'Thêm ' + blockLabel(t)} disabled={off}
                                        onClick={() => addSlot(t)}><Icon name='plus'/></button>
                            </div>;
                        })}
                    </div>
                </div>

                <div className={'tk-cfb-card tk-cfb-capacity ' + level}>
                    {runs === null
                        ? <p className='tk-cfb-hint'>Thêm khối vào cấu trúc để xem mỗi học sinh làm được bao nhiêu lần không lặp.</p>
                        : <>
                            <div className='tk-cfb-runs'><b>{runs}</b><span>lần làm không lặp<br/>cho mỗi học sinh</span></div>
                            {missing.length > 0 && <p>Thiếu khối: {missing.map(t =>
                                blockLabel(t) + ' (cần ' + slots[t] + ', có ' + (stock[t] || 0) + ')').join('; ')}.</p>}
                            {!missing.length && runs < 3 && <p>Ít — học sinh làm lại sẽ sớm gặp khối cũ. Thêm khối vào ngân hàng
                                {capacity && capacity.bottleneck ? ' loại ' + blockLabel(capacity.bottleneck[0]) : ''}.</p>}
                            {!missing.length && runs >= 3 && capacity && capacity.bottleneck &&
                            <p>Loại hết trước: {blockLabel(capacity.bottleneck[0])}. Sau đó đề vẫn rút được, lặp khối ít gặp nhất.</p>}
                        </>}
                    {error && <Message negative size='small'>{error}</Message>}
                    <Button primary fluid size='large' loading={saving} disabled={saving || !!missing.length}
                            onClick={save}>
                        <Icon name='save'/> Lưu đề
                    </Button>
                </div>
            </div>
        </div>
    </div>;
}
