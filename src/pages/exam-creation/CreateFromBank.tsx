import {useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';

import {Button, Card, ConfirmDialog, EmptyState, ErrorState, Loading, Modal, PageTitle, Select, TextField, buttonClass, cx, icons, notify} from '../../components/ui';
import {errorText, formatDecimal, stripPoints} from '../../lib/format';
import {readTemplateFile, useBankStats, useBanks, useCreateFromBank} from '../../queries/questionBank';
import type {FileTemplate} from '../../queries/questionBank';
import {useFolders} from '../../queries/exams';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {bankCount} from '../question-bank/BankList';
import {PEN} from './EditText';
import ExamSheet from './ExamSheet';
import TemplateCard from './TemplateCard';
import type {Source} from './TemplateCard';
import {kindName, kindUnit, typeName} from './blockTypes';
import {capacity, emptyLayout, frameProblem, numberize, overflow, questionsOf, shortages, toPayload} from './layoutRules';
import type {Layout} from './layoutRules';
import './import-exam.css';   // .vt-bk-alert, .vt-imp-bar styles shared with the import screen
import './create-from-bank.css';

// Compare folder name with the bank's subject, ignoring accents and case: folder "Văn" still matches "Ngữ văn".
const normalize = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** SPT default (design §3.3): Toán and Ngữ văn 90 minutes, other subjects 60. */
export const suggestedMinutes = (subject?: string) =>
    !subject || ['toan', 'ngu van'].includes(normalize(subject)) ? 90 : 60;

/** A template from the BE may omit optional fields; the sheet wants all of them. `{n}` replaces the ordinal typed in a title ("I.2" → "I.{n}"). */
export const fromTemplate = (t: FileTemplate): Layout => (t.layout || []).map(g => ({
    title: g.title || '',
    parts: (g.parts || []).map(p => ({
        title: stripPoints(p.title || ''), lead: p.lead || '', description: p.description || null, score: p.score ?? null,
        numbering: p.numbering === 'restart' ? 'restart' as const : 'continue' as const,
        items: (p.items || []).map((i, k) => ({title: numberize(i.title || '', k + 1), block_type: i.block_type, count: i.count || 1})),
    })),
}));

/** The frame the teacher edited, kept in the browser so F5 does not lose it. `template` is the exam of the file it came from (null = blank sheet). */
type Draft = {name: string; layout: Layout; savedAt: number; file?: string | null; template?: FileTemplate | null; auto?: string; minutes?: number | null};
const MAX_BYTES = 10 * 1024 * 1024;   // same limit as import_docx/*
const NO_STRUCTURE = 'Không đọc được cấu trúc đề: không thấy dòng “Phần I/II…” kèm điểm. Hệ thống cần các dòng như “Phần I (3 điểm). Thí sinh trả lời…”.';
/** "Ngữ văn SPT — theo khối": the kind is added to the name, unless the teacher already typed it in the name. */
const bankName = (b: {name: string; kind?: string}) => {
    const kind = b.kind === 'paper' ? 'nguyên đề' : 'theo khối';
    const bare = b.name.replace(new RegExp(`\\s*[—–-]\\s*${kind}\\s*$`, 'i'), '').trim();
    return `${bare || b.name} — ${kind}`;
};
/** An exam is named "Đề số 3 - NGỮ VĂN" in the file; the subject suffix is noise next to the subject chip. */
const sampleName = (name: string, subject?: string) => subject
    ? name.replace(new RegExp(`\\s*[-–—]\\s*${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '') : name;
/** "3 phần · 12 câu · 10 điểm": what the frame of this exam gives (points only when every phần has one). */
const summary = (t: FileTemplate) => {
    const parts = fromTemplate(t).flatMap(g => g.parts);
    const pts = parts.length && parts.every(p => p.score != null) ? parts.reduce((n, p) => n + (p.score || 0), 0) : null;
    const qs = parts.reduce((n, p) => n + p.items.reduce((k, i) => k + questionsOf(i), 0), 0);
    return [`${parts.length} phần`, `${qs} câu`, pts != null && `${formatDecimal(pts)} điểm`].filter(Boolean).join(' · ');
};
/** The first Phần whose size changed against the file ("Phần I thành 3 đoạn"), for the "Đổi file đề mẫu?" question. */
const editNote = (layout: Layout, base: Layout | null) => {
    const size = (p: {items: {count: number}[]}) => p.items.reduce((n, i) => n + i.count, 0);
    const old = (base || []).flatMap(g => g.parts);
    const at = layout.flatMap(g => g.parts).filter((p, k) => old[k] && size(p) !== size(old[k]))[0];
    return at?.items[0] ? ` (${at.title} thành ${size(at)} ${kindUnit(at.items[0].block_type)})` : '';
};
const sameDay = (t: number) => new Date(t).toDateString() === new Date().toDateString();
const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * One screen (artboards APP-teacher-bank-v5-create-*): bank + sample file on the left, the exam as the student sees it on the right,
 * edited where it stands. The sample is a .docx the teacher uploads (`import_docx/layout`): only its frame is used. The saved exam has
 * no questions: on each attempt the BE draws the blocks the frame asks for, avoiding blocks the student has seen, and renumbers
 * the questions (`{from}`/`{to}`). A whole-exam bank needs no frame: name + minutes, save.
 */
export default function CreateFromBank() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const wide = useMediaQuery(DESKTOP);
    const folder = params.get('folder') || '';

    const banksQ = useBanks();
    const foldersQ = useFolders();
    const save = useCreateFromBank();
    const banks = banksQ.data;

    const [bankId, setBankId] = useState(params.get('bank') || '');
    const [src, setSrc] = useState<Source | null>(null);   // the uploaded sample file
    const [blank, setBlank] = useState(false);   // "Không dùng đề mẫu": blank sheet
    const [layout, setLayout] = useState<Layout>(emptyLayout);
    const [name, setName] = useState('');
    const [auto, setAuto] = useState('');   // the name the sample brought: only a different name counts as an edit
    const [typedMinutes, setTypedMinutes] = useState<number | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [restore, setRestore] = useState<Draft | null>(null);
    const [ask, setAsk] = useState<{go: () => void; file: boolean} | null>(null);   // what to do once "Bỏ các chỗ đã sửa?" is confirmed
    const inited = useRef('');
    const reading = useRef(0);   // number of the read in progress: a Huỷ or a newer file makes the older answer fall on deaf ears
    const picker = useRef<HTMLInputElement>(null);

    const bank = banks?.find(b => b.id === bankId);
    const paper = bank?.kind === 'paper';
    const folderName = (foldersQ.data || []).find(f => f.id === folder)?.name;
    // Only the banks of this subject (a bank without subject has no say, so it stays).
    const visible = useMemo(() => !banks ? [] : !folderName ? banks : banks.filter(b => !b.subject || normalize(b.subject) === normalize(folderName)), [banks, folderName]);
    // Page opened without ?folder=: the subject (and its page) is the chosen bank's.
    const subjectFolder = folder ? {id: folder, name: folderName} : (foldersQ.data || []).find(f => !f.parent && !!bank?.subject && normalize(f.name) === normalize(bank.subject));
    const subject = subjectFolder?.name || bank?.subject;

    const statsQ = useBankStats(bank && !paper ? bank.id : '');
    const stock = statsQ.data?.per_type || {};
    const minutes = typedMinutes ?? suggestedMinutes(bank?.subject);
    const template = src?.status === 'ok' ? src.templates[src.pick] : undefined;
    const base = useMemo(() => template ? fromTemplate(template) : null, [template]);   // what "Như đề mẫu" compares with
    const infos = useMemo(() => (src?.templates || []).map(summary), [src]);
    const chosen = blank || !!template;
    const dirty = chosen && (JSON.stringify(layout) !== JSON.stringify(base ?? emptyLayout()) || name !== auto || typedMinutes !== null);
    /** "Đề luyện Ngữ văn — theo <title in the file; the file name when it has none>". */
    const defaultName = (t?: FileTemplate, file = '', n = 1) => `Đề luyện${subject ? ' ' + subject : ''}${t
        ? ` — theo ${n === 1 && /^Đề số \d+$/i.test(t.name.trim()) ? file.replace(/\.docx$/i, '') : sampleName(t.name, subject)}` : ''}`;

    // Draft of the sheet in the browser: F5 or a closed tab does not lose it. Keyed by bank + folder; written only after an edit.
    const draftKey = `spt-cfb-draft:${bankId}:${folder}`;
    useEffect(() => {
        if (!dirty || paper || !bankId || restore) return;
        const t = window.setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify({name, layout, savedAt: Date.now(), file: template ? src?.file : null, template: template ?? null, auto, minutes: typedMinutes} satisfies Draft));
            } catch { /* storage full or blocked: the draft is only a convenience */ }
        }, 600);
        return () => window.clearTimeout(t);
    }, [dirty, paper, bankId, draftKey, name, layout, src, template, auto, typedMinutes, restore]);
    const readDraft = (): Draft | null => {
        try {
            const raw = localStorage.getItem(draftKey);
            const d = raw ? JSON.parse(raw) as Draft : null;
            return d && Array.isArray(d.layout) && d.layout.length ? d : null;
        } catch { return null; }
    };

    /** Put an exam of the file (or the blank sheet) on the page: layout, name and minutes start over. */
    const apply = (t?: FileTemplate, file = '', n = 1) => {
        const nm = defaultName(t, file, n);
        setLayout(t ? fromTemplate(t) : emptyLayout());
        setName(nm); setAuto(nm); setTypedMinutes(null); setFormError(null);
    };
    /** Changing the file, its exam or the bank after edits asks first, so a click does not wipe the work. */
    const guard = (go: () => void, file = false) => dirty ? setAsk({go, file}) : go();
    const open = () => guard(() => picker.current?.click(), true);
    const read = async (f: File) => {
        const id = ++reading.current;
        const refuse = (error: string) => setSrc({file: f.name, status: 'error', templates: [], pick: 0, error});
        localStorage.removeItem(draftKey);
        setBlank(false);
        if (!/\.docx$/i.test(f.name)) return refuse('Chỉ nhận file Word .docx. Hãy lưu file ở dạng .docx rồi chọn lại.');
        if (f.size > MAX_BYTES) return refuse('File lớn hơn 10 MB. Hãy dùng file nhỏ hơn.');
        setSrc({file: f.name, status: 'reading', templates: [], pick: 0});
        try {
            const {templates} = await readTemplateFile(f);
            if (id !== reading.current) return;
            if (!templates?.length) return refuse(NO_STRUCTURE);
            setSrc({file: f.name, status: 'ok', templates, pick: 0});
            apply(templates[0], f.name, templates.length);
        } catch (e) {
            if (id !== reading.current) return;
            refuse((e as {reason?: string} | null)?.reason === 'no_structure' ? NO_STRUCTURE : errorText(e, 'Không đọc được file. Thử lại hoặc chọn file khác.'));
        }
    };
    const dropped = (files: File[]) => files[0] && guard(() => read(files[0]), true);
    const cancelRead = () => { reading.current++; setSrc(null); };
    const pickExam = (i: number) => src && i !== src.pick && guard(() => {
        localStorage.removeItem(draftKey);
        setSrc({...src, pick: i}); apply(src.templates[i], src.file, src.templates.length);
    });
    const pickBlank = () => !blank && guard(() => { localStorage.removeItem(draftKey); reading.current++; setSrc(null); setBlank(true); apply(); });
    const pickBank = (id: string) => id !== bankId && guard(() => {
        localStorage.removeItem(draftKey); reading.current++;
        setBankId(id); setSrc(null); setBlank(false); setLayout(emptyLayout()); setName(''); setAuto(''); setTypedMinutes(null); setFormError(null);
    });

    // A single bank is chosen for you (artboard: "có sẵn khi môn chỉ có 1 ngân hàng"); with several, the first one.
    useEffect(() => {
        if (!bankId && visible.length && !foldersQ.isLoading) setBankId(visible.reduce((best, b) => bankCount(b) > bankCount(best) ? b : best).id);
    }, [bankId, visible, foldersQ.isLoading]);
    // Bank ready: ask about a draft left by a closed tab (once per bank).
    useEffect(() => {
        if (!bank || paper || foldersQ.isLoading || inited.current === bank.id) return;
        inited.current = bank.id;
        const d = readDraft();
        if (d) setRestore(d);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bank, paper, foldersQ.isLoading]);
    useEffect(() => {
        setParams(p => {
            const q = new URLSearchParams(p);
            if (bankId) q.set('bank', bankId); else q.delete('bank');
            q.delete('template'); q.delete('step');
            return q.toString() === p.toString() ? p : q;
        }, {replace: true});
    }, [bankId, setParams]);

    const startDraft = (d: Draft | null) => {
        setRestore(null);
        if (!d) return localStorage.removeItem(draftKey);
        // A draft from before v5 has no `template`: it comes back as a blank sheet with the same text.
        setSrc(d.template && d.file ? {file: d.file, status: 'ok', templates: [d.template], pick: 0} : null);
        setBlank(!d.template);
        setLayout(d.layout); setName(d.name || ''); setAuto(d.auto ?? ''); setTypedMinutes(d.minutes ?? null);
    };

    // What stops "Tạo đề" and the one sentence that says why.
    const stockKnown = statsQ.isSuccess;
    const over = overflow(layout, stock);
    const lack = shortages(layout, stock).map(s => ({...s, miss: s.need - s.have, tags: over.filter(o => o.type === s.type).map(o => o.tag)}));
    const parts = (tags: string[]) => [...new Set(tags.map(t => 'Phần ' + t.split('.')[0]))].join(', ');   // "II.1" → "Phần II"
    const problem = frameProblem(layout, name);
    const empty = !layout.some(g => g.parts.some(p => p.items.length));
    const runs = capacity(layout, stock);
    const blocked = !chosen || !stockKnown || !!problem || lack.length > 0;
    // A type the bank has none of (the file asks for it) is told apart from "too few": the three ways out are at the frame.
    const shortHint = lack.map(l => l.have === 0
        ? `Ngân hàng chưa có câu ${typeName(l.type)} (${parts(l.tags)}). Xoá, đổi dạng hoặc nhập thêm đề.`
        : `Thiếu ${l.miss} ${lower(kindName(l.type))}${l.tags.length ? ` ở ${l.tags.join(', ')}` : ''}. Bớt ${l.miss} ${kindUnit(l.type)} hoặc nhập thêm đề.`).join(' ');
    const hint: {text: ReactNode; bad: boolean} = !chosen
        ? {text: src?.status === 'reading' ? 'Đang đọc file đề mẫu…' : src ? 'Tải lên đề mẫu đọc được để xem đề.' : 'Tải lên một đề mẫu để xem đề.', bad: false}
        : lack.length ? {text: shortHint, bad: true}
        : problem ? {text: problem, bad: false}
        : {text: <>Đề lưu vào <b>Môn & đề{subject ? ` › ${subject}` : ''}</b>, dạng Nháp. Học sinh chỉ thấy khi bạn xuất bản.</>, bad: false};

    const submit = async () => {
        setFormError(null);
        if (!bank) return setFormError('Chưa chọn ngân hàng đề.');
        if (!name.trim()) return setFormError('Chưa đặt tên đề.');
        if (!paper && blocked) return setFormError(typeof hint.text === 'string' && hint.text ? hint.text : 'Chưa tạo được đề.');
        let made: {id?: string; folder?: string | {id?: string} | null};
        try {
            made = await save.mutateAsync({banks: [bank.id], name: name.trim(), duration: minutes, folder: folder || undefined,
                layout: paper ? undefined : toPayload(layout), source_file: template ? src?.file : undefined}) as typeof made;
        } catch (e) {
            return setFormError(errorText(e, 'Lưu đề thất bại, thử lại.'));
        }
        localStorage.removeItem(draftKey);
        // BV2-08: land on Môn & đề › the subject (Nháp filter, "Mới tạo"): the chosen one, else the folder the BE put it in, else the bank's subject.
        const fromBe = typeof made?.folder === 'string' ? made.folder : made?.folder?.id;
        const target = folder || fromBe || (foldersQ.data || []).find(f => !f.parent && !!bank.subject && normalize(f.name) === normalize(bank.subject))?.id;
        if (target) {
            navigate('/subject/' + target, {state: {created: made?.id ? [made.id] : [], createdName: name.trim()}});
        } else {
            notify.success("Đã tạo đề. Đề đang ở 'Đề ngoài thư mục' — chọn môn để học sinh thấy.");
            navigate('/question-bank');
        }
    };

    if (banksQ.isError) return <div className='v3-page'><PageTitle>Tạo đề từ ngân hàng</PageTitle>
        <ErrorState title='Không tải được danh sách ngân hàng' description={errorText(banksQ.error, 'Kiểm tra mạng rồi thử lại.')}
                    onRetry={() => banksQ.refetch()} retrying={banksQ.isFetching}/></div>;
    if (!banks) return <div className='v3-page'><Loading/></div>;

    const bankField = <Select label='Ngân hàng' value={bankId} onChange={e => pickBank(e.target.value)}
                              options={visible.map(b => ({value: b.id, label: bankName(b)}))}/>;
    const have = Object.entries(stock).filter(([, n]) => n > 0);
    const capLine = !paper && stockKnown && (!chosen ? <p className='v3-cap' role='status'><icons.IconCheckCircle size={18} color='var(--vt-muted)'/>
        <span>{have.length ? <>Ngân hàng có {have.map(([t, n], i) => <span key={t}>{i > 0 && ', '}<b>{n} {lower(kindName(t))}</b></span>)}.</> : 'Ngân hàng chưa có khối nào.'}</span></p>
        : lack.length ? <p className='v3-cap v3-cap--bad' role='status'>{lack.some(l => l.have === 0) ? <icons.IconWarn size={18}/> : <icons.IconAlert size={18}/>}
        <span>Chưa đủ: {lack.map((l, i) => <span key={l.type}>{i > 0 && '; '}{l.have === 0
            ? <>ngân hàng thiếu dạng <b>{typeName(l.type)}</b> ({parts(l.tags)})</>
            : <>thiếu <b>{l.miss} {lower(kindName(l.type))}</b>{l.tags.length > 0 && ` (${l.tags.join(', ')})`}</>}</span>)}.</span></p>
        : empty || runs === null ? <p className='v3-cap' role='status'><icons.IconCheckCircle size={18} color='var(--vt-muted)'/><span>Đề chưa có câu nào. Thêm đoạn hoặc câu vào {layout[0]?.parts[0]?.title || 'Phần I'}.</span></p>
        : <p className='v3-cap' role='status'><icons.IconCheckCircle size={18} color='var(--vt-ok-icon)'/><span>Ngân hàng đủ để mỗi học sinh làm khoảng <b>{runs} đề</b> không trùng đoạn.</span></p>);

    const side = paper ? <div className='v3-side'><Card size='md'>{bankField}</Card></div>
        : <div className='v3-side'>
            <Card size='md'>{bankField}{capLine}</Card>
            <TemplateCard src={src} blank={blank} infos={infos} onOpen={open} onFiles={dropped} onCancel={cancelRead} onPick={pickExam} onBlank={pickBlank}
                          sampleHref={`/mau-de/${normalize(subject) === 'ngu van' ? 'mau-ngu-van' : 'mau-khtn'}.docx`}/>
            <input ref={picker} type='file' hidden accept='.docx' aria-label='Chọn file đề mẫu .docx'
                   onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) read(f); }}/>
        </div>;

    const sheet = !chosen ? (src?.status === 'reading' ? <div className='v3-empty'>
            <span className='vt-bk-spin' aria-hidden='true'/><b>Đang đọc cấu trúc đề…</b><span>Thường mất vài giây. Tờ đề sẽ hiện ở đây.</span>
        </div>
        : src ? <div className='v3-empty'>
            <b>Chưa có tờ đề</b><span>File này không đọc được cấu trúc. Chọn file khác, hoặc “Không dùng đề mẫu” để bắt đầu từ tờ trống.</span>
        </div>
        : wide && <div className='v3-empty'>
            <b>Tải lên một đề để lấy cấu trúc</b><span>Đề mới sẽ hiện ở đây đúng như học sinh thấy. Câu hỏi sẽ rút từ ngân hàng.</span>
            <div className='v3-steps'>
                <div><i>1. Tải đề mẫu</i>Một file .docx bất kỳ có đúng dáng đề bạn muốn.</div>
                <div><i>2. Xem đề</i>Đúng phần, điểm, lời dẫn của file; câu hỏi rút ngẫu nhiên cho từng học sinh.</div>
                <div><i>3. Bấm Tạo đề</i>Muốn khác thì sửa ngay trên đề.</div>
            </div>
        </div>)
        : statsQ.isError ? <ErrorState title='Không tải được số đoạn, câu của ngân hàng' description={errorText(statsQ.error, 'Kiểm tra mạng rồi thử lại.')} onRetry={() => statsQ.refetch()} retrying={statsQ.isFetching}/>
        : !stockKnown ? <Loading/>
        : <div className='v3-col'>
            <p className='v3-hint'>{PEN}<span>Bấm vào chữ hoặc khung trên đề để sửa. Số <span className='v3-n'>tô xanh</span> tự cập nhật.</span></p>
            <ExamSheet name={name} minutes={minutes} onName={setName} onMinutes={setTypedMinutes} layout={layout} onLayout={setLayout}
                       stock={stock} bankId={bankId} base={base}/>
            {!wide && hint.bad && <p className={cx('v3-cap', hint.bad && 'v3-cap--bad')} role='alert'>{hint.bad && <icons.IconAlert size={18}/>}<span>{hint.text}</span></p>}
            {formError && <p className='vt-cfb-err' role='alert'>{formError}</p>}
        </div>;

    const paperCard = paper && bank && <Card size='md' className='v3-paperbank'>
        <h2 className='v3-h2'>Đề nguyên bản</h2>
        <p className='v3-muted'>Kho có <b>{bankCount(bank)} đề</b>. Mỗi học sinh làm hết {bankCount(bank)} đề mới bị lặp lại đề đã làm. Ngân hàng nguyên đề không dùng khung.</p>
        <div className='vt-cfb-info'>
            <TextField label='Tên đề' value={name} onChange={e => setName(e.target.value)}/>
            <TextField label='Thời gian (phút)' type='number' inputMode='numeric' min={0} value={minutes}
                       onChange={e => setTypedMinutes(Math.max(0, Number(e.target.value) || 0))}/>
        </div>
        {formError && <p className='vt-cfb-err' role='alert'>{formError}</p>}
        <Button variant='primary' loading={save.isPending} disabled={save.isPending || bankCount(bank) === 0} onClick={submit}>Lưu đề</Button>
    </Card>;

    const create = (extra?: string) => <Button variant='primary' size='lg' className={extra} loading={save.isPending}
                                               disabled={save.isPending || blocked} onClick={submit}>Tạo đề</Button>;

    return <div className='v3-page'>
        <Link to={subjectFolder ? '/subject/' + subjectFolder.id : '/'} className={buttonClass({variant: 'ghost'})}>← Môn & đề{subject ? ` › ${subject}` : ''}</Link>
        <div className='v3-head'>
            <div><PageTitle>Tạo đề từ ngân hàng</PageTitle>
                <p className='v3-muted'>Tải lên một đề mẫu, xem đề sẽ trông thế nào, bấm Tạo đề. Muốn khác thì sửa ngay trên đề.</p></div>
            {wide && !paper && <div className='v3-headact'>{create()}<span className={cx(hint.bad && 'v3-cap--bad')}>{hint.text}</span></div>}
        </div>
        {visible.length === 0
            ? <EmptyState title='Chưa có ngân hàng nào' description='Tạo ngân hàng ở mục Ngân hàng câu hỏi rồi quay lại.'/>
            : <div className='v3-layout'>{side}{paperCard || sheet}</div>}
        {!wide && !paper && <>
            <div className='v3-spacer'/>
            <Card className='vt-imp-bar v3-bar' role='region' aria-label='Tạo đề'>{create()}</Card>
        </>}

        <ConfirmDialog open={!!ask} onCancel={() => setAsk(null)} onConfirm={() => { const go = ask?.go; setAsk(null); go?.(); }}
                       title={ask?.file ? 'Đổi file đề mẫu?' : 'Bỏ các chỗ đã sửa?'}
                       cancelLabel={ask?.file ? 'Giữ tờ đề đang sửa' : 'Giữ lại'} confirmLabel={ask?.file ? 'Đổi file' : 'Bỏ và đổi'}
                       message={ask?.file ? <p>Bạn đã sửa tờ đề{editNote(layout, base)}. Đổi file thì tờ đề lấy lại theo file mới và <b>các chỗ đã sửa sẽ mất</b>.</p>
                           : 'Đề đang soạn có chỗ bạn đã sửa. Đổi đề mẫu hoặc ngân hàng thì các chỗ đó mất.'}/>
        {/* Esc / outside click = just close: the draft stays and we ask again next time. Only "Bỏ, làm lại từ đầu" deletes it. */}
        <Modal open={!!restore} onClose={() => setRestore(null)} title='Tiếp tục khung đang soạn dở?'
               footer={<>
                   <Button variant='secondary' onClick={() => startDraft(null)}>Bỏ, làm lại từ đầu</Button>
                   <Button variant='primary' onClick={() => startDraft(restore)}>Tiếp tục soạn</Button>
               </>}>
            {restore && <>
                <p>{restore.name ? `“${restore.name}”, ` : ''}{restore.template && restore.file ? `lấy cấu trúc từ ${restore.file}` : 'dựng từ trống'}{bank ? `, ${bankName(bank)}` : ''}.</p>
                <p className='v3-muted'>Tự lưu lúc {hhmm(restore.savedAt)} {sameDay(restore.savedAt) ? 'hôm nay' : `ngày ${new Date(restore.savedAt).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}`} trên trình duyệt này.</p>
            </>}
        </Modal>
    </div>;
}
