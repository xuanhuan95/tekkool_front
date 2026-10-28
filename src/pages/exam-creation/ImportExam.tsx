import {useEffect, useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import {Editor} from '../../components/Editor';
import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, MetaChips, Modal, PageTitle, ProgressBar, Select, Table, TextField, buttonClass, cx, notify}
    from '../../components/ui';
import type {Column} from '../../components/ui';
import {uploadImages} from './imageUpload';
import type {ImageCache} from './imageUpload';
import {useFolders} from '../../queries/exams';
import {bankKeys, useBankStock, useBanks} from '../../queries/questionBank';
import Api from '../../services/api';
import {errorText, formatDecimal} from '../../lib/format';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {blockLabel} from './blockTypes';
import {
    badTrueFalse, countQuestions, examStats, fileProblem, importErrorText, isBadTrueFalse, isChoice, isMissingKey, missingKeys,
    patchData, patchQuestion, removeQuestions, saveBlocker, setAnswer, setPassage, setType, toUnits, TRUE_FALSE_STATEMENTS,
    type DuplicateInfo, type ImportedExam, type NumberedUnit, type QuestionUnit,
} from './importRules';
import {withDefaultScores} from './examRules';
import './import-exam.css';

// The parser can only guess pick-one / free answer (has A.B.C.D. or not); the rest the teacher picks.
const QUESTION_TYPES = [
    {value: 'MultipleChoice', label: 'Trắc nghiệm'},
    {value: 'TrueFalse', label: 'Đúng/Sai'},
    {value: 'FillBlank', label: 'Trả lời ngắn'},
    {value: 'FreeAnswer', label: 'Tự luận'},
];

type Edit = (fn: (e: ImportedExam) => ImportedExam) => void;

type PdfState = {status: 'idle' | 'loading' | 'ready' | 'none'; url?: string};

/**
 * Right column: the Word file itself as a PDF (SPT-70, LibreOffice on the BE — not the parser's text), so a teacher
 * sees exactly what the file looks like next to what was recognised. 503 / any failure → no source, the rest still works.
 */
function SourcePdf({pdf}: {pdf: PdfState}) {
    if (pdf.status === 'loading') return <div className='vt-src-empty' aria-live='polite'>
        <ProgressBar value={1} max={3} label='Đang dựng bản gốc'/>
        <p>Đang dựng bản gốc từ file Word… file nhiều đề có thể mất khoảng 15 giây.</p>
    </div>;
    if (pdf.status === 'ready' && pdf.url) return <iframe className='vt-src-pdf' src={pdf.url} title='Bản gốc của file Word'/>;
    return <div className='vt-src-empty'>Không có bản gốc cho file này.</div>;
}

/** Duplicate rate: never red — a warning to read, not an error to fix (same-template questions measure 80–90%). */
function DuplicateChip({info}: {info?: DuplicateInfo}) {
    if (!info) return null;
    const matches = info.khop.map(k => (k.trong_file ? 'trong file này' : (k.khoi || k.id)) + ' — ' + formatDecimal(k.score * 100) + '%').join('\n');
    return <span className={cx('vt-imp-dup', info.score >= 0.95 ? 'high' : info.score >= 0.8 && 'mid')} title={'Trùng với:\n' + matches}>
        Tỷ lệ trùng: {formatDecimal(info.score * 100)}%
    </span>;
}

type UnitCardProps = {
    unit: QuestionUnit; no: number; edit: Edit; showPassage: boolean;
    duplicates: Record<string, DuplicateInfo>;
};

function UnitCard({unit, no, edit, showPassage, duplicates}: UnitCardProps) {
    const first = unit.questions[0];
    const ids = unit.questions.map(q => q.id);
    const isTf = first.type === 'TrueFalse';
    const noKey = isMissingKey(unit);
    const badTf = isBadTrueFalse(unit);
    const dup = unit.questions.map(q => duplicates[q.id]).filter(Boolean).sort((a, b) => b.score - a.score)[0];

    return <div id={'imp-' + first.id} className={cx('vt-imp-q', noKey && 'bad-key', badTf && 'bad-tf')}>
        {showPassage && first.data.passage !== undefined && <div className='vt-imp-passage'>
            <div className='vt-imp-passage-label'>
                {isTf ? 'Đề dẫn chung của 4 ý' : 'Ngữ liệu dùng chung — sửa ở đây áp dụng cho cả nhóm câu'}
            </div>
            <Editor text={first.data.passage} onChange={html => edit(e => setPassage(e, first.data.passageId, html))}/>
        </div>}

        <div className='vt-imp-q-head'>
            <b>Câu {no}</b>
            <Select label='Loại câu' className='vt-imp-q-type' value={first.type}
                    onChange={ev => edit(e => setType(e, ids, ev.target.value))}
                    options={QUESTION_TYPES}/>
            {noKey && <span className='vt-imp-flag err'>Chưa có đáp án đúng — chọn một phương án</span>}
            {badTf && <span className='vt-imp-flag warn'>
                {unit.questions.length} ý — cần đủ {TRUE_FALSE_STATEMENTS} ý để chấm theo SPT
            </span>}
            <DuplicateChip info={dup}/>
            <Button variant='ghost' size='sm' className='vt-imp-remove' aria-label={'Xoá câu ' + no}
                    onClick={() => edit(e => removeQuestions(e, ids))}>Xoá</Button>
        </div>

        {isTf
            ? unit.questions.map((q, i) => <div key={q.id} className='vt-imp-answer'>
                <span className='vt-imp-answer-key'>{String.fromCharCode(97 + i)})</span>
                <div className='vt-imp-answer-body'>
                    <Editor text={q.data.question} disableReturn disableStyle
                            onChange={html => edit(e => patchData(e, q.id, {question: html}))}/>
                </div>
                <Badge tone={q.data.answer === true ? 'ok' : q.data.answer === false ? 'err' : 'draft'}>
                    {q.data.answer === true ? 'Đúng' : q.data.answer === false ? 'Sai' : 'Chưa có đáp án'}
                </Badge>
            </div>)
            : <>
                <Editor text={first.data.question} onChange={html => edit(e => patchData(e, first.id, {question: html}))}/>

                {!isChoice(first) && <TextField label='Số từ gợi ý (0 = không ghi)' type='number' min={0} className='vt-imp-words'
                    value={first.data.max_words || 0}
                    onChange={ev => edit(e => patchQuestion(e, first.id, q => {
                        const {max_words: _drop, ...rest} = q.data;
                        const words = parseInt(ev.target.value, 10) || 0;
                        // 0 = no limit → drop the field, don't write junk into the DB
                        return {...q, data: words ? {...rest, max_words: words} : rest};
                    }))}/>}

                {/* ponytail: radios take their name from the question id — one shared name would make
                    a whole 20-exam screen one radio group (picking Q2's answer would unpick Q1's). */}
                {isChoice(first) && (first.data.answers || []).map((a, i) => {
                    const on = first.data.correctAnswerId === a.id;
                    return <div key={a.id} className={cx('vt-imp-answer', on && 'on')}>
                        <input type='radio' name={'ans-' + first.id} checked={on}
                               aria-label={`Đáp án đúng của câu ${no}: ${String.fromCharCode(65 + i)}`}
                               onChange={() => edit(e => patchData(e, first.id, {correctAnswerId: a.id}))}/>
                        <span className='vt-imp-answer-key'>{String.fromCharCode(65 + i)}.</span>
                        <div className='vt-imp-answer-body'>
                            <Editor text={a.value} disableReturn disableStyle
                                    onChange={html => edit(e => setAnswer(e, first.id, a.id, html))}/>
                        </div>
                    </div>;
                })}
            </>}

        {first.data.explanation && <details className='vt-imp-explain'>
            <summary>Lời giải (học sinh thấy sau khi nộp bài)</summary>
            <div>{renderHTML(first.data.explanation)}</div>
        </details>}
    </div>;
}

function ExamBody({exam, edit, duplicates, pdf}: {exam: ImportedExam; edit: Edit; duplicates: Record<string, DuplicateInfo>; pdf: PdfState}) {
    let no = 0;
    return <div className='vt-imp-split'>
        <div className='vt-imp-col'>
            <div className='vt-imp-col-head'>Đã nhận diện — sửa trực tiếp</div>
            {exam.sections.map(s => <div key={s.id} className='vt-imp-col'>
                <h3 className='vt-imp-section'>{renderHTML(s.name)}</h3>
                {toUnits(s.questions).map((u, i, all) => {
                    const prev = all[i - 1];
                    // The passage is printed once, at the FIRST question of its group (groups are consecutive).
                    const showPassage = !prev || prev.questions[0].data.passageId !== u.questions[0].data.passageId
                        || !u.questions[0].data.passageId;
                    return <UnitCard key={u.id} unit={u} no={++no} edit={edit} showPassage={showPassage}
                                     duplicates={duplicates}/>;
                })}
            </div>)}
        </div>
        <div className='vt-imp-col vt-imp-source'>
            <div className='vt-imp-col-head'>Văn bản gốc trong file Word</div>
            {pdf.status !== 'idle' && <SourcePdf pdf={pdf}/>}
        </div>
    </div>;
}

function ExamInfoModal({exam, onClose, onJump}: {exam: ImportedExam | undefined; onClose: () => void; onJump: (x: NumberedUnit) => void}) {
    const stats = exam ? examStats(exam) : null;
    type Row = [string, NumberedUnit[]];
    const columns: Column<Row>[] = [
        {key: 'label', header: 'Thông tin', render: r => r[0]},
        {key: 'n', header: 'Số lượng', align: 'center', render: r => r[1].length},
        {key: 'list', header: 'Danh sách các câu', render: r => r[1].map(x =>
            <button key={x.unit.id} type='button' className='vt-imp-jump' onClick={() => onJump(x)}>Câu {x.no}</button>)},
    ];
    return <Modal open={!!exam} onClose={onClose} title='Thông tin đề' size='md'
                  footer={<Button variant='secondary' onClick={onClose}>Đóng</Button>}>
        {stats && <>
            <p>Tổng số câu trong đề: <b>{stats.total} câu</b></p>
            <Table<Row> className='vt-imp-info' caption='Thông tin đề' columns={columns} rows={stats.rows} rowKey={r => r[0]} bare/>
        </>}
    </Modal>;
}

export default function ImportExam() {
    const [params] = useSearchParams();
    const bankId = params.get('bank');
    const [pickedFolder, setPickedFolder] = useState('');
    // Direct import (no bank): the subject comes from ?folder= or from the picker, and is required.
    const folderId = params.get('folder') || pickedFolder || null;
    const navigate = useNavigate();
    const qc = useQueryClient();

    const {data: banks} = useBanks();
    const {data: folders} = useFolders(!bankId);
    const stock = useBankStock(bankId).data;
    const bankInfo = bankId ? banks?.find(b => b.id === bankId) : undefined;
    const folder = folderId ? folders?.find(f => f.id === folderId) : undefined;

    const fileRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    const [reading, setReading] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [exams, setExams] = useState<ImportedExam[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [picked, setPicked] = useState<Record<string, boolean>>({});
    // ponytail: ONE exam open at a time — each edit box is a TipTap view; 20 exams x 60 boxes would choke the browser.
    const [openId, setOpenId] = useState<string | null>(null);
    const [infoId, setInfoId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duplicates, setDuplicates] = useState<Record<string, DuplicateInfo>>({});
    const [checking, setChecking] = useState(false);
    // images already uploaded (data URI → path): a retry after a dropped connection skips them
    const images = useRef<ImageCache>(new Map());
    const desktop = useMediaQuery(DESKTOP);
    const [pdf, setPdf] = useState<PdfState>({status: 'idle'});
    // One object URL at a time: revoked when the file changes and when the screen closes.
    const pdfUrl = useRef<string>();
    const dropPdf = () => { if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); pdfUrl.current = undefined; };
    const seq = useRef(0);   // a PDF that arrives after another file was picked (or the screen closed) is ignored
    useEffect(() => () => { seq.current++; dropPdf(); }, []);

    const chosen = exams.filter(e => picked[e.id]);
    // Q15: imported exams are saved as Nháp even with errors — only the bank path (?bank=) keeps its block.
    const problems = saveBlocker(chosen);
    const blocker = bankId ? problems : null;
    const busy = saving || reading;

    const upload = async ({target}: ChangeEvent<HTMLInputElement>) => {
        const file = target.files && target.files[0];
        if (!file) return;
        setFileName(file.name);
        setExams([]); setWarnings([]); setDuplicates({});
        const bad = fileProblem(file);
        if (bad) { setProblem(bad); target.value = ''; return; }
        setProblem(null); setReading(true);
        dropPdf();
        setPdf({status: desktop ? 'loading' : 'idle'});
        // In parallel with the parse (the exams do not wait for it). Phones neither call it nor show the pane.
        const mine = ++seq.current;
        if (desktop) Api.uploadBlob('import_docx/pdf', file).then(blob => {
            if (mine !== seq.current) return;
            pdfUrl.current = URL.createObjectURL(blob);
            setPdf({status: 'ready', url: pdfUrl.current});
        }, () => { if (mine === seq.current) setPdf({status: 'none'}); });
        try {
            const res = await Api.upload<{exams: ImportedExam[]; warnings?: string[]}>('import_docx/preview', file);
            // Tick ALL by default: untick a few beats re-picking 20.
            setPicked(Object.fromEntries(res.exams.map(e => [e.id, true])));
            setOpenId(res.exams.length ? res.exams[0].id : null);
            setExams(res.exams);
            setWarnings(res.warnings || []);
        } catch (e) {
            setProblem(importErrorText(errorText(e, 'không rõ nguyên nhân')));
        } finally {
            target.value = '';   // allow picking the very same file again
            setReading(false);
        }
    };

    const patchExam = (id: string): Edit => fn => setExams(es => es.map(e => e.id === id ? fn(e) : e));

    const toggleAll = () => {
        const all = exams.every(e => picked[e.id]);
        setPicked(Object.fromEntries(exams.map(e => [e.id, !all])));
    };

    const jumpTo = (examId: string, x: NumberedUnit) => {
        setInfoId(null); setOpenId(examId);
        setTimeout(() => {
            const el = document.getElementById('imp-' + x.unit.id);
            if (!el) return;
            el.scrollIntoView({behavior: 'smooth', block: 'center'});
            el.classList.add('flash');
            setTimeout(() => el.classList.remove('flash'), 1200);
        }, 0);
    };

    // Optional: an empty bank measures 0 anyway. Numbers only, never blocks saving.
    const checkDuplicates = async () => {
        setChecking(true);
        try {
            const merged: Record<string, DuplicateInfo> = {};
            for (const e of chosen) {
                const r = await Api.post<{trung?: Record<string, DuplicateInfo>}>('question_bank/check_trung', {...await uploadImages(e, images.current), bank: bankId});
                Object.assign(merged, r.trung || {});
            }
            setDuplicates(merged);
        } catch (e) {
            notify.error('Không đo được trùng lặp (' + errorText(e, 'lỗi không rõ') + '). Vẫn lưu được bình thường.');
        } finally {
            setChecking(false);
        }
    };

    // toBank: cut into blocks and put them in the bank; the exam is drawn from it when a student starts.
    const save = async (toBank: boolean) => {
        if (!chosen.length || blocker) return;
        setSaving(true); setProgress(0);
        let added = 0;
        let done = 0;
        try {
            // ponytail: sequential on purpose — 20 exams x 12 questions in parallel chokes a 2-core server.
            for (const source of chosen) {
                // base64 images → image/upload first, so the exam sent is text only (nginx caps the body at 2MB)
                const e = await uploadImages(source, images.current);
                if (toBank) {
                    const r = await Api.post<{saved: number}>('question_bank/save', {...e, bank: bankId});
                    added += r.saved;
                } else {
                    await Api.post('exam/create', {...e, sections: withDefaultScores(e.sections as never, folder?.name) });
                    // exam/create takes no folder → the existing move_to_folder.
                    if (folderId) await Api.post('exam/move_to_folder', {examId: e.id, folderId});
                }
                setProgress(++done);
            }
            if (toBank) {
                notify.success(`Đã thêm ${added} khối vào ngân hàng. Số liệu sức chứa ở trên đã cập nhật.`);
            } else if (folderId) {
                qc.invalidateQueries({queryKey: ['exam']});
                notify.success(`Đã tạo ${done} đề nháp. Sửa cho hết lỗi rồi bấm Xuất bản để học sinh thấy.`);
                navigate('/subject/' + folderId);
            } else {
                qc.invalidateQueries({queryKey: ['exam']});
                notify.success(`Đã tạo ${done} đề nháp. Vào Môn & đề để chọn môn và xuất bản.`);
                navigate('/');
            }
        } catch (err) {
            // keep what is already saved; the teacher sees which exam stopped it
            notify.error('Lưu thất bại: ' + chosen[done].name, errorText(err, 'Thử lại sau.'));
        } finally {
            if (toBank) qc.invalidateQueries({queryKey: bankKeys.all});
            setSaving(false);
        }
    };

    const per = stock?.per_type || {};
    const slots = stock?.slots || {};
    const total = Object.values(per).reduce((a, n) => a + n, 0);
    const drawable = stock?.capacity || 0;

    const pickFile = () => fileRef.current?.click();
    const context = bankId
        ? <>Lưu vào ngân hàng <b>{bankInfo?.name || '…'}</b></>
        : folderId ? <>Tạo trong môn <b>{folder?.name || '…'}</b></> : null;
    const direct = (label: string) => `${label} ${chosen.length} đề`;

    return <div className='vt-imp'>
        <input type='file' accept='.docx' ref={fileRef} onChange={upload} hidden/>

        <div className='vt-imp-head'>
            <div>
                <PageTitle>Nhập đề từ file Word</PageTitle>
                {context && <MetaChips items={[context]}/>}
            </div>
            {(exams.length > 0 || problem) &&
                <Button variant='secondary' disabled={busy} onClick={pickFile}>Chọn file khác</Button>}
        </div>

        {!exams.length && !reading && !problem && <Card className='vt-imp-drop'>
            <h2>Chưa chọn file</h2>
            <p>File .docx, tối đa 10 MB. Một file có thể chứa nhiều đề.</p>
            <Button variant='primary' onClick={pickFile}>Chọn file .docx</Button>
        </Card>}

        {reading && <Card className='vt-imp-drop' aria-live='polite'>
            <h2>Đang đọc file {fileName}…</h2>
            <ProgressBar value={1} max={3} label='Đang đọc file'/>
        </Card>}

        {problem && <Card className='vt-imp-drop vt-imp-error' role='alert'>
            <p>{problem}</p>
            <Button variant='secondary' onClick={pickFile}>Chọn file khác</Button>
        </Card>}

        {stock && total > 0 && <Card className='vt-imp-bank'>
            <div className='vt-imp-bank-head'>
                <div>
                    <b>{bankInfo ? bankInfo.name : 'Ngân hàng câu hỏi'}: {total} khối</b>
                    <p>{drawable > 0
                        ? <>Đủ rút {drawable} đề không trùng khối{stock.bottleneck && <> · nghẽn ở <b>{blockLabel(stock.bottleneck[0])}</b></>}</>
                        : 'Chưa đủ khối để rút một đề hoàn chỉnh — nhập thêm đề bên dưới.'}</p>
                </div>
                {drawable > 0
                    ? <Link to={'/draw-exam/bank/' + bankId} className={buttonClass({variant: 'secondary'})}>Rút thử một đề</Link>
                    : <Button variant='secondary' disabled>Rút thử một đề</Button>}
            </div>
            <div className='vt-imp-chips'>
                {Object.keys(slots).map(t => {
                    const have = per[t] || 0, drawn = Math.floor(have / slots[t]);
                    return <Badge key={t} tone={drawn < 1 ? 'err' : drawn < 4 ? 'sun' : 'ok'}>
                        {blockLabel(t)}: {have} khối · rút được {drawn}
                    </Badge>;
                })}
            </div>
        </Card>}

        {warnings.length > 0 && <div className='vt-imp-notice' role='status'>
            <b>Cần kiểm tra lại {warnings.length} chỗ</b>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>}

        {exams.length > 0 && <Card>
            <div className='vt-imp-listhead'>
                <label className='vt-imp-check'>
                    <input type='checkbox' checked={chosen.length === exams.length}
                           ref={el => { if (el) el.indeterminate = chosen.length > 0 && chosen.length < exams.length; }}
                           onChange={toggleAll}/>
                    Đọc được {exams.length} đề — đã chọn {chosen.length}
                </label>
            </div>

            {exams.map(exam => {
                const open = openId === exam.id;
                const missing = missingKeys(exam);
                const wrongTf = badTrueFalse(exam);
                const dupCount = exam.sections.reduce((n, s) => n + toUnits(s.questions)
                    .filter(u => u.questions.some(q => duplicates[q.id])).length, 0);
                return <div key={exam.id} className='vt-imp-exam'>
                    <div className='vt-imp-exam-row'>
                        <input type='checkbox' className='vt-imp-check' checked={!!picked[exam.id]}
                               aria-label={'Chọn ' + exam.name}
                               onChange={() => setPicked(p => ({...p, [exam.id]: !p[exam.id]}))}/>
                        <TextField label='Tên đề' className='vt-imp-exam-name' value={exam.name}
                                   onChange={ev => patchExam(exam.id)(e => ({...e, name: ev.target.value}))}/>
                        <TextField label='Phút' type='number' min={0} className='vt-imp-exam-min'
                                   value={exam.duration === undefined ? 45 : exam.duration}
                                   onChange={ev => patchExam(exam.id)(e => ({...e, duration: parseInt(ev.target.value, 10) || 0}))}/>
                        <span className='vt-imp-exam-meta'>
                            {countQuestions(exam)} câu
                            {missing > 0 && <Badge tone='err'>{missing} câu thiếu đáp án</Badge>}
                            {wrongTf > 0 && <Badge tone='sun'>{wrongTf} câu Đúng/Sai chưa đủ 4 ý</Badge>}
                            {/* a collapsed exam hides its chips — count them here to know which to open */}
                            {dupCount > 0 && <Badge tone='sun'>{dupCount} câu trùng</Badge>}
                        </span>
                        <Button variant='ghost' size='sm' onClick={() => setInfoId(exam.id)}>Thông tin đề</Button>
                        <Button variant='secondary' size='sm' aria-expanded={open}
                                onClick={() => setOpenId(open ? null : exam.id)}>{open ? 'Thu gọn' : 'Xem & sửa'}</Button>
                    </div>
                    {open && <ExamBody exam={exam} edit={patchExam(exam.id)} duplicates={duplicates} pdf={pdf}/>}
                </div>;
            })}
        </Card>}

        {exams.length > 0 && <Card className='vt-imp-bar' role='region' aria-label='Lưu đề'>
            {bankId
                ? <>
                    <Button variant='primary' loading={saving} loadingText={`Đang lưu ${progress + 1}/${chosen.length}…`}
                            disabled={!chosen.length || !!blocker || checking} onClick={() => save(true)}>
                        {direct('Lưu')} vào ngân hàng
                    </Button>
                    <Button variant='secondary' disabled={!chosen.length || !!blocker || busy} onClick={() => save(false)}>
                        {direct('Tạo thẳng')}
                    </Button>
                    <Button variant='secondary' loading={checking} disabled={!chosen.length || busy} onClick={checkDuplicates}>
                        Kiểm tra trùng lặp
                    </Button>
                </>
                : <Button variant='primary' loading={saving} loadingText={`Đang lưu ${progress + 1}/${chosen.length}…`}
                          disabled={!chosen.length || !!blocker || !folderId} onClick={() => save(false)}>
                    {`Tạo ${chosen.length} đề nháp`}
                </Button>}
            {!bankId && !params.get('folder') &&
                <Select label='Môn học' value={pickedFolder} onChange={ev => setPickedFolder(ev.target.value)}
                        placeholder='Chọn môn' options={(folders || []).filter(f => !f.parent && !f.hidden).map(f => ({value: f.id, label: f.name}))}/>}
            <span className={cx('vt-imp-bar-hint', blocker && 'err')} role={blocker ? 'alert' : undefined}>
                {blocker
                    ? blocker + ' — sửa ngay trong đề, hoặc sửa file Word rồi nhập lại.'
                    : problems && !bankId
                        ? problems + ' — vẫn tạo được đề nháp; phải sửa xong mới xuất bản được.'
                    : saving ? 'Lưu lần lượt từng đề, đừng đóng trang.'
                    : !bankId && !folderId
                        ? <>Chọn môn học để tạo đề. Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</>
                    : Object.keys(duplicates).length
                        ? `Có ${Object.keys(duplicates).length} câu trùng với ngân hàng — xem chip trên từng câu rồi tự quyết.`
                    : bankId ? 'Vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.' : ''}
            </span>
        </Card>}

        <ExamInfoModal exam={exams.find(e => e.id === infoId)} onClose={() => setInfoId(null)}
                       onJump={x => infoId && jumpTo(infoId, x)}/>
    </div>;
}
