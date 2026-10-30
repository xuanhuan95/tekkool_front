import {useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import type {ChangeEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import {Editor} from '../../components/Editor';
import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, ConfirmDialog, ErrorState, MetaChips, Modal, PageTitle, Select, Skeleton, Table, Tabs, TextField, buttonClass, cx, notify}
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
    plain as plainText, applyPasted, badTrueFalse, countQuestions, examIssues, examStats, fileProblem, importErrorText, isBadTrueFalse, isChoice,
    isMissingKey, isSevere, issueKey, missingKeys, missingNumbers, missingTfStatements, numberedUnits, patchData, patchQuestion, removeQuestions,
    saveBlocker, setAnswer, setPassage, setType, splitOptions, toUnits, unseenSevere, TRUE_FALSE_STATEMENTS,
    type DuplicateInfo, type ImportIssue, type ImportedExam, type NumberedUnit, type PastedAnswers, type QuestionUnit, type Stash,
} from './importRules';
import {withDefaultScores} from './examRules';
import {GUIDE_PATH, ctxQuery, issueLabel} from './guideContent';
import {IssueList, LevelBadge, SummaryBar} from './ImportIssues';
import ImportUpload from './ImportUpload';
import PasteAnswers from './PasteAnswers';
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
function SourcePdf({pdf, desktop}: {pdf: PdfState; desktop: boolean}) {
    if (pdf.status === 'loading') return <div className='vt-src-empty' aria-live='polite'>
        <Skeleton height={14} width='60%'/><Skeleton height={220} shape='card'/>
        <p>Đang dựng bản gốc từ file Word… file nhiều đề có thể mất khoảng 15 giây.</p>
    </div>;
    if (pdf.status === 'ready' && pdf.url) return <>
        <iframe className='vt-src-pdf' src={pdf.url} title='Bản gốc của file Word'/>
        {/* A phone's PDF viewer cannot scroll inside an iframe: the native viewer (pinch to zoom) opens in a tab. */}
        {!desktop && <a className={buttonClass({variant: 'secondary'})} href={pdf.url} target='_blank' rel='noopener'>Mở bản gốc toàn màn hình</a>}
    </>;
    return <div className='vt-src-empty'>
        <b>Không có bản gốc cho file này</b>
        <p>Vẫn xem và sửa được đề đã đọc.</p>
    </div>;
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
    /** Coded warnings of THIS question (SPT-93). */
    issues: ImportIssue[];
    /** Original data of questions the teacher converted, so converting back restores the options / answer. */
    stash: MutableRefObject<Stash>;
};

function UnitCard({unit, no, edit, showPassage, duplicates, issues, stash}: UnitCardProps) {
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [splitTo, setSplitTo] = useState<string | null>(null);
    const first = unit.questions[0];
    const ids = unit.questions.map(q => q.id);
    const isTf = first.type === 'TrueFalse';
    const noKey = isMissingKey(unit);
    const badTf = isBadTrueFalse(unit);
    const dup = unit.questions.map(q => duplicates[q.id]).filter(Boolean).sort((a, b) => b.score - a.score)[0];

    const severe = issues.some(isSevere);
    const noTf = missingTfStatements(unit);
    const split = !isChoice(first) && !isTf ? splitOptions(first.data.question || '') : null;

    // Converting loses the old type's own data: keep it, and put it back when the teacher converts back.
    const convert = (type: string, after?: (e: ImportedExam) => ImportedExam) => {
        const kept = stash.current[first.id] || (stash.current[first.id] = {type: first.type, data: first.data});
        edit(e => {
            let next = setType(e, ids, type);
            if (ids.length === 1 && kept.type === type) {
                const {answers, correctAnswerId, answer} = kept.data;
                next = patchQuestion(next, first.id, q => ({...q, data: {...q.data, ...(answers && {answers}), ...(correctAnswerId && {correctAnswerId}), ...(answer !== undefined && {answer})}}));
            }
            return after ? after(next) : next;
        });
    };
    const changeType = (type: string) => {
        if (type === first.type) return;
        // 4 ý become 4 separate questions: ask first.
        if (isTf && unit.questions.length > 1) setSplitTo(type); else convert(type);
    };

    return <div id={'imp-' + first.id} className={cx('vt-imp-q', noKey && 'bad-key', badTf && 'bad-tf', issues.length > 0 && (severe ? 'has-err' : 'has-warn'))}>
        {showPassage && first.data.passage !== undefined && <div className='vt-imp-passage'>
            <div className='vt-imp-passage-label'>
                {isTf ? 'Đề dẫn chung của 4 ý' : 'Ngữ liệu dùng chung — sửa ở đây áp dụng cho cả nhóm câu'}
            </div>
            <Editor text={first.data.passage} onChange={html => edit(e => setPassage(e, first.data.passageId, html))}/>
        </div>}

        <div className='vt-imp-q-head'>
            <b>Câu {no}</b>
            <Select label='Loại câu' className='vt-imp-q-type' value={first.type}
                    onChange={ev => changeType(ev.target.value)}
                    options={QUESTION_TYPES}/>
            {noKey && <span className='vt-imp-flag err'>Chưa có đáp án đúng — chọn một phương án</span>}
            {noTf.length > 0 && <span className='vt-imp-flag err'>Chưa đặt Đúng/Sai cho ý {noTf.join(', ')} — dùng “Dán đáp án nhanh” hoặc sửa file Word</span>}
            {badTf && <span className='vt-imp-flag warn'>
                {unit.questions.length} ý — cần đủ {TRUE_FALSE_STATEMENTS} ý để chấm theo SPT
            </span>}
            {issues.map(i => <span key={issueKey(i)} className='vt-imp-chip'><LevelBadge issue={i}/> {issueLabel(i.code)}</span>)}
            <DuplicateChip info={dup}/>
            <Button variant='ghost' size='sm' className='vt-imp-remove' aria-label={'Xoá câu ' + no}
                    onClick={() => setConfirmRemove(true)}>Xoá</Button>
            <ConfirmDialog open={confirmRemove} tone='danger' title={'Xoá câu ' + no + '?'} cancelLabel='Giữ lại' confirmLabel='Xoá câu'
                           message='Câu bị xoá khỏi bản nhập này. Muốn lấy lại thì chọn file Word và nhập lại.'
                           onCancel={() => setConfirmRemove(false)}
                           onConfirm={() => { setConfirmRemove(false); edit(e => removeQuestions(e, ids)); }}/>
        </div>

        {split && <Button variant='secondary' size='sm' className='vt-imp-split-btn'
                          onClick={() => convert('MultipleChoice', e => patchData(e, first.id, {
                              question: split.stem, answers: split.options.map((value, i) => ({id: first.id + '_' + 'ABCD'[i], value}))}))}>
            Đổi sang Trắc nghiệm và tách A–D
        </Button>}
        <ConfirmDialog open={splitTo !== null} title='Đổi dạng câu Đúng/Sai?' cancelLabel='Giữ nguyên' confirmLabel='Đổi và tách'
                       message={`Câu này có ${unit.questions.length} ý. Đổi dạng sẽ tách thành ${unit.questions.length} câu riêng, mất đề dẫn chung và đáp án Đúng/Sai của từng ý.`}
                       onCancel={() => setSplitTo(null)} onConfirm={() => { const t = splitTo; setSplitTo(null); if (t) convert(t); }}/>

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
                        <label className='vt-imp-hit'><input type='radio' name={'ans-' + first.id} checked={on}
                               aria-label={`Đáp án đúng của câu ${no}: ${String.fromCharCode(65 + i)}`}
                               onChange={() => edit(e => patchData(e, first.id, {correctAnswerId: a.id}))}/></label>
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

type BodyProps = {
    ctx: string; exam: ImportedExam; edit: Edit; duplicates: Record<string, DuplicateInfo>; pdf: PdfState; desktop: boolean;
    issues: ImportIssue[]; seen: Record<string, boolean>; onSee: (i: ImportIssue) => void;
    renumbered: boolean; onRenumber: () => void;
};

function ExamBody({ctx, exam, edit, duplicates, pdf, desktop, issues, seen, onSee, renumbered, onRenumber}: BodyProps) {
    const [tab, setTab] = useState<'doc' | 'src'>('doc');
    const [pasting, setPasting] = useState(false);
    const [renumbering, setRenumbering] = useState(false);
    const stash = useRef<Stash>({});
    const numbered = numberedUnits(exam);
    const noOf = (qid: string) => numbered.find(x => x.unit.questions.some(q => q.id === qid))?.no;
    const gaps = renumbered ? [] : missingNumbers(exam);
    // Warnings that point at no question and no section in the payload (a whole part the reader dropped).
    const loose = issues.filter(i => !i.question_id && i.section_index == null && ['EMPTY_SECTION', 'UNSUPPORTED_CLUSTER'].includes(i.code));
    const sectionEl = (i: ImportIssue) => {
        const s = i.section_index == null ? undefined : exam.sections.find(x => x.id.endsWith('_S' + i.section_index));
        return s ? 'imp-' + s.id : null;
    };
    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({behavior: 'smooth', block: 'center'});
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1200);
    };
    // "câu 21 (Phần II câu 1)": the BE messages count inside the section, the screen counts the whole exam.
    const where = (qid: string) => {
        const s = exam.sections.find(x => x.questions.some(q => q.id === qid));
        const part = s && /^Phần\s+[IVX\d]+/i.exec(plainText(s.name));
        const at = s ? toUnits(s.questions).findIndex(u => u.questions.some(q => q.id === qid)) + 1 : 0;
        return part ? ` (${part[0]} câu ${at})` : '';
    };
    const jump = (i: ImportIssue) => i.question_id ? (noOf(i.question_id) ? 'câu ' + noOf(i.question_id) + where(i.question_id) : null) : sectionEl(i) ? 'phần này' : null;
    const go = (i: ImportIssue) => {
        setTab('doc');
        // After the tab switch the questions are in the DOM again.
        setTimeout(() => scrollTo(i.question_id ? 'imp-' + i.question_id : sectionEl(i) || ''), 0);
    };
    const viewSource = () => { setTab('src'); setTimeout(() => document.querySelector('.vt-imp-source')?.scrollIntoView({behavior: 'smooth'}), 0); };
    const after = numbered.length;
    const skipped = missingNumbers(exam).map(g => 'Câu ' + g.no).join(', ');

    let no = 0;
    return <div className='vt-imp-body'>
        <SummaryBar exam={exam} issues={issues}/>
        <IssueList issues={issues} seen={seen} onSee={onSee} jump={jump} onGo={go} ctx={ctx}/>
        {!desktop && <Tabs aria-label='Đã đọc hoặc bản gốc' block value={tab} onChange={setTab}
                           items={[{value: 'doc', label: 'Đã đọc'}, {value: 'src', label: 'Bản gốc'}]}/>}
        <div className='vt-imp-split'>
            {(desktop || tab === 'src') && <div className='vt-imp-col vt-imp-source'>
                <div className='vt-imp-col-head'>Bản gốc (PDF)</div>
                {pdf.status !== 'idle' && <SourcePdf pdf={pdf} desktop={desktop}/>}
            </div>}
            {(desktop || tab === 'doc') && <div className='vt-imp-col'>
                <div className='vt-imp-col-head'>Đề đã đọc · sửa tại chỗ</div>
                <div className='vt-imp-tools'>
                    <Button variant='secondary' size='sm' onClick={() => setPasting(true)}>Dán đáp án nhanh</Button>
                    <Button variant='secondary' size='sm' disabled={renumbered} onClick={() => setRenumbering(true)}>Đánh số lại câu</Button>
                </div>
                {exam.sections.map(s => <div key={s.id} className='vt-imp-col'>
                    <h3 className='vt-imp-section' id={'imp-' + s.id}>{renderHTML(s.name)}</h3>
                    {toUnits(s.questions).map((u, i, all) => {
                        const prev = all[i - 1];
                        // The passage is printed once, at the FIRST question of its group (groups are consecutive).
                        const showPassage = !prev || prev.questions[0].data.passageId !== u.questions[0].data.passageId
                            || !u.questions[0].data.passageId;
                        const mine = issues.filter(x => x.question_id && u.questions.some(q => q.id === x.question_id));
                        return <div key={u.id} className='vt-imp-col'>
                            {gaps.filter(g => g.beforeId === u.id).map(g => <div key={g.no} className='vt-imp-missing'>
                                <Badge tone='err'>Thiếu</Badge> <b>Câu {g.no}</b> có trong file Word nhưng hệ thống không đọc được.
                            </div>)}
                            <UnitCard unit={u} no={++no} edit={edit} showPassage={showPassage} duplicates={duplicates}
                                      issues={mine} stash={stash}/>
                        </div>;
                    })}
                </div>)}
                {loose.map(i => <div key={issueKey(i)} className='vt-imp-missing'>
                    <LevelBadge issue={i}/> <span>{i.message}</span>
                    <Button variant='ghost' size='sm' onClick={viewSource}>Xem trong bản gốc</Button>
                </div>)}
            </div>}
        </div>

        <PasteAnswers exam={exam} open={pasting} onClose={() => setPasting(false)}
                      onApply={(a: PastedAnswers) => edit(e => applyPasted(e, a))}/>
        <ConfirmDialog open={renumbering} title='Đánh số lại câu' cancelLabel='Huỷ' confirmLabel='Đánh số lại'
                       message={<p>{skipped && <>Trong file số câu bị nhảy (thiếu {skipped}). </>}Sau khi đánh số lại: <b>1–{after}</b>, liên tục từ 1.
                           Chỉ đổi số “Câu n”; nội dung và đáp án giữ nguyên, các cảnh báo nhảy số được bỏ qua.</p>}
                       onCancel={() => setRenumbering(false)} onConfirm={() => { setRenumbering(false); onRenumber(); }}/>
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
    const ctx = ctxQuery(params);   // ?bank= / ?folder= follows every link to the guide and back

    const banksQ = useBanks();
    const foldersQ = useFolders(!bankId);
    const banks = banksQ.data;
    const folders = foldersQ.data;
    const stock = useBankStock(bankId).data;
    const bankInfo = bankId ? banks?.find(b => b.id === bankId) : undefined;
    const folder = folderId ? folders?.find(f => f.id === folderId) : undefined;

    const fileRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    const [reading, setReading] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [exams, setExams] = useState<ImportedExam[]>([]);
    const [issues, setIssues] = useState<ImportIssue[]>([]);
    // "Đã xem, cho phép lưu" per Nặng warning (key = issueKey), and the exams the teacher renumbered.
    const [seen, setSeen] = useState<Record<string, boolean>>({});
    const [renumbered, setRenumbered] = useState<Record<string, boolean>>({});
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
    // Q15: imported exams are saved as Nháp even with errors — only the bank path (?bank=) keeps its block on missing keys.
    const problems = saveBlocker(chosen);
    // SPT-93: a Nặng warning blocks BOTH ways of saving until the teacher pressed "Đã xem, cho phép lưu" on it.
    const unseen = unseenSevere(issues, chosen.map(e => e.id), seen, renumbered).length;
    const blocker = (bankId ? problems : null) || (unseen ? 'unseen' : null);
    const busy = saving || reading;
    const chosenIssues = chosen.flatMap(e => examIssues(issues, e.id, renumbered[e.id]));
    const sevenSeen = chosenIssues.filter(isSevere).length;   // none left unseen once `unseen` is 0
    const lightCount = chosenIssues.length - sevenSeen;

    // From the picker and from a drop on the upload zone.
    const readFile = async (file: File) => {
        setFileName(file.name);
        setExams([]); setIssues([]); setSeen({}); setRenumbered({}); setDuplicates({});
        const bad = fileProblem(file);
        if (bad) { setProblem(bad); return; }
        // A .docx is a zip ("PK"): anything else would only cost a 15 s PDF conversion that cannot work.
        if (await file.slice(0, 2).text() !== 'PK') { setProblem(importErrorText('khong doc duoc file')); return; }
        setProblem(null); setReading(true);
        dropPdf();
        setPdf({status: 'loading'});
        // In parallel with the parse (the exams do not wait for it). Phones need it too: the "Bản gốc" tab.
        const mine = ++seq.current;
        Api.uploadBlob('import_docx/pdf', file).then(blob => {
            if (mine !== seq.current) return;
            pdfUrl.current = URL.createObjectURL(blob);
            setPdf({status: 'ready', url: pdfUrl.current});
        }, () => { if (mine === seq.current) setPdf({status: 'none'}); });
        try {
            const res = await Api.upload<{exams: ImportedExam[]; issues?: ImportIssue[]}>('import_docx/preview', file);
            if (mine !== seq.current) return;   // cancelled while reading
            // Tick ALL by default: untick a few beats re-picking 20.
            setPicked(Object.fromEntries(res.exams.map(e => [e.id, true])));
            setOpenId(res.exams.length ? res.exams[0].id : null);
            setExams(res.exams);
            setIssues(res.issues || []);
        } catch (e) {
            if (mine === seq.current) setProblem(importErrorText(errorText(e, 'không rõ nguyên nhân')));
        } finally {
            if (mine === seq.current) setReading(false);
        }
    };
    // The answer of a cancelled read is dropped by the `seq` check above.
    const cancelRead = () => { seq.current++; dropPdf(); setReading(false); setPdf({status: 'idle'}); setFileName(''); };

    // Leaving with a file read loses every edit and confirmation: ask (reload/close tab, and in-app links).
    const [leaveTo, setLeaveTo] = useState<string | null>(null);
    const dirty = exams.length > 0 && !saving;
    useEffect(() => {
        if (!dirty) return;
        const bye = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        const click = (e: MouseEvent) => {
            const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
            if (!a || a.target === '_blank' || a.origin !== location.origin || e.metaKey || e.ctrlKey) return;
            e.preventDefault(); e.stopPropagation();
            setLeaveTo(a.pathname + a.search + a.hash);
        };
        window.addEventListener('beforeunload', bye);
        document.addEventListener('click', click, true);
        return () => { window.removeEventListener('beforeunload', bye); document.removeEventListener('click', click, true); };
    }, [dirty]);
    const upload = ({target}: ChangeEvent<HTMLInputElement>) => {
        const file = target.files && target.files[0];
        target.value = '';   // allow picking the very same file again
        if (file) readFile(file);
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
                {!exams.length && !reading && <Link to={bankId ? '/question-bank' : '/'} className='vt-imp-link'>← {bankId ? 'Ngân hàng câu hỏi' : 'Môn & đề'}</Link>}
                <PageTitle>Nhập đề từ file Word</PageTitle>
                <MetaChips items={[exams.length > 0 && fileName, context]}/>
            </div>
            {exams.length > 0 && !problem &&
                <Button variant='secondary' disabled={busy} onClick={pickFile}>Chọn file khác</Button>}
        </div>

        <ol className='vt-imp-steps' aria-label='Các bước'>
            {['Tải lên', 'Xem trước', 'Lưu'].map((t, i) => {
                const now = saving ? 2 : exams.length ? 1 : 0;
                return <li key={t} aria-current={i === now ? 'step' : undefined} className={cx(i === now && 'on')}>{i + 1} · {t}</li>;
            })}
        </ol>

        {!exams.length && !reading && !problem && <ImportUpload onFile={readFile} pick={pickFile} ctx={ctx}/>}

        {reading && <Card className='vt-imp-drop' aria-live='polite'>
            <h2>Đang đọc {fileName}…</h2>
            <Skeleton height={14} width='70%'/><Skeleton height={14} width='50%'/>
            <p>Bản gốc dựng song song, file nhiều đề có thể mất khoảng 15 giây.</p>
            <Button variant='secondary' onClick={cancelRead}>Huỷ</Button>
        </Card>}

        {(foldersQ.isError || banksQ.isError) &&
            <ErrorState title='Không tải được danh sách môn / ngân hàng' description={errorText(foldersQ.error || banksQ.error, 'Kiểm tra mạng rồi thử lại.')}
                        onRetry={() => { if (foldersQ.isError) foldersQ.refetch(); if (banksQ.isError) banksQ.refetch(); }}/>}

        {problem && <ErrorState title={problem.startsWith('Chỉ nhận') ? 'Chưa đúng loại file' : problem.startsWith('File quá lớn') ? 'File quá lớn' : 'Không đọc được file'}
                                retryLabel='Chọn file khác' onRetry={pickFile}
                                description={<>{problem.replace(/^Không đọc được file: /, '')} <Link to={GUIDE_PATH + ctx} className='vt-imp-link'>Lỗi thường gặp</Link></>}/>}

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
                const mine = examIssues(issues, exam.id, renumbered[exam.id]);
                const nSevere = mine.filter(isSevere).length;
                const dupCount = exam.sections.reduce((n, s) => n + toUnits(s.questions)
                    .filter(u => u.questions.some(q => duplicates[q.id])).length, 0);
                return <div key={exam.id} className='vt-imp-exam'>
                    <div className='vt-imp-exam-row'>
                        <label className='vt-imp-hit'><input type='checkbox' checked={!!picked[exam.id]}
                               aria-label={'Chọn ' + exam.name}
                               onChange={() => setPicked(p => ({...p, [exam.id]: !p[exam.id]}))}/></label>
                        <TextField label='Tên đề' className='vt-imp-exam-name' value={exam.name}
                                   onChange={ev => patchExam(exam.id)(e => ({...e, name: ev.target.value}))}/>
                        <TextField label='Phút' type='number' min={0} className='vt-imp-exam-min'
                                   value={exam.duration === undefined ? 45 : exam.duration}
                                   onChange={ev => patchExam(exam.id)(e => ({...e, duration: parseInt(ev.target.value, 10) || 0}))}/>
                        <span className='vt-imp-exam-meta'>
                            {countQuestions(exam)} câu
                            {nSevere > 0 && <Badge tone='err'>{nSevere} cảnh báo nặng</Badge>}
                            {mine.length - nSevere > 0 && <Badge tone='sun'>{mine.length - nSevere} cảnh báo nhẹ</Badge>}
                            {missing > 0 && <Badge tone='err'>{missing} câu thiếu đáp án</Badge>}
                            {wrongTf > 0 && <Badge tone='sun'>{wrongTf} câu Đúng/Sai chưa đủ 4 ý</Badge>}
                            {/* a collapsed exam hides its chips — count them here to know which to open */}
                            {dupCount > 0 && <Badge tone='sun'>{dupCount} câu trùng</Badge>}
                        </span>
                        <Button variant='ghost' size='sm' onClick={() => setInfoId(exam.id)}>Thông tin đề</Button>
                        <Button variant='secondary' size='sm' aria-expanded={open}
                                onClick={() => setOpenId(open ? null : exam.id)}>{open ? 'Thu gọn' : 'Xem & sửa'}</Button>
                    </div>
                    {open && <ExamBody ctx={ctx} exam={exam} edit={patchExam(exam.id)} duplicates={duplicates} pdf={pdf} desktop={desktop}
                                       issues={mine} seen={seen} onSee={i => setSeen(m => ({...m, [issueKey(i)]: true}))}
                                       renumbered={!!renumbered[exam.id]} onRenumber={() => setRenumbered(m => ({...m, [exam.id]: true}))}/>}
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
                {unseen
                    ? `Còn ${unseen} cảnh báo nặng chưa xem. Bấm “Đã xem, cho phép lưu” ở từng cảnh báo, hoặc sửa file Word rồi nhập lại.`
                : blocker
                    ? blocker + ' — sửa ngay trong đề, hoặc sửa file Word rồi nhập lại.'
                    : problems && !bankId
                        ? problems + ' — vẫn tạo được đề nháp; phải sửa xong mới xuất bản được.'
                    : sevenSeen > 0 && !saving ? `Đã xem ${sevenSeen} cảnh báo nặng.${lightCount ? ` ${lightCount} cảnh báo nhẹ không chặn việc lưu.` : ''}`
                    : saving ? 'Lưu lần lượt từng đề, đừng đóng trang.'
                    : !bankId && !folderId
                        ? <>Chọn môn học để tạo đề. Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</>
                    : Object.keys(duplicates).length
                        ? `Có ${Object.keys(duplicates).length} câu trùng với ngân hàng — xem chip trên từng câu rồi tự quyết.`
                    : bankId ? 'Vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.' : ''}
            </span>
        </Card>}

        <ConfirmDialog open={leaveTo !== null} tone='danger' title='Rời trang này?' cancelLabel='Ở lại' confirmLabel='Rời đi'
                       message='Đề đã đọc, các chỗ đã sửa và các cảnh báo đã xác nhận sẽ mất. Muốn làm tiếp thì phải chọn file và nhập lại.'
                       onCancel={() => setLeaveTo(null)} onConfirm={() => { const to = leaveTo; setLeaveTo(null); setExams([]); if (to) setTimeout(() => navigate(to), 0); }}/>

        <ExamInfoModal exam={exams.find(e => e.id === infoId)} onClose={() => setInfoId(null)}
                       onJump={x => infoId && jumpTo(infoId, x)}/>
    </div>;
}
