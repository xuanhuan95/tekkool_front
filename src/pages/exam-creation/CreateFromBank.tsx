import {useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';

import {Badge, Button, Card, CardTitle, EmptyState, ErrorState, MetaChips, Modal, PageTitle, TextField, buttonClass, cx, notify, Loading} from '../../components/ui';
import {errorText, formatDecimal} from '../../lib/format';
import {useBankCapacity, useBankStats, useBankTemplates, useBanks, useCreateFromBank, usePreviewLayout} from '../../queries/questionBank';
import type {BankTemplate} from '../../queries/questionBank';
import {bankCount} from '../question-bank/BankList';
import {useFolders} from '../../queries/exams';
import {blockLabel} from './blockTypes';
import LayoutEditor from './LayoutEditor';
import LayoutPreview from './LayoutPreview';
import {emptyLayout, frameProblem, needs, shortages, toPayload} from './layoutRules';
import type {Layout} from './layoutRules';
import './create-from-bank.css';

// Compare folder name with the bank's subject, ignoring accents and case: folder "Văn" still matches "Ngữ văn".
const normalize = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** SPT default (design §3.3): Toán and Ngữ văn 90 minutes, other subjects 60. */
export const suggestedMinutes = (subject?: string) =>
    !subject || ['toan', 'ngu van'].includes(normalize(subject)) ? 90 : 60;

/** A template from the BE may omit optional fields; the editor wants all of them. */
const fromTemplate = (t: BankTemplate): Layout => (t.layout || []).map(g => ({
    title: g.title || '',
    parts: (g.parts || []).map(p => ({
        title: (p.title || '').replace(/\s*\(\s*[\d.,]+\s*điểm\s*\)\s*$/i, ''), lead: p.lead || '', description: p.description || null, score: p.score ?? null,
        numbering: p.numbering === 'restart' ? 'restart' as const : 'continue' as const,
        items: (p.items || []).map(i => ({title: i.title || '', block_type: i.block_type, count: i.count || 1})),
    })),
}));

type Draft = {name: string; layout: Layout; savedAt: number; template: string | null};
const STEPS = ['Ngân hàng & đề mẫu', 'Khung đề', 'Xem trước & lưu'];
const FIRST_TEMPLATES = 6;
const bankName = (b: {name: string; kind?: string}) => `${b.name} — ${b.kind === 'paper' ? 'nguyên đề' : 'theo khối'}`;
/** "2 nhóm · 3 phần · 4 khối · 10 điểm": what copying this sample gives (points only when every phần has one). */
const frameSummary = (t: BankTemplate) => {
    const parts = t.layout.flatMap(g => g.parts);
    const pts = parts.every(p => p.score != null) ? parts.reduce((n, p) => n + (p.score || 0), 0) : null;
    return [`${t.layout.length} nhóm`, `${parts.length} phần`, `${t.block_count} khối`, pts != null && `${formatDecimal(pts)} điểm`].filter(Boolean).join(' · ');
};
const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});

/**
 * The teacher builds the exam frame (Nhóm → Phần → Tiểu mục) in 3 steps and saves it. The saved exam has no questions:
 * on each attempt the BE draws the blocks the frame asks for, avoiding blocks the student has seen, and renumbers
 * the questions (`{from}`/`{to}`). A whole-exam bank needs no frame: name + minutes, save.
 */
export default function CreateFromBank() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const folder = params.get('folder') || '';
    const bankParam = params.get('bank') || '';

    const banksQ = useBanks();
    const foldersQ = useFolders();
    const save = useCreateFromBank();
    const banks = banksQ.data;

    const [step, setStep] = useState(0);
    const [bankId, setBankId] = useState(bankParam);
    const [templateId, setTemplateId] = useState<string | null>(params.get('template')); // null = no sample exam
    const wantedStep = useRef(Math.min(2, Number(params.get('step')) || 0));   // F5: where the page was (BV2-10)
    const landing = useRef(1);
    const [query, setQuery] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [layout, setLayout] = useState<Layout>(emptyLayout);
    const [name, setName] = useState('');
    const [typedMinutes, setTypedMinutes] = useState<number | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [restore, setRestore] = useState<Draft | null>(null);

    const bank = banks?.find(b => b.id === bankId);
    const paper = bank?.kind === 'paper';
    const folderName = (foldersQ.data || []).find(f => f.id === folder)?.name;
    const visible = useMemo(() => !banks ? [] : !folderName ? banks : banks.filter(b => !b.subject
        || normalize(b.subject).includes(normalize(folderName)) || normalize(folderName).includes(normalize(b.subject))), [banks, folderName]);

    const tplQ = useBankTemplates(bank && !paper ? bank.id : '');
    const statsQ = useBankStats(bank && !paper ? bank.id : '');
    const stock = statsQ.data?.per_type || {};
    const want = needs(layout);
    const capQ = useBankCapacity(bank && !paper && Object.keys(want).length ? [bank.id] : [], want);
    const minutes = typedMinutes ?? suggestedMinutes(bank?.subject);
    const drawQ = usePreviewLayout(bankId, layout, step === 2 && !paper);
    const problem = frameProblem(layout, name);
    const lacking = shortages(layout, stock);
    const template = tplQ.data?.find(t => t.id === templateId);

    // Draft of the frame in the browser: F5 or a closed tab does not lose it. Keyed by bank + folder.
    const draftKey = `spt-cfb-draft:${bankId}:${folder}`;
    useEffect(() => {
        if (step === 0 || paper || !bankId) return;
        const t = window.setTimeout(() => {
            try {
                const at = Date.now();
                localStorage.setItem(draftKey, JSON.stringify({name, layout, savedAt: at, template: templateId} satisfies Draft));
                setSavedAt(at);
            } catch { /* storage full or blocked: the draft is only a convenience */ }
        }, 600);
        return () => window.clearTimeout(t);
    }, [step, paper, bankId, draftKey, name, layout, templateId]);

    const readDraft = (): Draft | null => {
        try {
            const raw = localStorage.getItem(draftKey);
            const d = raw ? JSON.parse(raw) as Draft : null;
            return d && Array.isArray(d.layout) && d.layout.length ? d : null;
        } catch { return null; }
    };
    const start = (d: Draft | null) => {
        setRestore(null);
        if (d) { setLayout(d.layout); setName(d.name || ''); setTemplateId(d.template); setSavedAt(d.savedAt); }
        else {
            localStorage.removeItem(draftKey);
            setLayout(template ? fromTemplate(template) : emptyLayout());
            setSavedAt(null);
        }
        setFormError(null);
        setStep(landing.current);
        landing.current = 1;
    };
    const next = () => {
        if (!bank) return;
        if (paper) return;
        const d = readDraft();
        if (d) setRestore(d); else start(null);
    };

    // F5 on step 2/3: bank, sample exam and step live in the URL; the frame itself comes back from the browser draft (or the sample).
    useEffect(() => {
        if (wantedStep.current < 1 || !bank || paper || tplQ.isLoading) return;
        landing.current = wantedStep.current;
        wantedStep.current = 0;
        next();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bank, paper, tplQ.isLoading]);
    useEffect(() => {
        if (wantedStep.current > 0) return;   // still resuming: keep the URL as it came
        setParams(p => {
            const q = new URLSearchParams(p);
            if (bankId) q.set('bank', bankId); else q.delete('bank');
            if (templateId) q.set('template', templateId); else q.delete('template');
            if (step > 0) q.set('step', String(step)); else q.delete('step');
            return q.toString() === p.toString() ? p : q;
        }, {replace: true});
    }, [step, bankId, templateId, setParams]);

    const submit = async () => {
        setFormError(null);
        if (!bank) return setFormError('Chưa chọn ngân hàng đề.');
        if (!name.trim()) return setFormError('Chưa đặt tên đề.');
        if (!paper && (problem || lacking.length)) return setFormError(problem || 'Ngân hàng chưa đủ khối cho khung này.');
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
        if (target) navigate('/subject/' + target, {state: {created: made?.id ? [made.id] : []}});
        else {
            notify.success("Đã tạo đề. Đề đang ở 'Đề ngoài thư mục' — chọn môn để học sinh thấy.");
            navigate('/question-bank');
        }
    };

    const templates = (tplQ.data || []).filter(t => normalize(t.name).includes(normalize(query)));
    const shown = showAll || query ? templates : templates.slice(0, FIRST_TEMPLATES);
    const runs = capQ.data && Object.keys(want).length ? capQ.data.capacity : null;

    const pickBank = (id: string) => { setBankId(id); setTemplateId(null); setQuery(''); setShowAll(false); setFormError(null); };

    const chooseStep = <>
        <Card>
            <CardTitle>1. Chọn một ngân hàng</CardTitle>
            {folderName && <p className='vt-cfb-hint'>Chỉ ngân hàng môn {folderName}. Đề rút từ đúng một ngân hàng.</p>}
            {visible.length === 0
                ? <EmptyState title='Chưa có ngân hàng nào' description='Tạo ngân hàng ở mục Ngân hàng câu hỏi rồi quay lại.'/>
                : <div className='vt-cfb-banks' role='radiogroup' aria-label='Ngân hàng đề'>
                    {visible.map(b => <label key={b.id} className={cx('vt-cfb-bank', b.id === bankId && 'on')}>
                        <input type='radio' name='bank' checked={b.id === bankId} onChange={() => pickBank(b.id)}/>
                        <span><b>{bankName(b)}</b><br/>
                            <small>{b.kind === 'paper'
                                ? `Nguyên đề · ${bankCount(b)} đề. Mỗi lượt rút nguyên một đề, không cần dựng khung.`
                                : `Theo khối · ${bankCount(b)} khối. Mỗi khối trong khung rút ngẫu nhiên một khối cùng dạng.`}</small></span>
                    </label>)}
                </div>}
        </Card>

        {bank && !paper && <Card>
            <CardTitle>2. Chọn đề mẫu</CardTitle>
            <p className='vt-cfb-hint'>Hệ thống chép khung của đề mẫu: tiêu đề nhóm, phần, điểm, lời dẫn, tiểu mục và dạng khối. Câu hỏi không chép: mỗi khối được rút ngẫu nhiên từ ngân hàng.</p>
            {tplQ.isError
                ? <ErrorState title='Không tải được danh sách đề mẫu' description={errorText(tplQ.error, 'Kiểm tra mạng rồi thử lại.')}
                              onRetry={() => tplQ.refetch()} retrying={tplQ.isFetching}/>
                : tplQ.isLoading ? <Loading/> : <>
                    {(tplQ.data || []).length > FIRST_TEMPLATES && <TextField label='Tìm đề mẫu' placeholder='Tên đề, ví dụ “Đề số 3”' value={query} onChange={e => setQuery(e.target.value)}/>}
                    <div className='vt-cfb-banks' role='radiogroup' aria-label='Đề mẫu'>
                        {shown.map(t => <label key={t.id} className={cx('vt-cfb-bank', templateId === t.id && 'on')}>
                            <input type='radio' name='tpl' checked={templateId === t.id} onChange={() => setTemplateId(t.id)}/>
                            <span><b>{t.name}</b><br/><small>{frameSummary(t)}</small></span>
                        </label>)}
                    </div>
                    {!showAll && !query && templates.length > FIRST_TEMPLATES &&
                        <Button variant='ghost' size='sm' onClick={() => setShowAll(true)}>Xem thêm {templates.length - FIRST_TEMPLATES} đề</Button>}
                    {query && templates.length === 0 && <p className='vt-cfb-hint'>Không có đề mẫu nào khớp "{query}".</p>}
                    <div className='vt-cfb-banks' role='radiogroup' aria-label='Không dùng đề mẫu'>
                        <label className={cx('vt-cfb-bank', templateId === null && 'on')}>
                            <input type='radio' name='tpl' checked={templateId === null} onChange={() => setTemplateId(null)}/>
                            <span><b>Không dùng đề mẫu</b><br/><small>Tự dựng khung từ trống: nhóm → phần → tiểu mục, chọn dạng khối và số lượng.</small></span>
                        </label>
                    </div>
                    {(tplQ.data || []).length === 0 && <p className='vt-cfb-hint'>Ngân hàng này chưa có đề mẫu — soạn khung từ đầu.</p>}
                </>}
        </Card>}

        {bank && paper && <Card>
            <CardTitle>Đề nguyên bản</CardTitle>
            <p className='vt-cfb-hint'>Kho có <b>{bankCount(bank)} đề</b>. Mỗi học sinh làm hết {bankCount(bank)} đề mới bị lặp lại đề đã làm. Ngân hàng nguyên đề không dùng khung.</p>
            <div className='vt-cfb-info'>
                <TextField label='Tên đề' value={name} onChange={e => setName(e.target.value)} className='vt-cfb-name'/>
                <TextField label='Thời gian (phút)' type='number' inputMode='numeric' min={0} value={minutes}
                           onChange={e => setTypedMinutes(Math.max(0, Number(e.target.value) || 0))}/>
            </div>
        </Card>}

        <div className='vt-cfb-bar'>
            {formError && <p className='vt-cfb-err' role='alert'>{formError}</p>}
            {bank && !paper && <span className='vt-cfb-hint'>Ngân hàng <b>{bankName(bank)}</b> · {template ? <>đề mẫu <b>{template.name}</b></> : 'không dùng đề mẫu'}</span>}
            {paper
                ? <Button variant='primary' loading={save.isPending} disabled={save.isPending || bankCount(bank!) === 0} onClick={submit}>Lưu đề</Button>
                : <Button variant='primary' disabled={!bank} onClick={next}>{bank ? (template ? `Tiếp: chép khung từ ${template.name}` : 'Tiếp: dựng khung từ trống') : 'Tiếp'}</Button>}
        </div>
    </>;

    const frameStep = <>
        <Card>
            <div className='vt-cfb-info'>
                <TextField label='Tên đề' placeholder='Ví dụ: Đề luyện thi — Ngữ văn' value={name} onChange={e => setName(e.target.value)} className='vt-cfb-name'/>
                <TextField label='Thời gian (phút)' type='number' inputMode='numeric' min={0} value={minutes}
                           onChange={e => setTypedMinutes(Math.max(0, Number(e.target.value) || 0))}/>
            </div>
            <div className='vt-cfb-tpl'>
                <Badge tone='title'>{template ? `Khung chép từ ${template.name}` : 'Khung dựng từ trống'}</Badge>
                <Button variant='ghost' size='sm' onClick={() => setStep(0)}>Đổi đề mẫu</Button>
            </div>
            {savedAt && <p className='vt-cfb-hint'>Đã lưu nháp khung lúc {hhmm(savedAt)} · tải lại trang không mất</p>}
        </Card>
        <p className='vt-cfb-hint'><span className='vt-cfb-num'>10</span> Số câu tự tính lại sau khi rút. Gõ chữ quanh ô thoải mái, ô số giữ nguyên.</p>
        <LayoutEditor layout={layout} onChange={setLayout} stock={stock} bankId={bankId}/>
        <Card size='md' className={cx('vt-cfb-capacity', runs === null ? '' : runs <= 0 || lacking.length ? 'low' : runs < 3 ? 'mid' : 'high')}>
            <CardTitle>Kho có đủ không?</CardTitle>
            {statsQ.isError && <p className='vt-cfb-err' role='alert'>Không tải được kho khối của ngân hàng.</p>}
            {Object.keys(want).length === 0
                ? <p className='vt-cfb-hint'>Chọn dạng khối cho tiểu mục để xem kho có đủ không.</p>
                : <table className='vt-cfb-stock'>
                    <thead><tr><th>Dạng khối</th><th>Kho</th><th>Mỗi đề cần</th></tr></thead>
                    <tbody>{Object.entries(want).map(([t, n]) => <tr key={t} className={(stock[t] || 0) < n ? 'short' : ''}>
                        <th scope='row'>{blockLabel(t)}</th><td>{stock[t] || 0}</td><td>{n}</td></tr>)}</tbody>
                </table>}
            {runs !== null && !lacking.length && <p><b>{runs}</b> lần làm không lặp cho mỗi học sinh.</p>}
            {lacking.length > 0 && <p>Thiếu khối. Bớt khối hoặc <Link to={`/import-exam?bank=${bankId}`}>nhập thêm đề</Link>.</p>}
        </Card>
        <div className='vt-cfb-bar'>
            {(problem || lacking.length > 0) && <p className='vt-cfb-hint' role='status'>{problem || 'Ngân hàng chưa đủ khối cho khung này.'}</p>}
            <Button variant='ghost' onClick={() => setStep(0)}>← Quay lại</Button>
            <Button variant='primary' disabled={!!problem || lacking.length > 0} onClick={() => setStep(2)}>Xem trước</Button>
        </div>
    </>;

    const previewStep = <>
        <LayoutPreview name={name.trim()} minutes={minutes} draw={drawQ}/>
        <div className='vt-cfb-bar'>
            {formError && <p className='vt-cfb-err' role='alert'>{formError}</p>}
            <Button variant='ghost' onClick={() => setStep(1)}>← Sửa khung</Button>
            <Button variant='primary' loading={save.isPending} disabled={save.isPending || !drawQ.data || !!drawQ.data.shortage.length} onClick={submit}>Lưu đề</Button>
        </div>
    </>;

    if (banksQ.isError) return <div className='vt-cfb'><PageTitle>Tạo đề từ ngân hàng</PageTitle>
        <ErrorState title='Không tải được danh sách ngân hàng' description={errorText(banksQ.error, 'Kiểm tra mạng rồi thử lại.')}
                    onRetry={() => banksQ.refetch()} retrying={banksQ.isFetching}/></div>;
    if (!banks) return <div className='vt-cfb'><Loading/></div>;

    return <div className='vt-cfb'>
        {folder
            ? <Link to={'/subject/' + folder} className={buttonClass({variant: 'ghost'})}>← Môn & đề{folderName ? ` › ${folderName}` : ''}</Link>
            : <Link to='/question-bank' className={buttonClass({variant: 'ghost'})}>← Ngân hàng câu hỏi</Link>}
        <PageTitle>Tạo đề từ ngân hàng</PageTitle>
        <MetaChips items={[folderName || bank?.subject ? <>Môn <b>{folderName || bank?.subject}</b></> : null, bank && step > 0 ? bankName(bank) : null]}/>
        {!paper && <ol className='vt-cfb-steps' aria-label='Các bước'>
            {STEPS.map((s, i) => <li key={s} className={cx(i === step && 'on', i < step && 'done')} aria-current={i === step ? 'step' : undefined}>{i + 1} · {s}</li>)}
        </ol>}
        <div className='vt-cfb-body'>{step === 0 ? chooseStep : step === 1 ? frameStep : previewStep}</div>
        {/* Esc / outside click = just close: the draft stays and we ask again next time. Only "Bắt đầu lại" deletes it. */}
        <Modal open={!!restore} onClose={() => setRestore(null)} title='Tiếp tục khung đang soạn dở?'
               footer={<>
                   <Button variant='secondary' onClick={() => start(null)}>Bắt đầu lại</Button>
                   <Button onClick={() => start(restore)}>Tiếp tục</Button>
               </>}>
            <p>{restore ? `Bạn đã soạn dở khung cho ngân hàng này (lưu lúc ${hhmm(restore.savedAt)}). Tiếp tục hay bắt đầu lại?` : ''}</p>
        </Modal>
    </div>;
}
