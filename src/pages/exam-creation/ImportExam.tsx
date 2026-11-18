import {useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import type {ChangeEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, ConfirmDialog, ErrorState, IconButton, MetaChips, Modal, PageTitle, Select, Loading, Tabs, TextField, buttonClass, cx, icons, notify}
    from '../../components/ui';
import {uploadImages} from './imageUpload';
import type {ImageCache} from './imageUpload';
import {useFolders} from '../../queries/exams';
import {bankKeys, useBankStock, useBanks} from '../../queries/questionBank';
import PaperImportResult, {type PaperResult, type PaperSaveReply} from '../question-bank/PaperImportResult';
import {useBankStandard} from '../question-bank/PaperStructure';
import '../question-bank/paper-bank.css';
import Api from '../../services/api';
import {errorText, formatDecimal} from '../../lib/format';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {blockLabel} from './blockTypes';
import {
    plain as plainText, applyPasted, badTrueFalse, countQuestions, examIssues, fileProblem, importErrorText, isBadTrueFalse, isChoice,
    hasSharedInfo, isClusterQuestion, isMissingKey, isSevere, issueKey, missingKeys, missingNumbers, missingTfStatements, numberedUnits, partRows, patchData, patchQuestion, removeQuestions, replaceUnit,
    sourceNumbering, saveBlocker, setPassage, setType, splitOptions, toUnits, withShownCounts, unseenSevere, TRUE_FALSE_STATEMENTS,
    type DuplicateInfo, type ImportIssue, type ImportQuestion, type ImportedExam, type PastedAnswers, type QuestionUnit, type Stash,
} from './importRules';
import {withDefaultScores} from './examRules';
import {issueLabel} from './guideContent';
import {GuideModal} from './ImportGuide';
import ImportQuestionModal from './ImportQuestionModal';
import {IssueList, LevelBadge, SummaryBar} from './ImportIssues';
import ImportFiles, {type FileRow} from './ImportFiles';
import {ReviewList, cutLabel, type ReviewRow} from './ImportReview';
import {SAME_BLOCK, bankDuplicates, blocksOf, importDuplicates, withoutBlocks, type BlockDup} from './dupRules';
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
        <Loading variant='inline'/>
        <p>Đang dựng bản gốc từ file Word… thường vài giây đến vài chục giây; file nhiều đề có thể lâu hơn nhiều, thậm chí không dựng được. Đề đã đọc vẫn dùng bình thường.</p>
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
    const matches = info.matches.map(k => (k.in_file ? 'trong file này' : (k.block || k.id)) + ' — ' + formatDecimal(k.score * 100) + '%').join('\n');
    return <span className={cx('vt-imp-dup', info.score >= 0.95 ? 'high' : info.score >= 0.8 && 'mid')} title={'Trùng với:\n' + matches}>
        Tỷ lệ trùng: {formatDecimal(info.score * 100)}%
    </span>;
}

type UnitCardProps = {
    unit: QuestionUnit; no: number; edit: Edit; showPassage: boolean;
    duplicates: Record<string, DuplicateInfo>;
    /** Coded warnings of THIS question (SPT-93). */
    issues: ImportIssue[];
    seen: Record<string, boolean>; onSee: (i: ImportIssue) => void;
    /** Original data of questions the teacher converted, so converting back restores the options / answer. */
    stash: MutableRefObject<Stash>;
};

/** The question as on the paper: only the right answer is tinted. Editing happens in `ImportQuestionModal`. */
function UnitCard({unit, no, edit, showPassage, duplicates, issues, seen, onSee, stash}: UnitCardProps) {
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [editing, setEditing] = useState(false);
    const [splitTo, setSplitTo] = useState<string | null>(null);
    const first = unit.questions[0];
    const ids = unit.questions.map(q => q.id);
    const isTf = first.type === 'TrueFalse';
    const isChum = isClusterQuestion(first);   // SPT-97 câu chùm: dẫn liệu + n ý trả lời ngắn
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
                const {answers, correctAnswerId, answer, max_words, max_chars} = kept.data;
                // after "tách A–D" the A–D text goes back into the question, unless the teacher rewrote the stem meanwhile
                const back = kept.split !== undefined && first.data.question === kept.split ? {question: kept.data.question} : {};
                next = patchQuestion(next, first.id, q => ({...q, data: {...q.data, ...back, ...(answers && {answers}), ...(correctAnswerId && {correctAnswerId}), ...(answer !== undefined && {answer}), ...(max_words && {max_words}), ...(max_chars && {max_chars})}}));
            }
            return after ? after(next) : next;
        });
    };
    const changeType = (type: string) => {
        if (type === first.type) return;
        // 4 ý become 4 separate questions: ask first.
        if ((isTf || isChum) && unit.questions.length > 1) setSplitTo(type); else convert(type);
    };
    const save = (next: ImportQuestion[]) => {
        setEditing(false);
        edit(e => {
            const done = replaceUnit(e, ids, next);
            const {passageId, passage} = next[0].data;
            return passageId && passage !== first.data.passage ? setPassage(done, passageId, passage || '') : done;
        });
    };

    const keyOf = (i: number) => String.fromCharCode(65 + i) + '.';
    return <div id={'imp-' + first.id} className={cx('vt-imp-q', noKey && 'bad-key', badTf && 'bad-tf', issues.length > 0 && (severe ? 'has-err' : 'has-warn'))}>
        {showPassage && first.data.passage !== undefined && <div className='vt-imp-passage'>{renderHTML(first.data.passage)}</div>}

        <div className='vt-imp-q-head'>
            <div className='vt-imp-q-title'>
                <b>Câu {no}</b>
                {!(noKey || noTf.length || badTf || issues.length) && <Badge tone='title'>{QUESTION_TYPES.find(t => t.value === first.type)?.label || first.type}</Badge>}
                {noKey && <span className='vt-imp-flag err'>Chưa có đáp án đúng — sửa câu để chọn</span>}
                {noTf.length > 0 && <span className='vt-imp-flag err'>Chưa đặt Đúng/Sai cho ý {noTf.join(', ')} — dùng “Dán đáp án nhanh” hoặc sửa file Word</span>}
                {badTf && <span className='vt-imp-flag warn'>
                    {unit.questions.length} ý — cần đủ {TRUE_FALSE_STATEMENTS} ý để chấm theo SPT
                </span>}
                {issues.map(i => <span key={issueKey(i)} className='vt-imp-chip'><LevelBadge issue={i}/> {issueLabel(i.code)}</span>)}
                <DuplicateChip info={dup}/>
            </div>
            <span className='vt-imp-q-acts'>
                <IconButton variant='outline' label={'Sửa câu ' + no} icon={<icons.IconEdit size={18}/>} onClick={() => setEditing(true)}/>
                <IconButton variant='outline' className='vt-iconbtn--danger' label={'Xoá câu ' + no} tipEnd icon={<icons.IconTrash size={18}/>} onClick={() => setConfirmRemove(true)}/>
            </span>
            <ConfirmDialog open={confirmRemove} tone='danger' title={'Xoá câu ' + no + '?'} cancelLabel='Giữ lại' confirmLabel='Xoá câu'
                           message='Câu bị xoá khỏi bản nhập này. Muốn lấy lại thì chọn file Word và nhập lại.'
                           onCancel={() => setConfirmRemove(false)}
                           onConfirm={() => { setConfirmRemove(false); edit(e => removeQuestions(e, ids)); }}/>
        </div>

        {isChum || isTf
            ? <>
                {unit.questions.map((q, i) => {
                    const right = isChum ? !!plainText(String(q.data.answer ?? '')) : false;
                    return <div key={q.id} className='vt-imp-answer vt-imp-chum'>
                        <span className='vt-imp-answer-key'>{isChum ? String(q.data.label || String.fromCharCode(97 + i) + ')') : String.fromCharCode(97 + i) + ')'}</span>
                        <div className='vt-imp-answer-body'>
                            {renderHTML(q.data.question || '')}
                            {isChum && <div className={cx('vt-imp-key', right && 'on')}>
                                {right ? <>Đáp án: <b>{renderHTML(String(q.data.answer))}</b></> : 'Chưa có đáp án'}
                            </div>}
                        </div>
                        {isChum
                            ? <Badge tone='title'>{formatDecimal(Number(q.data.max_score) || 0.5)}đ</Badge>
                            : <Badge tone={q.data.answer === true ? 'ok' : q.data.answer === false ? 'err' : 'draft'}>
                                {q.data.answer === true ? 'Đúng' : q.data.answer === false ? 'Sai' : 'Chưa có đáp án'}
                            </Badge>}
                    </div>;
                })}
            </>
            : <>
                <div className='vt-imp-stem'>{renderHTML(first.data.question || '')}</div>
                {isChoice(first) && (first.data.answers || []).map((a, i) =>
                    <div key={a.id} className={cx('vt-imp-answer', first.data.correctAnswerId === a.id && 'on')}>
                        <span className='vt-imp-answer-key'>{keyOf(i)}</span>
                        <div className='vt-imp-answer-body'>{renderHTML(a.value)}</div>
                        {first.data.correctAnswerId === a.id && <><span className='vt-qbv-tick' aria-hidden='true'><icons.IconCheckCircle size={20} color='var(--vt-ok-ink)'/></span><span className='vt-sr-only'>(đáp án đúng)</span></>}
                    </div>)}
                {first.type === 'FillBlank' && <div className={cx('vt-imp-key', plainText(String(first.data.answer ?? '')) && 'on')}>
                    {plainText(String(first.data.answer ?? '')) ? <>Đáp án: <b>{renderHTML(String(first.data.answer))}</b></> : 'Chưa có đáp án'}
                </div>}
            </>}

        {/* IV2-XemTruoc: each warning of this question inside its card, level always in words */}
        {issues.map(i => <div key={issueKey(i)} className='vt-imp-q-issue' role='note'>
            <LevelBadge issue={i}/>
            <span className='vt-imp-issue-text'>{i.message}</span>
            {isSevere(i) && (seen[issueKey(i)]
                ? <Badge tone='ok'>Đã xem</Badge>
                : <Button variant='secondary' size='sm' onClick={() => onSee(i)}>Đã xem, cho phép lưu</Button>)}
        </div>)}

        {split && <div className='vt-imp-split-hint' role='note'>
            <span>Câu này có “A. … B. … C. … D.” trong nội dung. Có phải câu trắc nghiệm?</span>
            <Button variant='secondary' size='sm'
                    onClick={() => { convert('MultipleChoice', e => patchData(e, first.id, {
                        question: split.stem, answers: split.options.map((value, i) => ({id: first.id + '_' + 'ABCD'[i], value}))})); stash.current[first.id].split = split.stem; }}>
                Đổi sang Trắc nghiệm và tách A–D
            </Button>
        </div>}

        {first.data.explanation && <details className='vt-imp-explain'>
            <summary>Lời giải (học sinh thấy sau khi nộp bài)</summary>
            <div>{renderHTML(first.data.explanation)}</div>
        </details>}

        {editing && <ImportQuestionModal key={unit.questions.map(q => q.id + q.type).join()} unit={unit} no={no}
            onSave={save} onClose={() => setEditing(false)}
            header={<div className='vt-imp-edit-head'>
                <Select label='Loại câu' value={first.type} onChange={ev => changeType(ev.target.value)} options={QUESTION_TYPES}/>
            </div>}/>}
        <ConfirmDialog open={splitTo !== null} title='Đổi dạng câu Đúng/Sai?' cancelLabel='Giữ nguyên' confirmLabel='Đổi và tách'
                       message={`Câu này có ${unit.questions.length} ý. Đổi dạng sẽ tách thành ${unit.questions.length} câu riêng, mất đề dẫn chung và đáp án của từng ý.`}
                       onCancel={() => setSplitTo(null)} onConfirm={() => { const t = splitTo; setSplitTo(null); if (t) convert(t); }}/>
    </div>;
}

type BodyProps = {
    onFix: (anchor: string) => void; exam: ImportedExam; edit: Edit; duplicates: Record<string, DuplicateInfo>; pdf: PdfState; desktop: boolean;
    issues: ImportIssue[]; seen: Record<string, boolean>; onSee: (i: ImportIssue) => void;
    renumbered: boolean; onRenumber: () => void;
    /** B3: into a bank the numbers are redone when an exam is drawn, so the button is only for direct creation. */
    canRenumber: boolean;
    /** Block bank: the "Khối sẽ cắt" column of the summary. */
    cut?: {part: (i: number) => string; total: number};
};

function ExamBody({onFix, exam, edit, duplicates, pdf, desktop, issues, seen, onSee, renumbered, onRenumber, canRenumber, cut}: BodyProps) {
    const [tab, setTab] = useState<'doc' | 'src'>('doc');
    const [pasting, setPasting] = useState(false);
    const [renumbering, setRenumbering] = useState(false);
    const stash = useRef<Stash>({});
    const numbered = numberedUnits(exam);
    const parts = partRows(exam, issues);
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

    let no = 0;
    return <div className='vt-imp-body'>
        <SummaryBar exam={exam} issues={issues} cut={cut}/>
        <IssueList compact={!desktop} issues={issues} seen={seen} onSee={onSee} jump={jump} onGo={go} onFix={onFix}/>
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
                    {canRenumber && <Button variant='secondary' size='sm' disabled={renumbered} onClick={() => setRenumbering(true)}>Đánh số lại câu</Button>}
                </div>
                {exam.sections.map((s, si) => <div key={s.id} className='vt-imp-col'>
                    <h3 className='vt-imp-section' id={'imp-' + s.id}>
                        {parts[si].name} · {parts[si].kind}
                        <span className='vt-imp-section-count'>đọc {parts[si].read}{typeof parts[si].declared === 'number' && ` / ${parts[si].declared}`} câu</span>
                    </h3>
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
                                      issues={mine} seen={seen} onSee={onSee} stash={stash}/>
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
        {renumbering && <RenumberDialog open exam={exam} after={after}
                        onClose={() => setRenumbering(false)} onConfirm={() => { setRenumbering(false); onRenumber(); }}/>}
    </div>;
}

/** IV2 §3: shows what the numbers are now and what they become; "Giữ số như trong file" changes nothing. */
function RenumberDialog({open, exam, after, onClose, onConfirm}: {open: boolean; exam: ImportedExam; after: number; onClose: () => void; onConfirm: () => void}) {
    const [keep, setKeep] = useState(false);
    const {ranges, skipped} = sourceNumbering(exam);
    const choice = (on: boolean, title: string, note: string) => <label className={cx('vt-imp-choice', keep === !on && 'on')}>
        <input type='radio' name='renumber' checked={keep === !on} onChange={() => setKeep(!on)}/>
        <span className='vt-imp-choice-dot' aria-hidden='true'/>
        <span><b>{title}</b><span className='vt-imp-hint'>{note}</span></span>
    </label>;
    return <Modal open={open} onClose={onClose} title='Đánh số lại câu' size='md'
                  footer={<><Button variant='secondary' onClick={onClose}>Huỷ</Button>
                      <Button variant='primary' onClick={keep ? onClose : onConfirm}>Đánh số lại</Button></>}>
        <div className='vt-imp-renum'>
            <div className='vt-imp-renum-box'>Hiện tại<br/><b>{ranges || '—'}</b>
                {skipped.length > 0 && <> <span className='vt-imp-hint'>(nhảy qua {skipped.join(', ')})</span></>}</div>
            <span aria-hidden='true'><icons.IconArrowRight size={20}/></span>
            <div className='vt-imp-renum-box after'>Sau khi đánh số lại<br/><b>1–{after}</b></div>
        </div>
        <div className='vt-imp-choices'>
            {choice(true, 'Đánh số liên tục từ 1', 'Chỉ đổi số “Câu n”; nội dung và đáp án giữ nguyên.')}
            {choice(false, 'Giữ số như trong file', 'Chỉ ghi chú chỗ bị nhảy số.')}
        </div>
    </Modal>;
}

/** Files handed to the next bank (BF-04 "Nhập vào … nguyên đề"): the page stays mounted, so state alone would not carry them. */
let handoff: File[] = [];

export default function ImportExam() {
    const [params] = useSearchParams();
    const bankId = params.get('bank');
    const [pickedFolder, setPickedFolder] = useState('');
    // Direct import (no bank): the subject comes from ?folder= or from the picker, and is required.
    const folderId = params.get('folder') || pickedFolder || null;
    const navigate = useNavigate();
    const qc = useQueryClient();

    const banksQ = useBanks();
    const foldersQ = useFolders();   // also for "Tạo thẳng" from a bank (the subject is asked in a dialog)
    const banks = banksQ.data;
    const folders = foldersQ.data;
    const bankInfo = bankId ? banks?.find(b => b.id === bankId) : undefined;
    const paperBank = bankInfo?.kind === 'paper';   // whole exams go in as they are: no blocks, no stock
    const stock = useBankStock(bankInfo && !paperBank ? bankId : null).data;
    const standard = useBankStandard(paperBank ? bankId! : '');
    // BF-04: the whole-exam bank of the same subject, where a «Cho biết» file belongs
    const paperTarget = bankInfo && !paperBank ? banks?.find(b => b.kind === 'paper' && b.subject === bankInfo.subject) || null : null;
    const [result, setResult] = useState<PaperResult | null>(null);
    const folder = folderId ? folders?.find(f => f.id === folderId) : undefined;

    const fileRef = useRef<HTMLInputElement>(null);
    // B1: several files at once, one row each. A file with an error never blocks the others.
    const [files, setFiles] = useState<FileRow[]>([]);
    const [previewing, setPreviewing] = useState(false);   // step 2 (a single clean file goes there by itself)
    const fileOf = useRef<Record<string, File>>({});       // exam id → the file it came from (for the PDF)
    const replacing = useRef<string | null>(null);         // "Chọn lại file": the errored row the next pick replaces
    const reading = files.some(f => f.status === 'queued' || f.status === 'reading');
    const [exams, setExams] = useState<ImportedExam[]>([]);
    const [allIssues, setIssues] = useState<ImportIssue[]>([]);
    const [guide, setGuide] = useState<string | null>(null);   // the guide dialog: '' = top, else the entry id
    // "Đã xem, cho phép lưu" per Nặng warning (key = issueKey), and the exams the teacher renumbered.
    const [seen, setSeen] = useState<Record<string, boolean>>({});
    const [renumbered, setRenumbered] = useState<Record<string, boolean>>({});
    const [picked, setPicked] = useState<Record<string, boolean>>({});
    // ponytail: ONE exam open at a time — each edit box is a TipTap view; 20 exams x 60 boxes would choke the browser.
    const [openId, setOpenId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duplicates, setDuplicates] = useState<Record<string, DuplicateInfo>>({});
    // Kiểm trùng (BF-12, B7): progress + cancel, and a result that stays on screen.
    type DupDone = {compared: number; existing: Record<string, {bank: string; bank_name: string; same_bank: boolean; count: number}>};
    const [dupRun, setDupRun] = useState<{at: number; of: number; name: string} | null>(null);
    const [dupDone, setDupDone] = useState<DupDone | null>(null);
    const cancelDup = useRef(false);
    const checking = dupRun !== null;
    // Duplicate blocks are NOT saved unless the teacher ticks "Vẫn lưu" (key = exam id + block id).
    const [keepDup, setKeepDup] = useState<Record<string, boolean>>({});
    // Per exam outcome of the last save (BF-07) and the other bank an exam already lives in (BF-15).
    const [state, setState] = useState<Record<string, 'saved' | 'error' | 'pending'>>({});
    const [otherBank, setOtherBank] = useState<Record<string, {id: string; name: string}>>({});
    const [saveErrors, setSaveErrors] = useState<{id: string; name: string; file: string; message: string}[]>([]);
    const [directOpen, setDirectOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [directFolder, setDirectFolder] = useState('');
    // images already uploaded (data URI → path): a retry after a dropped connection skips them
    const images = useRef<ImageCache>(new Map());
    const desktop = useMediaQuery(DESKTOP);
    const [pdf, setPdf] = useState<PdfState>({status: 'idle'});
    // One object URL at a time: revoked when the file changes and when the screen closes.
    const pdfUrl = useRef<string>();
    const dropPdf = () => { if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); pdfUrl.current = undefined; };
    const seq = useRef(0);   // a PDF that arrives after another file was picked (or the screen closed) is ignored
    useEffect(() => () => { seq.current++; dropPdf(); }, []);

    // A warning about a question the teacher deleted is gone with it (it would still gate saving otherwise).
    const alive = new Set(exams.flatMap(e => e.sections.flatMap(s => s.questions.map(q => q.id))));
    const issues = allIssues.filter(i => !i.question_id || alive.has(i.question_id));
    const chosen = exams.filter(e => picked[e.id]);
    // Q15: imported exams are saved as Nháp even with errors — only the bank path (?bank=) keeps its block on missing keys.
    const problems = saveBlocker(chosen);
    // SPT-93: a Nặng warning blocks BOTH ways of saving until the teacher pressed "Đã xem, cho phép lưu" on it.
    const unseen = unseenSevere(issues, chosen.map(e => e.id), seen, renumbered).length;
    const blocker = (bankId ? problems : null) || (unseen ? 'unseen' : null);
    const busy = saving || reading;
    const allRejected = !!result && result.papers.length === 0;
    const chosenIssues = chosen.flatMap(e => examIssues(issues, e.id, renumbered[e.id]));
    const sevenSeen = chosenIssues.filter(isSevere).length;   // none left unseen once `unseen` is 0
    const lightCount = chosenIssues.length - sevenSeen;

    const patchRow = (key: string, p: Partial<FileRow>) => setFiles(fs => fs.map(f => f.key === key ? {...f, ...p} : f));
    const loadPdf = (file: File) => {
        dropPdf();
        setPdf({status: 'loading'});
        const mine = ++seq.current;
        Api.uploadBlob('import_docx/pdf', file).then(blob => {
            if (mine !== seq.current) return;
            pdfUrl.current = URL.createObjectURL(blob);
            setPdf({status: 'ready', url: pdfUrl.current});
        }, () => { if (mine === seq.current) setPdf({status: 'none'}); });
    };
    // The PDF follows the exam that is open (it is the file that exam came from).
    const pdfFile = useRef<File | null>(null);
    const openFile = openId ? fileOf.current[openId] : undefined;
    useEffect(() => {
        if (openFile && openFile !== pdfFile.current) { pdfFile.current = openFile; loadPdf(openFile); }
    }, [openFile]);

    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    // Read one file: its exams are appended to the others (ids already there are skipped, not duplicated).
    const readOne = async (row: FileRow, known: Set<string>, pdfNow: boolean) => {
        const {file, key} = row;
        const bad = fileProblem(file);
        // A .docx is a zip ("PK"): anything else would only cost a 15 s PDF conversion that cannot work.
        const notZip = !bad && await file.slice(0, 2).text() !== 'PK';
        if (bad || notZip) { patchRow(key, {status: 'error', problem: bad || importErrorText('khong doc duoc file')}); return; }
        patchRow(key, {status: 'reading', problem: undefined});
        // A single file starts its PDF now, in parallel with the parse; with several files the PDF follows the open exam.
        if (pdfNow) { pdfFile.current = file; loadPdf(file); }
        try {
            const res = await Api.upload<{exams: ImportedExam[]; issues?: ImportIssue[]}>('import_docx/preview', file);
            if (!mounted.current) return;
            // BF-04: a block bank cannot keep «Cho biết» → those exams stay out, the file says why and points to a whole-exam bank
            const sharedOut = bankId && !paperBank ? res.exams.filter(hasSharedInfo) : [];
            const fresh = res.exams.filter(e => !known.has(e.id) && !sharedOut.includes(e));
            if (sharedOut.length && !fresh.length) {
                patchRow(key, {status: 'error', shared: sharedOut.length, problem: 'shared_info'});
                return;
            }
            fresh.forEach(e => { known.add(e.id); fileOf.current[e.id] = file; });
            // Tick ALL by default: untick a few beats re-picking 20.
            setPicked(p => ({...p, ...Object.fromEntries(fresh.map(e => [e.id, true]))}));
            setOpenId(o => o || (fresh.length ? fresh[0].id : null));
            setExams(es => [...es, ...fresh.map(withShownCounts)]);
            setIssues(is => [...is, ...(res.issues || [])]);
            patchRow(key, {status: 'ok', exams: fresh.length, skipped: res.exams.length - fresh.length - sharedOut.length, shared: sharedOut.length,
                questions: fresh.reduce((n, e) => n + countQuestions(e), 0),
                blocks: fresh.reduce((n, e) => n + blocksOf(e).length, 0),
                cluster: fresh.some(e => e.sections.some(s => s.questions.some(isClusterQuestion)))});
        } catch (e) {
            if (mounted.current) patchRow(key, {status: 'error', problem: importErrorText(errorText(e, 'không rõ nguyên nhân'))});
        }
    };

    // From the picker and from a drop on the upload zone. ponytail: sequential on purpose (a 2-core server, 20 files).
    const readFiles = async (list: File[], clear = false) => {
        if (!list.length) return;
        const rows: FileRow[] = list.map((file, i) => ({key: Date.now() + '-' + i + '-' + file.name, file, status: 'queued', exams: 0, questions: 0, skipped: 0}));
        const known = new Set<string>(clear ? [] : exams.map(e => e.id));
        if (clear) {
            setExams([]); setIssues([]); setSeen({}); setRenumbered({}); setDuplicates({}); setResult(null); setPicked({}); setOpenId(null);
            fileOf.current = {}; pdfFile.current = null;
        }
        const old = replacing.current;
        replacing.current = null;
        setFiles(fs => [...(clear ? [] : fs.filter(f => f.key !== old)), ...rows]);
        setPreviewing(false);
        const pdfNow = list.length === 1 && !exams.length;
        for (const row of rows) await readOne(row, known, pdfNow);
    };
    const goPaper = () => {
        if (!paperTarget) return;
        handoff = files.filter(f => f.status === 'error' && f.shared).map(f => f.file);
        goTo('/import-exam?bank=' + paperTarget.id);
    };
    useEffect(() => {
        if (!handoff.length || !bankId || !banks) return;
        const list = handoff;
        handoff = [];
        readFiles(list, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bankId, banks]);
    // One file, read without error: straight to the preview, as before.
    useEffect(() => {
        if (!previewing && files.length === 1 && files[0].status === 'ok' && exams.length) setPreviewing(true);
    }, [files, exams.length, previewing]);

    // Leaving with a file read loses every edit and confirmation: ask (reload/close tab, and in-app links).
    const [leaveTo, setLeaveTo] = useState<string | null>(null);
    const dirty = exams.length > 0 && !saving;
    // Browser Back: with a read file, one extra history entry sits on top ("armed"). Back pops it → ask; "Ở lại" pushes it again.
    // ponytail: no router blocker (BrowserRouter has none). Links leave with `replace` while armed, so no stray entry is left behind.
    const armed = useRef(false);
    const goTo = (to: string, state?: unknown) => navigate(to, {replace: armed.current, state});
    useEffect(() => {
        if (!dirty) return;
        if (!armed.current) { history.pushState(history.state, '', location.href); armed.current = true; }
        const back = () => { armed.current = false; setLeaveTo('back'); };
        window.addEventListener('popstate', back);
        const bye = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        const click = (e: MouseEvent) => {
            const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
            if (!a || a.target === '_blank' || a.origin !== location.origin || e.metaKey || e.ctrlKey) return;
            e.preventDefault(); e.stopPropagation();
            setLeaveTo(a.pathname + a.search + a.hash);
        };
        window.addEventListener('beforeunload', bye);
        document.addEventListener('click', click, true);
        return () => { window.removeEventListener('beforeunload', bye); window.removeEventListener('popstate', back); document.removeEventListener('click', click, true); };
    }, [dirty]);
    const upload = ({target}: ChangeEvent<HTMLInputElement>) => {
        const list = Array.from(target.files || []);
        target.value = '';   // allow picking the very same files again
        readFiles(list, !!result);   // after a save, "Nhập tiếp" starts over
    };

    const patchExam = (id: string): Edit => fn => setExams(es => es.map(e => e.id === id ? fn(e) : e));

    const toggleAll = () => {
        const all = exams.every(e => picked[e.id]);
        setPicked(Object.fromEntries(exams.map(e => [e.id, !all])));
    };

    // Blocks the bank already holds (BE score) or that two exams of this batch share: not saved unless "Vẫn lưu" is ticked.
    const bankDups = chosen.flatMap(e => bankDuplicates(e, duplicates));
    const impDups = importDuplicates(chosen);
    const dupsOf = (id: string): BlockDup[] => [...bankDups, ...impDups].filter(d => d.exam === id);
    const dropOf = (e: ImportedExam) => new Set(dupsOf(e.id).filter(d => !keepDup[e.id + d.block]).map(d => d.block));

    // Optional: an empty bank measures 0 anyway. Numbers only, never blocks saving. Cancel keeps nothing half-done.
    const checkDuplicates = async () => {
        cancelDup.current = false;
        setDupDone(null);
        const merged: Record<string, DuplicateInfo> = {};
        const existing: DupDone['existing'] = {};
        let compared = 0;
        try {
            for (const [i, e] of chosen.entries()) {
                if (cancelDup.current) return;
                setDupRun({at: i + 1, of: chosen.length, name: e.name});
                const r = await Api.post<{duplicates?: Record<string, DuplicateInfo>; compared?: number; existing?: DupDone['existing'][string] | null}>(
                    'question_bank/check_duplicates', {...await uploadImages(e, images.current), bank: bankId});
                if (cancelDup.current) return;
                Object.assign(merged, r.duplicates || {});
                compared = Math.max(compared, r.compared || 0);
                if (r.existing) existing[e.id] = r.existing;
            }
            setDuplicates(merged); setDupDone({compared, existing}); setKeepDup({});
            // An exam the bank already has is ticked off (tick it again to save it anyway).
            setPicked(p => ({...p, ...Object.fromEntries(Object.keys(existing).map(id => [id, false]))}));
        } catch (e) {
            notify.error('Không đo được trùng lặp (' + errorText(e, 'lỗi không rõ') + '). Vẫn lưu được bình thường.');
        } finally {
            setDupRun(null);
        }
    };

    const failedAt = (source: ImportedExam, err: unknown) =>
        ({id: source.id, name: source.name, file: fileOf.current[source.id]?.name || '', message: errorText(err, 'Thử lại sau.')});

    // Into the bank. Whole-exam banks send one batch; block banks save exam by exam and keep an outcome per exam (BF-07).
    const saveToBank = async () => {
        const list = chosen.filter(e => state[e.id] !== 'saved' && !otherBank[e.id]);
        if (!list.length || blocker) return;
        setSaving(true); setProgress(0); setSaveErrors([]);
        let done = 0;
        const out: PaperResult = {papers: [], rejected: [], total: bankInfo?.items ?? 0};
        try {
            if (paperBank) {
                // Whole exams: images first (one by one), then the batch in one request (BE takes 1-50 papers); a 409 carrying `rejected` = none fit.
                const papers = [];
                for (const source of list) { papers.push(await uploadImages(source, images.current)); setProgress(++done); }
                for (let i = 0; i < papers.length; i += 50) {
                    try {
                        const r = await Api.post<PaperSaveReply>('question_bank/save', {bank: bankId, papers: papers.slice(i, i + 50)});
                        out.papers.push(...r.papers); out.rejected.push(...r.rejected); out.total = r.total;
                    } catch (err) {
                        const rejected = (err as Partial<PaperSaveReply>).rejected;
                        if ((err as {code?: number}).code !== 409 || !rejected) throw err;
                        out.rejected.push(...rejected);
                    }
                }
                setResult(out);
                return;
            }
            setState(s => ({...s, ...Object.fromEntries(list.map(e => [e.id, 'pending' as const]))}));
            const fails: typeof saveErrors = [];
            let added = 0, otherNow = 0;
            for (const source of list) {
                // ponytail: sequential on purpose — 20 exams x 12 questions in parallel chokes a 2-core server.
                const keep = withoutBlocks(source, dropOf(source));
                if (!keep) { setState(s => ({...s, [source.id]: 'saved'})); setProgress(++done); continue; }   // every block was a duplicate
                try {
                    const e = await uploadImages(keep, images.current);
                    const r = await Api.post<{saved: number}>('question_bank/save', {...e, bank: bankId});
                    added += r.saved;
                    setState(s => ({...s, [source.id]: 'saved'}));
                } catch (err) {
                    const other = (err as {bank?: {id: string; name: string}}).bank;
                    if ((err as {code?: number}).code === 409 && other) {
                        otherNow++;
                        setOtherBank(m => ({...m, [source.id]: other}));
                        setPicked(p => ({...p, [source.id]: false}));
                        setState(s => ({...s, [source.id]: 'error'}));
                    } else {
                        fails.push(failedAt(source, err));
                        setState(s => ({...s, [source.id]: 'error'}));
                        if (!(err as {code?: number}).code) break;   // connection gone: the rest stays "Chưa lưu"
                    }
                }
                setProgress(++done);
            }
            setSaveErrors(fails);
            if (!fails.length && !otherNow) {
                notify.success(`Đã thêm ${added} khối vào ngân hàng ${bankInfo?.name || ''}.`.trim());
                goTo('/question-bank/' + bankId, {imported: {exams: list.length, blocks: added}});
            }
        } catch (err) {
            notify.error('Lưu thất bại: ' + list[Math.min(done, list.length - 1)].name, errorText(err, 'Thử lại sau.'));
            if (paperBank && (out.papers.length || out.rejected.length)) setResult(out);   // keep what is already saved on screen
        } finally {
            qc.invalidateQueries({queryKey: bankKeys.all});
            setSaving(false);
        }
    };

    // Draft exams in a subject: images, exam/create, then the existing move_to_folder (create takes no folder).
    const createDrafts = async (target: string) => {
        if (!chosen.length || blocker) return;
        const name = folders?.find(f => f.id === target)?.name;
        setDirectOpen(false); setSaving(true); setProgress(0);
        let done = 0;
        try {
            for (const source of chosen) {
                const e = await uploadImages(source, images.current);
                await Api.post('exam/create', {...e, sections: withDefaultScores(e.sections as never, name)});
                await Api.post('exam/move_to_folder', {examId: e.id, folderId: target});
                setProgress(++done);
            }
            qc.invalidateQueries({queryKey: ['exam']});
            notify.success(`Đã tạo ${done} đề nháp trong môn ${name || ''}. Sửa cho hết lỗi rồi bấm Xuất bản để học sinh thấy.`);
            goTo('/subject/' + target, {created: chosen.map(e => e.id)});
        } catch (err) {
            notify.error('Tạo đề thất bại: ' + chosen[Math.min(done, chosen.length - 1)].name, errorText(err, 'Thử lại sau.'));
        } finally {
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

    const showPreview = previewing && exams.length > 0;
    const openExam = exams.find(e => e.id === openId) || exams[0];
    const openIssues = openExam ? examIssues(issues, openExam.id, renumbered[openExam.id]) : [];
    const subjectOptions = (folders || []).filter(f => !f.parent && !f.hidden).map(f => ({value: f.id, label: f.name}));
    // "Lưu lại n đề chưa lưu": after a first attempt, the exams still to go (other-bank ones are ticked off).
    const left = chosen.filter(e => state[e.id] !== 'saved' && !otherBank[e.id]).length;
    const retry = chosen.some(e => state[e.id] === 'saved' || state[e.id] === 'error');
    const openDirect = () => {
        setDirectFolder(folders?.find(f => !f.parent && f.name === bankInfo?.subject)?.id || '');
        setDirectOpen(true);
    };
    const rows: ReviewRow[] = exams.map(e => {
        const mine = examIssues(issues, e.id, renumbered[e.id]);
        const ex = dupDone?.existing[e.id];
        return {exam: e, file: fileOf.current[e.id]?.name || '', picked: !!picked[e.id], questions: countQuestions(e), blocks: blocksOf(e).length,
            severe: mine.filter(isSevere).length, light: mine.filter(i => !isSevere(i)).length + badTrueFalse(e), missing: missingKeys(e),
            dupBlocks: bankDups.filter(d => d.exam === e.id).length, sameInImport: impDups.filter(d => d.exam === e.id).length,
            state: state[e.id], note: otherBank[e.id] || (ex && !ex.same_bank) ? 'other-bank' : ex ? 'exists' : undefined};
    });
    const again = result && !allRejected ? 'Nhập tiếp' : 'Thêm file';
    return <div className={cx('vt-imp', showPreview && 'vt-imp--wide')}>
        <input type='file' accept='.docx' multiple ref={fileRef} onChange={upload} hidden/>

        <div className='vt-imp-head'>
            <div>
                {!showPreview && <Link to={bankId ? '/question-bank' : '/'} className='vt-imp-link'>← {bankId ? 'Ngân hàng câu hỏi' : 'Môn & đề'}</Link>}
                {!desktop && showPreview && <button type='button' className='vt-imp-link vt-imp-back' disabled={busy} onClick={pickFile}>← {again}</button>}
                <PageTitle>{bankId ? 'Nhập đề vào ngân hàng' : 'Nhập đề từ file Word'}</PageTitle>
                <MetaChips items={[context, paperBank ? <span className='nb-kind nb-kind--paper'>Nguyên đề</span> : bankId && <span className='nb-kind'>Theo khối</span>]}/>
            </div>
            {desktop && showPreview && <Button variant='secondary' disabled={busy} onClick={pickFile}>{again}</Button>}
        </div>

        <ol className='vt-imp-steps' aria-label='Các bước'>
            {['Tải lên', 'Xem trước', 'Lưu'].map((t, i) => {
                const now = saving || (result && !allRejected) ? 2 : showPreview ? 1 : 0;
                return <li key={t} aria-current={i === now ? 'step' : undefined} className={cx(i === now && 'on')}>{i + 1} · {t}</li>;
            })}
        </ol>

        {!showPreview && !result && <ImportUpload compact={files.length > 0} onFiles={readFiles} pick={pickFile} onGuide={() => setGuide('')}/>}

        {!showPreview && !result && files.length > 0 &&
            <ImportFiles rows={files} blockBank={!!bankId && !paperBank} onGuide={() => setGuide('')} onPreview={() => setPreviewing(true)}
                         onRemove={key => setFiles(fs => fs.filter(f => f.key !== key))}
                         onRetry={key => { const f = files.find(x => x.key === key); if (f) { replacing.current = key; readFiles([f.file]); } }}
                         onReplace={key => { replacing.current = key; pickFile(); }}
                         paperTarget={paperTarget} onGoPaper={goPaper}/>}

        {(foldersQ.isError || banksQ.isError) &&
            <ErrorState title='Không tải được danh sách môn / ngân hàng' description={errorText(foldersQ.error || banksQ.error, 'Kiểm tra mạng rồi thử lại.')}
                        onRetry={() => { if (foldersQ.isError) foldersQ.refetch(); if (banksQ.isError) banksQ.refetch(); }}/>}

        {stock && total > 0 && <Card className='vt-imp-bank'>
            <div className='vt-imp-bank-head'>
                <div>
                    <b>{bankInfo ? bankInfo.name : 'Ngân hàng câu hỏi'}: {total} khối</b>
                    <p>{drawable > 0
                        ? <>Đủ rút {drawable} đề không trùng khối{stock.bottleneck && <> · nghẽn ở <b>{blockLabel(stock.bottleneck[0])}</b></>}</>
                        : 'Chưa đủ khối để rút một đề hoàn chỉnh — nhập thêm đề bên dưới.'}</p>
                </div>
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

        {result && bankId && <PaperImportResult bankId={bankId} result={result} exams={exams} standard={standard} onPickFile={pickFile}/>}

        {showPreview && !result && <>
            {dupRun && <div className='vt-rv-banner' role='status'>
                <span><b>Đang kiểm trùng đề {dupRun.at}/{dupRun.of}</b> · {dupRun.name}</span>
                <Button variant='secondary' size='sm' onClick={() => { cancelDup.current = true; setDupRun(null); }}>Huỷ</Button>
            </div>}
            {!dupRun && dupDone && (bankDups.length + impDups.length + Object.keys(dupDone.existing).length === 0
                ? <div className='nb-ok' role='status'><b>Không có khối nào trùng.</b> Đã so với {dupDone.compared} khối trong ngân hàng và giữa các đề vừa đọc.</div>
                : <div className='vt-rv-warn' role='status'>
                    <b>Có khối trùng — mặc định không lưu.</b>
                    <span>
                        {Object.keys(dupDone.existing).length > 0 && `${Object.keys(dupDone.existing).length} đề đã có sẵn (đã bỏ chọn). `}
                        {bankDups.length > 0 && `${bankDups.length} khối trùng với đề trong ngân hàng (từ ${formatDecimal(SAME_BLOCK * 100)}%). `}
                        {impDups.length > 0 && `${impDups.length} khối trùng giữa các đề vừa nhập. `}
                        Mở từng đề để tick “Vẫn lưu” nếu muốn giữ.
                    </span>
                </div>)}
            {saveErrors.length > 0 && <div className='nb-alert' role='alert'>
                <b>Chưa lưu được {saveErrors.length} đề.</b>
                {saveErrors.map(f => <span key={f.id}>“{f.name}”{f.file && ` (file ${f.file})`}: {f.message}</span>)}
                <span>Các đề đã lưu ở trên không bị mất. Bấm “Lưu lại” để thử tiếp đề chưa lưu.</span>
            </div>}
            {Object.entries(otherBank).filter(([id]) => exams.some(e => e.id === id)).map(([id, b]) => <div key={id} className='nb-alert' role='alert'>
                <b>“{exams.find(e => e.id === id)?.name}” đã nằm trong ngân hàng khác.</b>
                <span>Mỗi đề chỉ ở một ngân hàng. Xem đề ở <Link to={'/question-bank/' + b.id}>{b.name}</Link>; ở đây đề được bỏ chọn.</span>
            </div>)}

            <div className='vt-rv'>
                <Card className='vt-rv-left'>
                    <ReviewList rows={rows} openId={openId} blockBank={!!bankId && !paperBank}
                                onOpen={setOpenId} onToggle={id => setPicked(p => ({...p, [id]: !p[id]}))} onToggleAll={toggleAll}/>
                </Card>
                {openExam && <Card className='vt-rv-pane' key={openExam.id}>
                    <div className='vt-imp-exam-row'>
                        <TextField label='Tên đề' className='vt-imp-exam-name' value={openExam.name}
                                   onChange={ev => patchExam(openExam.id)(e => ({...e, name: ev.target.value}))}/>
                        <TextField label='Phút' type='number' min={0} className='vt-imp-exam-min'
                                   value={openExam.duration === undefined ? 45 : openExam.duration}
                                   onChange={ev => patchExam(openExam.id)(e => ({...e, duration: parseInt(ev.target.value, 10) || 0}))}/>
                    </div>
                    <p className='vt-rv-count'>{countQuestions(openExam)} câu{bankId && !paperBank && ` · ${blocksOf(openExam).length} khối`}</p>
                    {dupsOf(openExam.id).length > 0 && <div className='vt-rv-dups'>
                        <h3 className='vt-imp-h2'>Khối trùng</h3>
                        {dupsOf(openExam.id).map(d => {
                            const no = blocksOf(openExam).findIndex(b => b.id === d.block) + 1;
                            const first = d.inImport ? exams.find(e => e.id === d.inImport)?.name : null;
                            return <label key={d.block} className='vt-imp-check'>
                                <input type='checkbox' checked={!!keepDup[openExam.id + d.block]}
                                       onChange={() => setKeepDup(m => ({...m, [openExam.id + d.block]: !m[openExam.id + d.block]}))}/>
                                <span>Vẫn lưu khối {no} — {first ? `trùng với đề “${first}”` : `trùng ${formatDecimal(d.score * 100)}% với ${d.with}`}</span>
                            </label>;
                        })}
                    </div>}
                    <ExamBody onFix={setGuide} exam={openExam} edit={patchExam(openExam.id)} duplicates={duplicates} pdf={pdf} desktop={desktop}
                              issues={openIssues} seen={seen} onSee={i => setSeen(m => ({...m, [issueKey(i)]: true}))}
                              canRenumber={!bankId} cut={bankId && !paperBank ? {part: i => cutLabel(openExam, i), total: blocksOf(openExam).length} : undefined}
                              renumbered={!!renumbered[openExam.id]} onRenumber={() => setRenumbered(m => ({...m, [openExam.id]: true}))}/>
                </Card>}
            </div>

            <Card className={cx('vt-imp-bar', bankId && 'vt-imp-bar--bank')} role='region' aria-label='Lưu đề'>
                {bankId ? <>
                    {!paperBank && desktop && <Button variant='secondary' disabled={!chosen.length || !!blocker || busy || checking} onClick={openDirect}>{`Tạo thẳng ${chosen.length} đề nháp`}</Button>}
                    {!paperBank && <Button variant='secondary' loading={checking} loadingText='Đang kiểm…' disabled={!chosen.length || busy} onClick={checkDuplicates}>Kiểm tra trùng</Button>}
                    <Button variant='primary' loading={saving} loadingText={`Đang lưu ${Math.min(progress + 1, left)}/${left}…`}
                            disabled={!left || !!blocker || checking} onClick={saveToBank}>
                        {retry ? `Lưu lại ${left} đề chưa lưu` : `Lưu ${chosen.length} đề`}
                    </Button>
                    {!paperBank && !desktop && <span className='vt-rv-more'>
                        <IconButton variant='outline' label='Thêm lựa chọn' aria-expanded={moreOpen} icon={<span aria-hidden='true'>⋯</span>} onClick={() => setMoreOpen(o => !o)}/>
                        {moreOpen && <div className='vt-rv-menu' role='menu'>
                            <button type='button' role='menuitem' disabled={!chosen.length || !!blocker || busy} onClick={() => { setMoreOpen(false); openDirect(); }}>{`Tạo thẳng ${chosen.length} đề nháp`}</button>
                        </div>}
                    </span>}
                </>
                : <Button variant='primary' loading={saving} loadingText={`Đang lưu ${progress + 1}/${chosen.length}…`}
                          disabled={!chosen.length || !!blocker || !folderId} onClick={() => createDrafts(folderId!)}>
                    {`Tạo ${chosen.length} đề nháp`}
                </Button>}
                {!bankId && !params.get('folder') &&
                    <Select label='Môn học' value={pickedFolder} onChange={ev => setPickedFolder(ev.target.value)}
                            placeholder='Chọn môn' options={subjectOptions}/>}
                <span className={cx('vt-imp-bar-hint', blocker && 'err')} role={blocker ? 'alert' : undefined}>
                    {unseen
                        ? <>{`Còn ${unseen} cảnh báo nặng chưa xem.`}<span className='vt-imp-bar-more'> Bấm “Đã xem, cho phép lưu” ở từng cảnh báo, hoặc sửa file Word rồi nhập lại.</span></>
                    : blocker
                        ? blocker + ' — sửa ngay trong đề, hoặc sửa file Word rồi nhập lại.'
                    : problems && !bankId
                        ? problems + ' — vẫn tạo được đề nháp; phải sửa xong mới xuất bản được.'
                    : sevenSeen > 0 && !saving ? `Đã xem ${sevenSeen} cảnh báo nặng.${lightCount ? ` ${lightCount} cảnh báo nhẹ không chặn việc lưu.` : ''}`
                    : saving ? 'Lưu lần lượt từng đề, đừng đóng trang.'
                    : !bankId && !folderId
                        ? <>Chọn môn học để tạo đề. Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</>
                    : paperBank ? 'Mỗi đề được lưu nguyên vẹn, không cắt khối và không kiểm trùng khối; đề phải cùng cấu trúc với ngân hàng.'
                    : bankId ? 'Lưu vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.' : ''}
                </span>
            </Card>

            <Modal open={directOpen} onClose={() => setDirectOpen(false)} title='Tạo thẳng đề nháp' size='md'
                   footer={<><Button variant='secondary' onClick={() => setDirectOpen(false)}>Huỷ</Button>
                       <Button variant='primary' disabled={!directFolder} onClick={() => createDrafts(directFolder)}>{`Tạo ${chosen.length} đề nháp`}</Button></>}>
                <p>Đề được tạo ở dạng Nháp trong một môn, không vào ngân hàng. Chọn môn để đặt đề.</p>
                <Select label='Môn học' value={directFolder} onChange={ev => setDirectFolder(ev.target.value)} placeholder='Chọn môn' options={subjectOptions}/>
            </Modal>
        </>}

        <ConfirmDialog open={leaveTo !== null} tone='danger' title='Rời trang này?' cancelLabel='Ở lại' confirmLabel='Rời đi'
                       message='Đề đã đọc, các chỗ đã sửa và các cảnh báo đã xác nhận sẽ mất. Muốn làm tiếp thì phải chọn file và nhập lại.'
                       onCancel={() => { if (leaveTo === 'back' && !armed.current) { history.pushState(history.state, '', location.href); armed.current = true; } setLeaveTo(null); }}
                       onConfirm={() => {
                           const to = leaveTo; setLeaveTo(null); setExams([]);
                           if (to === 'back') history.back();   // the armed entry is already popped: this goes to the previous page
                           else if (to) setTimeout(() => goTo(to), 0);
                       }}/>

        <GuideModal open={guide !== null} at={guide || undefined} onClose={() => setGuide(null)}/>
    </div>;
}
