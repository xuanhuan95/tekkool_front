import {useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';

import {Button, Card, ConfirmDialog, EmptyState, ErrorState, Loading, Modal, PageTitle, Select, TextField, buttonClass, cx, icons, notify} from '../../components/ui';
import {errorText, formatDecimal, stripPoints} from '../../lib/format';
import {useBankStats, useBankTemplates, useBanks, useCreateFromBank} from '../../queries/questionBank';
import type {BankTemplate} from '../../queries/questionBank';
import {useFolders} from '../../queries/exams';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {bankCount} from '../question-bank/BankList';
import {dayMonth} from './ImportAlerts';
import {PEN} from './EditText';
import ExamSheet from './ExamSheet';
import {kindName, kindUnit} from './blockTypes';
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
export const fromTemplate = (t: BankTemplate): Layout => (t.layout || []).map(g => ({
    title: g.title || '',
    parts: (g.parts || []).map(p => ({
        title: stripPoints(p.title || ''), lead: p.lead || '', description: p.description || null, score: p.score ?? null,
        numbering: p.numbering === 'restart' ? 'restart' as const : 'continue' as const,
        items: (p.items || []).map((i, k) => ({title: numberize(i.title || '', k + 1), block_type: i.block_type, count: i.count || 1})),
    })),
}));

type Draft = {name: string; layout: Layout; savedAt: number; template: string | null; minutes?: number | null};
const NONE = 'none';   // template id of "Không dùng đề mẫu"
const FIRST_TEMPLATES = 5;
/** "Ngữ văn SPT — theo khối": the kind is added to the name, unless the teacher already typed it in the name. */
const bankName = (b: {name: string; kind?: string}) => {
    const kind = b.kind === 'paper' ? 'nguyên đề' : 'theo khối';
    const bare = b.name.replace(new RegExp(`\\s*[—–-]\\s*${kind}\\s*$`, 'i'), '').trim();
    return `${bare || b.name} — ${kind}`;
};
/** A sample exam is named "Đề số 3 - NGỮ VĂN" after import; the subject suffix is noise next to the subject chip. */
const sampleName = (name: string, subject?: string) => subject
    ? name.replace(new RegExp(`\\s*[-–—]\\s*${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '') : name;
/** "12 câu · 10 điểm · nhập 15/11": what copying this sample gives (points only when every phần has one). */
const sampleSummary = (t: BankTemplate) => {
    const layout = fromTemplate(t);
    const parts = layout.flatMap(g => g.parts);
    const pts = parts.length && parts.every(p => p.score != null) ? parts.reduce((n, p) => n + (p.score || 0), 0) : null;
    const day = dayMonth(t.created_at);
    return [`${layout.reduce((n, g) => n + g.parts.reduce((m, p) => m + p.items.reduce((k, i) => k + questionsOf(i), 0), 0), 0)} câu`, pts != null && `${formatDecimal(pts)} điểm`, day && `nhập ${day}`].filter(Boolean).join(' · ');
};
const sameDay = (t: number) => new Date(t).toDateString() === new Date().toDateString();
const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * One screen (artboards APP-teacher-bank-v3-create-*): bank + sample exam on the left, the exam as the student sees it on the right,
 * edited where it stands. The saved exam has no questions: on each attempt the BE draws the blocks the frame asks for,
 * avoiding blocks the student has seen, and renumbers the questions (`{from}`/`{to}`). A whole-exam bank needs no frame: name + minutes, save.
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
    const [tpl, setTpl] = useState<string | null>(params.get('template'));   // null = not chosen yet, NONE = blank sheet
    const [showAll, setShowAll] = useState(false);
    const [layout, setLayout] = useState<Layout>(emptyLayout);
    const [name, setName] = useState('');
    const [auto, setAuto] = useState('');   // the name the sample brought: only a different name counts as an edit
    const [typedMinutes, setTypedMinutes] = useState<number | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [restore, setRestore] = useState<Draft | null>(null);
    const [ask, setAsk] = useState<(() => void) | null>(null);   // what to do once "Bỏ các chỗ đã sửa?" is confirmed
    const inited = useRef('');

    const bank = banks?.find(b => b.id === bankId);
    const paper = bank?.kind === 'paper';
    const folderName = (foldersQ.data || []).find(f => f.id === folder)?.name;
    // Only the banks of this subject (a bank without subject has no say, so it stays).
    const visible = useMemo(() => !banks ? [] : !folderName ? banks : banks.filter(b => !b.subject || normalize(b.subject) === normalize(folderName)), [banks, folderName]);
    // Page opened without ?folder=: the subject (and its page) is the chosen bank's.
    const subjectFolder = folder ? {id: folder, name: folderName} : (foldersQ.data || []).find(f => !f.parent && !!bank?.subject && normalize(f.name) === normalize(bank.subject));
    const subject = subjectFolder?.name || bank?.subject;

    const tplQ = useBankTemplates(bank && !paper ? bank.id : '');
    const statsQ = useBankStats(bank && !paper ? bank.id : '');
    const stock = statsQ.data?.per_type || {};
    const minutes = typedMinutes ?? suggestedMinutes(bank?.subject);
    const tplName = (t: {name: string}) => sampleName(t.name, subject);
    const templates = useMemo(() => (tplQ.data || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'vi', {numeric: true})), [tplQ.data]);
    const template = tpl && tpl !== NONE ? tplQ.data?.find(t => t.id === tpl) : undefined;
    const base = useMemo(() => template ? fromTemplate(template) : null, [template]);   // what "Như đề mẫu" compares with
    const chosen = tpl !== null && (tpl === NONE || !!template);
    const dirty = chosen && (JSON.stringify(layout) !== JSON.stringify(base ?? emptyLayout()) || name !== auto || typedMinutes !== null);
    const defaultName = (t?: BankTemplate) => `Đề luyện${subject ? ' ' + subject : ''}${t ? ` — theo ${tplName(t)}` : ''}`;

    // Draft of the sheet in the browser: F5 or a closed tab does not lose it. Keyed by bank + folder; written only after an edit.
    const draftKey = `spt-cfb-draft:${bankId}:${folder}`;
    useEffect(() => {
        if (!dirty || paper || !bankId || restore) return;
        const t = window.setTimeout(() => {
            try { localStorage.setItem(draftKey, JSON.stringify({name, layout, savedAt: Date.now(), template: tpl, minutes: typedMinutes} satisfies Draft)); }
            catch { /* storage full or blocked: the draft is only a convenience */ }
        }, 600);
        return () => window.clearTimeout(t);
    }, [dirty, paper, bankId, draftKey, name, layout, tpl, typedMinutes, restore]);
    const readDraft = (): Draft | null => {
        try {
            const raw = localStorage.getItem(draftKey);
            const d = raw ? JSON.parse(raw) as Draft : null;
            return d && Array.isArray(d.layout) && d.layout.length ? d : null;
        } catch { return null; }
    };

    /** Put a sample (or the blank sheet) on the page: layout, name and minutes start over. */
    const apply = (id: string | null) => {
        const t = id && id !== NONE ? tplQ.data?.find(x => x.id === id) : undefined;
        const n = id === null || (id !== NONE && !t) ? '' : defaultName(t);
        setTpl(id === NONE || t ? id : null);
        setLayout(t ? fromTemplate(t) : emptyLayout());
        setName(n); setAuto(n); setTypedMinutes(null); setFormError(null);
    };
    /** Changing the sample or bank after edits asks first, so a click does not wipe the work. */
    const guard = (go: () => void) => dirty ? setAsk(() => go) : go();
    const choose = (id: string) => id !== tpl && guard(() => { localStorage.removeItem(draftKey); apply(id); });
    const pickBank = (id: string) => id !== bankId && guard(() => {
        localStorage.removeItem(draftKey);
        setBankId(id); setTpl(null); setShowAll(false); setLayout(emptyLayout()); setName(''); setAuto(''); setTypedMinutes(null); setFormError(null);
    });

    // A single bank is chosen for you (artboard: "có sẵn khi môn chỉ có 1 ngân hàng"); with several, the first one.
    useEffect(() => {
        if (!bankId && visible.length && !foldersQ.isLoading) setBankId(visible[0].id);
    }, [bankId, visible, foldersQ.isLoading]);
    // Bank ready: put the sample from the URL on the page and ask about a draft left by a closed tab (once per bank).
    useEffect(() => {
        if (!bank || paper || tplQ.isLoading || foldersQ.isLoading || inited.current === bank.id) return;
        inited.current = bank.id;
        if (tpl) apply(tpl);
        const d = readDraft();
        if (d) setRestore(d);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bank, paper, tplQ.isLoading, foldersQ.isLoading]);
    useEffect(() => {
        setParams(p => {
            const q = new URLSearchParams(p);
            if (bankId) q.set('bank', bankId); else q.delete('bank');
            if (tpl) q.set('template', tpl); else q.delete('template');
            q.delete('step');
            return q.toString() === p.toString() ? p : q;
        }, {replace: true});
    }, [bankId, tpl, setParams]);

    const startDraft = (d: Draft | null) => {
        setRestore(null);
        if (d) {
            setTpl(d.template); setLayout(d.layout); setName(d.name || ''); setTypedMinutes(d.minutes ?? null);
            const t = d.template && d.template !== NONE ? tplQ.data?.find(x => x.id === d.template) : undefined;
            setAuto(d.template === NONE || t ? defaultName(t) : '');
        } else localStorage.removeItem(draftKey);
    };

    // What stops "Tạo đề" and the one sentence that says why.
    const stockKnown = statsQ.isSuccess;
    // Before a sample is chosen the cap line speaks for the first sample, so the teacher sees what the bank can feed.
    const capLayout = chosen ? layout : templates[0]?.layout || layout;
    const over = overflow(capLayout, stock);
    const lack = shortages(capLayout, stock).map(s => ({...s, miss: s.need - s.have, tags: over.filter(o => o.type === s.type).map(o => o.tag)}));
    const problem = frameProblem(layout, name);
    const empty = !capLayout.some(g => g.parts.some(p => p.items.length));
    const runs = capacity(capLayout, stock);
    const blocked = !chosen || !stockKnown || !!problem || lack.length > 0;
    const shortHint = lack.map(l => `Thiếu ${l.miss} ${lower(kindName(l.type))}${l.tags.length ? ` ở ${l.tags.join(', ')}` : ''}. Bớt ${l.miss} ${kindUnit(l.type)} hoặc nhập thêm đề.`).join(' ');
    const hint: {text: ReactNode; bad: boolean} = !chosen ? {text: 'Chọn một đề mẫu để xem đề.', bad: false}
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
            made = await save.mutateAsync({banks: [bank.id], name: name.trim(), duration: minutes, folder: folder || undefined, layout: paper ? undefined : toPayload(layout)}) as typeof made;
        } catch (e) {
            return setFormError(errorText(e, 'Lưu đề thất bại, thử lại.'));
        }
        localStorage.removeItem(draftKey);
        // BV2-08: land on Môn & đề › the subject (Nháp filter, "Mới tạo"): the chosen one, else the folder the BE put it in, else the bank's subject.
        const fromBe = typeof made?.folder === 'string' ? made.folder : made?.folder?.id;
        const target = folder || fromBe || (foldersQ.data || []).find(f => !f.parent && !!bank.subject && normalize(f.name) === normalize(bank.subject))?.id;
        if (target) {
            notify.success(`Đã tạo đề nháp trong Môn & đề${subject ? ` › ${subject}` : ''}.`);
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
        : lack.length ? <p className='v3-cap v3-cap--bad' role='status'><icons.IconAlert size={18}/>
        <span>Chưa đủ: thiếu {lack.map((l, i) => <span key={l.type}>{i > 0 && ', '}<b>{l.miss} {lower(kindName(l.type))}</b>{l.tags.length > 0 && ` (${l.tags.join(', ')})`}</span>)}.</span></p>
        : empty || runs === null ? <p className='v3-cap' role='status'><icons.IconCheckCircle size={18} color='var(--vt-muted)'/><span>Đề chưa có câu nào. Thêm đoạn hoặc câu vào {layout[0]?.parts[0]?.title || 'Phần I'}.</span></p>
        : <p className='v3-cap' role='status'><icons.IconCheckCircle size={18} color='var(--vt-ok-icon)'/><span>Ngân hàng đủ để mỗi học sinh làm khoảng <b>{runs} đề</b> không trùng đoạn.</span></p>);

    const shownTemplates = showAll ? templates : templates.slice(0, FIRST_TEMPLATES);
    const tplList = tplQ.isError
        ? <ErrorState title='Không tải được danh sách đề mẫu' description={errorText(tplQ.error, 'Kiểm tra mạng rồi thử lại.')} onRetry={() => tplQ.refetch()} retrying={tplQ.isFetching}/>
        : tplQ.isLoading ? <Loading/> : <ul className='v3-tpls' role='radiogroup' aria-label='Đề mẫu'>
            {shownTemplates.map(t => <li key={t.id}><label>
                <input type='radio' name='tpl' checked={tpl === t.id} onChange={() => choose(t.id)}/>
                <span><b>Giống {tplName(t)}</b><small>{sampleSummary(t)}</small></span></label></li>)}
            {!showAll && templates.length > FIRST_TEMPLATES && <li><Button variant='ghost' size='sm' onClick={() => setShowAll(true)}>Xem thêm {templates.length - FIRST_TEMPLATES} đề mẫu</Button></li>}
            {templates.length > 0 && <li><hr/></li>}
            <li><label>
                <input type='radio' name='tpl' checked={tpl === NONE} onChange={() => choose(NONE)}/>
                <span><b>Không dùng đề mẫu</b><small>Bắt đầu từ tờ đề trống</small></span></label></li>
        </ul>;
    const tplTitle = <h2 className='v3-h2'>Làm đề giống đề nào?</h2>;

    // Phone, sample chosen: bank + sample in one small card; the sheet follows right below.
    const side = paper ? <div className='v3-side'><Card size='md'>{bankField}</Card></div>
        : !wide && chosen ? <Card size='md' className='v3-side v3-side--card'>
            {bankField}
            <Select label='Làm đề giống' value={tpl || ''} onChange={e => choose(e.target.value)}
                    options={[...templates.map(t => ({value: t.id, label: `Giống ${tplName(t)}`})), {value: NONE, label: 'Không dùng đề mẫu'}]}/>
            {capLine}
        </Card>
        : <div className='v3-side'>
            <Card size='md'>{bankField}{capLine}</Card>
            <Card size='md'>{tplTitle}
                {!wide && <p className='v3-muted'>Chọn một đề, đề mới sẽ hiện ngay bên dưới đúng như học sinh thấy.</p>}
                {tplList}
                {tplQ.isSuccess && templates.length === 0 && <p className='v3-muted'>Ngân hàng này chưa có đề mẫu, bắt đầu từ tờ đề trống.</p>}
            </Card>
        </div>;

    const sheet = !chosen ? (wide && <div className='v3-empty'>
            <b>Chọn một đề mẫu ở bên trái</b><span>Đề mới sẽ hiện ở đây đúng như học sinh thấy.</span>
            <div className='v3-steps'>
                <div><i>1. Chọn đề mẫu</i>Đề mới giống hệt về phần, điểm, lời dẫn.</div>
                <div><i>2. Xem đề</i>Câu hỏi được rút ngẫu nhiên cho từng học sinh.</div>
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
    const restoreTpl = restore?.template ? tplQ.data?.find(t => t.id === restore.template) : undefined;

    return <div className='v3-page'>
        <Link to={subjectFolder ? '/subject/' + subjectFolder.id : '/'} className={buttonClass({variant: 'ghost'})}>← Môn & đề{subject ? ` › ${subject}` : ''}</Link>
        <div className='v3-head'>
            <div><PageTitle>Tạo đề từ ngân hàng</PageTitle>
                <p className='v3-muted'>Chọn đề mẫu, xem đề sẽ trông thế nào, bấm Tạo đề. Muốn khác thì sửa ngay trên đề.</p></div>
            {wide && !paper && <div className='v3-headact'>{create()}<span className={cx(hint.bad && 'v3-cap--bad')}>{hint.text}</span></div>}
        </div>
        {visible.length === 0
            ? <EmptyState title='Chưa có ngân hàng nào' description='Tạo ngân hàng ở mục Ngân hàng câu hỏi rồi quay lại.'/>
            : <div className='v3-layout'>{side}{paperCard || sheet}</div>}
        {!wide && !paper && chosen && <>
            <div className='v3-spacer'/>
            <Card className='vt-imp-bar v3-bar' role='region' aria-label='Tạo đề'>{create()}</Card>
        </>}

        <ConfirmDialog open={!!ask} title='Bỏ các chỗ đã sửa?' cancelLabel='Giữ lại' confirmLabel='Bỏ và đổi'
                       message='Đề đang soạn có chỗ bạn đã sửa. Đổi đề mẫu hoặc ngân hàng thì các chỗ đó mất.'
                       onCancel={() => setAsk(null)} onConfirm={() => { const go = ask; setAsk(null); go?.(); }}/>
        {/* Esc / outside click = just close: the draft stays and we ask again next time. Only "Bỏ, làm lại từ đầu" deletes it. */}
        <Modal open={!!restore} onClose={() => setRestore(null)} title='Tiếp tục khung đang soạn dở?'
               footer={<>
                   <Button variant='secondary' onClick={() => startDraft(null)}>Bỏ, làm lại từ đầu</Button>
                   <Button variant='primary' onClick={() => startDraft(restore)}>Tiếp tục soạn</Button>
               </>}>
            {restore && <>
                <p>{restore.name ? `“${restore.name}”, ` : ''}{restoreTpl ? `chép từ ${tplName(restoreTpl)}` : 'dựng từ trống'}{bank ? `, ${bankName(bank)}` : ''}.</p>
                <p className='v3-muted'>Tự lưu lúc {hhmm(restore.savedAt)} {sameDay(restore.savedAt) ? 'hôm nay' : `ngày ${new Date(restore.savedAt).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}`} trên trình duyệt này.</p>
            </>}
        </Modal>
    </div>;
}
