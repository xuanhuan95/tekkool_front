import {Fragment, useEffect, useRef, useState} from 'react';
import type {MutableRefObject, ReactNode} from 'react';
import type {ChangeEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, ConfirmDialog, ErrorState, IconButton, MetaChips, Modal, PageTitle, Select, Loading, Tabs, TextField, buttonClass, cx, icons, notify}
    from '../../components/ui';
import {uploadImages} from './imageUpload';
import type {ImageCache} from './imageUpload';
import {useFolders} from '../../queries/exams';
import {bankKeys, useBanks} from '../../queries/questionBank';
import PaperImportResult, {type PaperResult, type PaperSaveReply} from '../question-bank/PaperImportResult';
import {useBankStandard} from '../question-bank/PaperStructure';
import '../question-bank/paper-bank.css';
import Api from '../../services/api';
import {errorText, formatDecimal} from '../../lib/format';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
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
import {BankAlert, DupDialog, DupNote, SaveErrorPanel, suspects, type ExistingExam, type Suspect} from './ImportAlerts';
import {ReviewList, RowMarks, cutLabel, type ReviewRow} from './ImportReview';
import {bankDuplicates, blocksOf, importDuplicates, withoutBlocks} from './dupRules';
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
function SourcePdf({pdf}: {pdf: PdfState}) {
    if (pdf.status === 'ready' && pdf.url) return <div className='v4-pdf-view'><iframe className='vt-src-pdf' src={pdf.url} title='Bản gốc của file Word'/></div>;
    if (pdf.status === 'loading' || pdf.status === 'idle') return <div className='vt-src-empty' aria-live='polite'>
        <Loading variant='inline'/>
        <p>Đang dựng bản gốc từ file Word… thường vài giây đến vài chục giây; file nhiều đề có thể lâu hơn nhiều, thậm chí không dựng được. Đề đã đọc vẫn dùng bình thường.</p>
    </div>;
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
    onFix: (anchor: string) => void; exam: ImportedExam; edit: Edit; duplicates: Record<string, DuplicateInfo>; desktop: boolean;
    /** Phone / tablet: which of the two columns is shown; a warning's "go to" and "Xem trong bản gốc" switch it. */
    onTab: (tab: 'exam' | 'pdf') => void;
    /** After "Xem lại": the suspected blocks of this exam (key = first unit id of the block) with the ticks "Không nhập khối này". */
    dups?: Record<string, {text: ReactNode; dropped: boolean; onToggle: () => void}>;
    issues: ImportIssue[]; seen: Record<string, boolean>; onSee: (i: ImportIssue) => void;
    renumbered: boolean; onRenumber: () => void;
    /** B3: into a bank the numbers are redone when an exam is drawn, so the button is only for direct creation. */
    canRenumber: boolean;
    /** Block bank: the "Khối sẽ cắt" column of the summary. */
    cut?: {part: (i: number) => string; total: number};
    plain?: boolean;
};

function ExamBody({onFix, exam, edit, duplicates, desktop, onTab, dups, issues, seen, onSee, renumbered, onRenumber, canRenumber, cut, plain}: BodyProps) {
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
        onTab('exam');
        // After the tab switch the questions are in the DOM again.
        setTimeout(() => scrollTo(i.question_id ? 'imp-' + i.question_id : sectionEl(i) || ''), 0);
    };
    const viewSource = () => { onTab('pdf'); setTimeout(() => document.querySelector('.v4-pdf')?.scrollIntoView({behavior: 'smooth'}), 0); };
    const after = numbered.length;

    let no = 0;
    return <div className='vt-imp-body'>
        <SummaryBar exam={exam} issues={issues} cut={cut} plain={plain}/>
        <IssueList compact={!desktop} issues={issues} seen={seen} onSee={onSee} jump={jump} onGo={go} onFix={onFix}/>
        <div className='vt-imp-tools'>
            <Button variant='secondary' size='sm' onClick={() => setPasting(true)}>Dán đáp án nhanh</Button>
            {canRenumber && <Button variant='secondary' size='sm' disabled={renumbered} onClick={() => setRenumbering(true)}>Đánh số lại câu</Button>}
        </div>
        {exam.sections.map((s, si) => {
            const units = toUnits(s.questions);
            // One group per bank block: a suspected block is outlined as a whole (artboard dup-review).
            const starts = new Set(blocksOf(exam).filter(b => b.section === si).map(b => b.id));
            const groups = units.reduce<QuestionUnit[][]>((g, u) => { if (starts.has(u.id) || !g.length) g.push([u]); else g[g.length - 1].push(u); return g; }, []);
            const card = (u: QuestionUnit) => {
                const i = units.indexOf(u), prev = units[i - 1];
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
            };
            return <div key={s.id} className='vt-imp-col'>
                <h3 className='vt-imp-section' id={'imp-' + s.id}>
                    {parts[si].name} · {parts[si].kind}
                    <span className='vt-imp-section-count'>đọc {parts[si].read} câu</span>
                </h3>
                {groups.map(g => {
                    const dup = dups?.[g[0].id];
                    return dup
                        ? <div key={g[0].id} className='v4-dup'>
                            <DupNote text={dup.text} others={blocksOf(exam).length - 1 - Object.entries(dups || {}).filter(([id, d]) => id !== g[0].id && d.dropped).length} dropped={dup.dropped} onToggle={dup.onToggle}/>
                            {g.map(card)}
                        </div>
                        : <Fragment key={g[0].id}>{g.map(card)}</Fragment>;
                })}
            </div>;
        })}
        {loose.map(i => <div key={issueKey(i)} className='vt-imp-missing'>
            <LevelBadge issue={i}/> <span>{i.message}</span>
            <Button variant='ghost' size='sm' onClick={viewSource}>Xem trong bản gốc</Button>
        </div>)}

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
    const paperBank = bankInfo?.kind === 'paper';   // whole exams go in as they are: no blocks
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
    /** `source_file` for question_bank/save: the .docx the exam was read from (BE keeps up to 255 characters). */
    const srcFile = (id: string) => { const n = fileOf.current[id]?.name; return n ? {source_file: n.slice(0, 255)} : {}; };
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
    const [checking, setChecking] = useState(false);   // "Đang kiểm trùng và lưu…": the check runs inside the same button press
    const [progress, setProgress] = useState(0);
    const [duplicates, setDuplicates] = useState<Record<string, DuplicateInfo>>({});
    // What the last check found: exams the bank has (per exam), the suspects the dialog lists, and "Xem lại" (marks + notes on the exams).
    const [existing, setExisting] = useState<Record<string, ExistingExam>>({});
    const [dialog, setDialog] = useState<Suspect[] | null>(null);
    const [review, setReview] = useState(false);
    // Suspected blocks are saved too ("Vẫn nhập") unless the teacher ticks "Không nhập khối này" (key = exam id + block id).
    const [dropDup, setDropDup] = useState<Record<string, boolean>>({});
    // Per exam outcome of the last save (BF-07) and the other bank an exam already lives in (BF-15).
    const [state, setState] = useState<Record<string, 'saved' | 'error' | 'pending'>>({});
    const [otherBank, setOtherBank] = useState<Record<string, {id: string; name: string}>>({});
    const [saveErrors, setSaveErrors] = useState<{id: string; name: string; file: string; message: string}[]>([]);
    // Saved screen (step 3): what went in.
    const [done, setDone] = useState<{blocks: number; total: number; since: string; items: {id: string; name: string; blocks: number}[]} | null>(null);
    const [tab, setTab] = useState<'exam' | 'pdf'>('exam');   // phone / tablet: exam read or original PDF
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
    const busy = saving || reading || checking;
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

    // A fresh start: after a save ("Nhập thêm đề" / "Nhập tiếp") or when the files are replaced.
    const clearAll = () => {
        setExams([]); setIssues([]); setSeen({}); setRenumbered({}); setDuplicates({}); setResult(null); setPicked({}); setOpenId(null);
        setState({}); setOtherBank({}); setSaveErrors([]); setDropDup({}); setExisting({}); setDialog(null); setReview(false); setDone(null);
        fileOf.current = {}; pdfFile.current = null; sinceRef.current = ''; startTotal.current = undefined;
    };
    // From the picker and from a drop on the upload zone. ponytail: sequential on purpose (a 2-core server, 20 files).
    const readFiles = async (list: File[], clear = false) => {
        if (!list.length) return;
        const rows: FileRow[] = list.map((file, i) => ({key: Date.now() + '-' + i + '-' + file.name, file, status: 'queued', exams: 0, questions: 0, skipped: 0}));
        const known = new Set<string>(clear ? [] : exams.map(e => e.id));
        if (clear) clearAll();
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
    const dirty = exams.length > 0 && !saving && !done;
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
        readFiles(list, !!result || !!done);   // after a save, "Nhập tiếp" starts over
    };

    const patchExam = (id: string): Edit => fn => setExams(es => es.map(e => e.id === id ? fn(e) : e));

    const toggleAll = () => {
        const all = exams.every(e => picked[e.id]);
        setPicked(Object.fromEntries(exams.map(e => [e.id, !all])));
    };

    // Blocks the bank already holds (BE score) or that two exams of this batch share: only suspected, saved anyway unless dropped.
    const blockBank = !!bankId && !paperBank;
    const bankDups = blockBank ? chosen.flatMap(e => bankDuplicates(e, duplicates)) : [];
    const impDups = blockBank ? importDuplicates(chosen) : [];
    const listed = suspects(bankId || '', chosen, bankDups, impDups, existing);   // what "Xem lại" marks, ticked ones included
    const suspectKey = (s: Suspect) => s.key.slice(1);
    const stillSuspect = listed.filter(s => s.key[0] === 'e' || !dropDup[suspectKey(s)]).length;
    const dropOf = (e: ImportedExam) => new Set(blocksOf(e).filter(b => dropDup[e.id + b.id]).map(b => b.id));

    /** The bar button. Check first (question_bank/check_duplicates, per exam); nothing suspected → save at once, else ask. */
    const submit = async () => {
        const list = chosen.filter(e => state[e.id] !== 'saved' && !otherBank[e.id]);
        if (!list.length || blocker || !bankId) return;
        if (retry) { saveToBank(list); return; }   // "Nhập lại n đề": the exams already went through the check
        setReview(false); setChecking(true);
        const merged: Record<string, DuplicateInfo> = {};
        const found: Record<string, ExistingExam> = {};
        try {
            for (const e of list) {
                const r = await Api.post<{duplicates?: Record<string, DuplicateInfo>; existing?: ExistingExam | null}>(
                    'question_bank/check_duplicates', {...await uploadImages(e, images.current), bank: bankId});
                Object.assign(merged, r.duplicates || {});
                if (r.existing) found[e.id] = r.existing;
            }
        } catch (err) {
            notify.error('Không kiểm được trùng lặp', errorText(err, 'Kiểm tra mạng rồi bấm nhập lại.'));
            return;
        } finally {
            setChecking(false);
        }
        // An exam that lives in ANOTHER bank cannot be saved here: ticked off, said so on the list.
        const away = Object.entries(found).filter(([, x]) => !x.same_bank && x.bank);
        away.forEach(([id, x]) => setOtherBank(m => ({...m, [id]: {id: x.bank!, name: x.bank_name || ''}})));
        setPicked(p => ({...p, ...Object.fromEntries(away.map(([id]) => [id, false]))}));
        const rest = list.filter(e => !away.some(([id]) => id === e.id));
        setDuplicates(merged); setExisting(found);
        const kept = (ds: ReturnType<typeof bankDuplicates>) => ds.filter(d => !dropDup[d.exam + d.block]);
        const items = blockBank
            ? suspects(bankId, rest, kept(rest.flatMap(e => bankDuplicates(e, merged))), kept(importDuplicates(rest)), found)
            : suspects(bankId, rest, [], [], found);
        if (items.length) setDialog(items); else if (rest.length) saveToBank(rest);
    };
    // "Xem lại": close the dialog, mark the exams, open the first suspected one at its block.
    const reviewDups = () => {
        const first = dialog?.[0]?.exam.id;
        setDialog(null); setReview(true); setTab('exam');
        if (first) { setOpenId(first); setTimeout(() => (document.querySelector('.v4-dup') || document.querySelector('.v4-exam'))?.scrollIntoView?.({behavior: 'smooth', block: 'center'}), 50); }
    };

    const failedAt = (source: ImportedExam, err: unknown) =>
        ({id: source.id, name: source.name, file: fileOf.current[source.id]?.name || '', message: err instanceof TypeError ? 'mất kết nối khi đang lưu.' : errorText(err, 'Thử lại sau.')});

    // Into the bank. Whole-exam banks send one batch; block banks save exam by exam and keep an outcome per exam (BF-07).
    const sinceRef = useRef('');
    const startTotal = useRef<number>();   // blocks the bank held before this import's first save
    const saveToBank = async (list: ImportedExam[]) => {
        setDialog(null); setSaving(true); setProgress(0); setSaveErrors([]);
        // Kept across "Lưu lại" retries so the list screen can show everything this import added.
        // 2 minutes back: the server clock may be a little behind this computer's, and a block of this import must never fall before `since`.
        if (!sinceRef.current) sinceRef.current = new Date(Date.now() - 2 * 60_000).toISOString();
        if (startTotal.current === undefined) startTotal.current = bankInfo?.items ?? 0;
        let done = 0;
        const out: PaperResult = {papers: [], rejected: [], total: bankInfo?.items ?? 0};
        try {
            if (paperBank) {
                // Whole exams: images first (one by one), then the batch in one request (BE takes 1-50 papers); a 409 carrying `rejected` = none fit.
                const papers = [];
                for (const source of list) { papers.push({...await uploadImages(source, images.current), ...srcFile(source.id)}); setProgress(++done); }
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
            let total = bankInfo?.items ?? 0, otherNow = 0;
            const went: typeof list = [];
            for (const source of list) {
                // ponytail: sequential on purpose — 20 exams x 12 questions in parallel chokes a 2-core server.
                const keep = withoutBlocks(source, dropOf(source));
                if (!keep) { setState(s => ({...s, [source.id]: 'saved'})); went.push(source); setProgress(++done); continue; }   // every block was left out
                try {
                    const e = await uploadImages(keep, images.current);
                    const r = await Api.post<{saved: number; stats?: {total?: number}}>('question_bank/save', {...e, ...srcFile(source.id), bank: bankId});
                    total = r.stats?.total ?? total + r.saved; went.push(source);
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
            if (fails.length) setOpenId(fails[0].id);   // the canvas opens the first exam that did not save, with its reason on top
            if (!fails.length && !otherNow) {
                // After a retry the earlier saves count too.
                const items = [...chosen.filter(e => state[e.id] === 'saved'), ...went]
                    .map(e => ({id: e.id, name: e.name, blocks: blocksOf(withoutBlocks(e, dropOf(e)) || e).length}));
                notify.success(`Đã nhập ${items.length} đề vào ngân hàng`);
                // An exam saved again under the same block ids overwrites them: what the bank really gained is its own before/after.
                setDone({blocks: Math.max(0, total - (startTotal.current ?? 0)), total, since: sinceRef.current, items});
                window.scrollTo({top: 0});
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
        setSaving(true); setProgress(0);
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

    const pickFile = () => fileRef.current?.click();
    const bankLabel = `${bankInfo?.name || '…'} — ${paperBank ? 'nguyên đề' : 'theo khối'}`;
    const context = bankId
        ? <>Lưu vào <b>{bankLabel}</b></>
        : folderId ? <>Tạo trong môn <b>{folder?.name || '…'}</b></> : null;

    const showPreview = previewing && exams.length > 0;
    const openExam = exams.find(e => e.id === openId) || exams[0];
    const openIssues = openExam ? examIssues(issues, openExam.id, renumbered[openExam.id]) : [];
    const subjectOptions = (folders || []).filter(f => !f.parent && !f.hidden).map(f => ({value: f.id, label: f.name}));
    // "Lưu lại n đề chưa lưu": after a first attempt, the exams still to go (other-bank ones are ticked off).
    const left = chosen.filter(e => state[e.id] !== 'saved' && !otherBank[e.id]).length;
    const away = Object.entries(otherBank).filter(([id]) => exams.some(e => e.id === id));
    const retry = chosen.some(e => state[e.id] === 'saved' || state[e.id] === 'error');
    const rowOf = (e: ImportedExam): ReviewRow => {
        const mine = examIssues(issues, e.id, renumbered[e.id]);
        const ex = review ? existing[e.id] : undefined;
        return {exam: e, file: fileOf.current[e.id]?.name || '', picked: !!picked[e.id],
            severe: mine.filter(isSevere).length, light: mine.filter(i => !isSevere(i)).length + badTrueFalse(e), missing: missingKeys(e),
            dupBlocks: review ? bankDups.filter(d => d.exam === e.id && !dropDup[d.exam + d.block]).length : 0,
            sameInImport: review ? impDups.filter(d => d.exam === e.id && !dropDup[d.exam + d.block]).length : 0,
            state: state[e.id], note: otherBank[e.id] ? 'other-bank' : ex?.same_bank ? 'exists' : undefined};
    };
    const rows = exams.map(rowOf);
    const openRow = openExam ? rows.find(r => r.exam.id === openExam.id) : undefined;
    const at = openExam ? exams.indexOf(openExam) : -1;
    const dupNotes = review && openExam ? Object.fromEntries(listed.filter(x => x.key[0] === 'b' && x.exam.id === openExam.id).map(x => [x.key.slice(1 + openExam.id.length), {
        text: x.text, dropped: !!dropDup[suspectKey(x)], onToggle: () => setDropDup(m => ({...m, [suspectKey(x)]: !m[suspectKey(x)]}))}])) : undefined;
    const failure = openExam && state[openExam.id] === 'error' || openExam && state[openExam.id] === 'pending'
        ? (saveErrors.find(f => f.id === openExam.id)?.message || 'dừng sau lỗi ở đề trước').replace(/\.$/, '') : null;
    const again = result && !allRejected ? 'Nhập tiếp' : 'Thêm file';
    const step = done || (result && !allRejected) || (retry && !saving) ? 2 : saving || checking || showPreview ? 1 : 0;
    const read = files.reduce((n, f) => n + f.exams, 0);
    const readingNow = files.filter(f => f.status === 'queued' || f.status === 'reading').length;
    const blocksAll = chosen.reduce((n, e) => n + blocksOf(e).length, 0);
    const label = bankId && retry && left > 0 ? `Nhập lại ${left} đề` : desktop ? `Nhập ${chosen.length} đề vào ngân hàng` : `Nhập ${chosen.length} đề`;
    const startAgain = () => { clearAll(); setFiles([]); setPreviewing(false); setTab('exam'); };
    const noPaperSubject = bankInfo?.subject ? ` môn ${bankInfo.subject.replace(/^môn\s+/i, '')}` : ' môn này';
    return <div className={cx('vt-imp', bankId && 'vt-imp--wide')}>
        <input type='file' accept='.docx' multiple ref={fileRef} onChange={upload} hidden/>

        <div className='v4-head'>
            <div className='vt-imp-head'>
                <div>
                    <Link to={bankId ? '/question-bank/' + bankId : '/'} className='vt-imp-link'>← {bankId ? bankLabel : 'Môn & đề'}</Link>
                    <PageTitle>{bankId ? 'Nhập đề vào ngân hàng' : 'Nhập đề từ file Word'}</PageTitle>
                    <MetaChips items={[context, paperBank ? <Badge tone='title'>Nguyên đề</Badge> : bankId && <Badge tone='title'>Theo khối</Badge>]}/>
                </div>
                {showPreview && !done && <Button variant='secondary' disabled={busy} onClick={pickFile}>{again}</Button>}
            </div>
            <ol className='vt-imp-steps' aria-label='Các bước'>
                {['Tải lên', 'Xem trước', 'Lưu'].map((t, i) => <li key={t} aria-current={i === step ? 'step' : undefined} className={cx(i === step && 'on')}>{i + 1} · {t}</li>)}
            </ol>
        </div>

        {!showPreview && !result && !done && (files.length === 0
            ? <ImportUpload onFiles={readFiles} pick={pickFile} onGuide={() => setGuide('')}/>
            : <div className='v4-up'>
                <div className='v4-col'>
                    <ImportUpload compact brief={files.some(f => f.shared)} onFiles={readFiles} pick={pickFile} onGuide={() => setGuide('')}/>
                    {files.some(f => f.shared) && !paperTarget && <BankAlert tone='info' title={`Chưa có ngân hàng nguyên đề${noPaperSubject}?`}
                        acts={<Link className={buttonClass({variant: 'secondary', size: 'sm'})} to='/question-bank'>Tạo ngân hàng nguyên đề</Link>}>
                        Tạo ở trang Ngân hàng câu hỏi, chọn loại “Nguyên đề”, rồi nhập lại file này.
                    </BankAlert>}
                </div>
                <ImportFiles rows={files} blockBank={blockBank} onGuide={() => setGuide('')}
                             onRemove={key => setFiles(fs => fs.filter(f => f.key !== key))}
                             onRetry={key => { const f = files.find(x => x.key === key); if (f) { replacing.current = key; readFiles([f.file]); } }}
                             onReplace={key => { replacing.current = key; pickFile(); }}
                             paperTarget={paperTarget} onGoPaper={goPaper}/>
            </div>)}

        {!showPreview && !result && !done && files.length > 0 && <Card className='vt-imp-bar' role='region' aria-label='Xem trước'>
            <span className='vt-imp-bar-hint'>{readingNow ? <>Đọc xong <b>{read} đề</b> · còn {readingNow} file đang đọc</>
                : files.some(f => f.shared) ? <>Đọc xong <b>{read} đề</b> nhập được</> : <>Đọc xong <b>{read} đề</b></>}</span>
            <Button variant='primary' disabled={!!readingNow || read === 0} onClick={() => setPreviewing(true)}>Xem trước {read} đề</Button>
        </Card>}

        {(foldersQ.isError || banksQ.isError) &&
            <ErrorState title='Không tải được danh sách môn / ngân hàng' description={errorText(foldersQ.error || banksQ.error, 'Kiểm tra mạng rồi thử lại.')}
                        onRetry={() => { if (foldersQ.isError) foldersQ.refetch(); if (banksQ.isError) banksQ.refetch(); }}/>}

        {result && bankId && <PaperImportResult bankId={bankId} result={result} exams={exams} standard={standard} onPickFile={pickFile}/>}

        {done && bankId && <div className='v4-done'>
            <Card className='v4-done-main' role='status'>
                <h2><icons.IconCheckCircle size={22} color='var(--vt-ok-ink)'/>Đã nhập {done.items.length} đề vào ngân hàng</h2>
                <p><b>{bankInfo?.name}</b> có thêm {done.blocks} khối, giờ có {done.total} khối.</p>
                <div className='v4-acts'>
                    <Button variant='primary' onClick={() => goTo('/question-bank/' + bankId, {imported: {exams: done.items.length, blocks: done.blocks, since: done.since,
                        files: Array.from(new Set(done.items.map(x => fileOf.current[x.id]?.name).filter(Boolean))) as string[]}})}>Xem ngân hàng</Button>
                    <Button variant='secondary' onClick={startAgain}>Nhập thêm đề</Button>
                </div>
            </Card>
            <Card>
                <div className='vt-imp-files-head'>
                    <h2 className='v4-h2'>{done.items.length} đề đã nhập</h2>
                    <Badge tone='ok'>{done.blocks} khối</Badge>
                </div>
                <ul className='v4-saved'>
                    {done.items.map(x => <li key={x.id}><icons.IconCheck size={16}/><span>{x.name}</span><span className='v4-muted'>{x.blocks} khối</span></li>)}
                </ul>
            </Card>
        </div>}

        {showPreview && !result && !done && <>
            {paperBank && <BankAlert tone='info' title='Ngân hàng nguyên đề lưu nguyên cả đề, không cắt khối'>
                Đề lệch cấu trúc với ngân hàng sẽ được báo và không nhập.
            </BankAlert>}
            {bankId && !saving && left > 0 && (saveErrors.length > 0 || chosen.some(e => state[e.id] === 'pending')) &&
                <SaveErrorPanel saved={chosen.filter(e => state[e.id] === 'saved').length} total={chosen.length} left={left} bankId={bankId}
                                lines={[...saveErrors, ...chosen.filter(e => state[e.id] === 'pending' && !saveErrors.some(f => f.id === e.id))
                                    .map(e => ({id: e.id, name: e.name, file: fileOf.current[e.id]?.name || '', message: 'chưa lưu vì dừng sau lỗi trên.'}))]}/>}
            {[...new Map(away.map(([, x]) => [x.id, x])).values()].map(b => {
                const names = away.filter(([, x]) => x.id === b.id).map(([id]) => exams.find(e => e.id === id)!.name);
                return <BankAlert key={b.id} tone='sun' role='alert' title={names.length > 1 ? `${names.length} đề đã nằm trong ngân hàng khác.` : `“${names[0]}” đã nằm trong ngân hàng khác.`}>
                    Mỗi đề chỉ ở một ngân hàng. {names.length > 1 && `${names.join(', ')}. `}Xem đề ở <Link className='vt-imp-link' to={'/question-bank/' + b.id}>{b.name}</Link>; ở đây đề được bỏ chọn.
                </BankAlert>;
            })}

            {openExam && openRow && <div className='v4-pick'><Card>
                <div className='v4-pick-row'>
                    <IconButton variant='outline' label='Đề trước' icon={<span aria-hidden='true'>‹</span>} disabled={at <= 0} onClick={() => setOpenId(exams[at - 1].id)}/>
                    <Select label={`Đang xem đề ${at + 1}/${exams.length}`} value={openExam.id} onChange={ev => setOpenId(ev.target.value)}
                            options={exams.map(e => ({value: e.id, label: e.name}))}/>
                    <IconButton variant='outline' label='Đề sau' icon={<span aria-hidden='true'>›</span>} disabled={at >= exams.length - 1} onClick={() => setOpenId(exams[at + 1].id)}/>
                </div>
                <div className='v4-pick-row v4-pick-row--check'>
                    <label className='vt-bk-check'>
                        <input type='checkbox' checked={!!picked[openExam.id]} onChange={() => setPicked(p => ({...p, [openExam.id]: !p[openExam.id]}))}/>
                        Nhập đề này · {chosen.length}/{exams.length} đề sẽ nhập
                    </label>
                    <RowMarks r={openRow}/>
                </div>
            </Card></div>}
            <Tabs className='v4-tabs' aria-label='Xem' block value={tab} onChange={setTab}
                  items={[{value: 'exam', label: 'Đề đã đọc'}, {value: 'pdf', label: 'Bản gốc (PDF)'}]}/>

            <div className='v4-split' data-tab={tab}>
                <div className='v4-col v4-list'>
                    <Card>
                        <ReviewList rows={rows} openId={openId} onOpen={setOpenId} onToggle={id => setPicked(p => ({...p, [id]: !p[id]}))} onToggleAll={toggleAll}/>
                    </Card>
                </div>
                {openExam && <div className='v4-col v4-exam'>
                    <div className='v4-colhead v4-colhead--tabbed'><h2>Đề đã đọc</h2><span>sửa tại chỗ</span></div>
                    <Card className='vt-rv-pane' key={openExam.id}>
                        {failure && <BankAlert tone='err' role='alert' title={'Đề này chưa lưu: ' + failure}>Bấm “{label}” ở dưới. Chỗ đã sửa trên đề vẫn giữ.</BankAlert>}
                        <div className='vt-imp-exam-row'>
                            <TextField label='Tên đề' className='vt-imp-exam-name' value={openExam.name}
                                       onChange={ev => patchExam(openExam.id)(e => ({...e, name: ev.target.value}))}/>
                            {bankId
                                ? <span className='vt-imp-exam-meta'>{countQuestions(openExam)} câu{blockBank && ` · ${blocksOf(openExam).length} khối`}</span>
                                : <TextField label='Phút' type='number' min={0} className='vt-imp-exam-min'
                                             value={openExam.duration === undefined ? 45 : openExam.duration}
                                             onChange={ev => patchExam(openExam.id)(e => ({...e, duration: parseInt(ev.target.value, 10) || 0}))}/>}
                        </div>
                        <ExamBody onFix={setGuide} exam={openExam} edit={patchExam(openExam.id)} duplicates={duplicates} desktop={desktop} onTab={setTab} dups={dupNotes}
                                  issues={openIssues} seen={seen} onSee={i => setSeen(m => ({...m, [issueKey(i)]: true}))}
                                  canRenumber={!bankId} cut={blockBank ? {part: i => cutLabel(openExam, i), total: blocksOf(openExam).length} : undefined} plain={paperBank}
                                  renumbered={!!renumbered[openExam.id]} onRenumber={() => setRenumbered(m => ({...m, [openExam.id]: true}))}/>
                    </Card>
                </div>}
                {openExam && <div className='v4-col v4-pdf'>
                    <div className='v4-colhead v4-colhead--tabbed'><h2>Bản gốc (PDF)</h2><span>để so với đề đã đọc</span></div>
                    <Card className='v4-pdf-card'>
                        <div className='v4-pdf-bar'>
                            <span><b>{fileOf.current[openExam.id]?.name}</b> · {openExam.name}</span>
                            {pdf.status === 'ready' && pdf.url && <a className={buttonClass({variant: 'secondary', size: 'sm'})} href={pdf.url} target='_blank' rel='noopener'>Mở toàn màn hình</a>}
                        </div>
                        <SourcePdf pdf={pdf}/>
                    </Card>
                </div>}
            </div>

            <Card className={cx('vt-imp-bar', bankId && 'vt-imp-bar--bank')} role='region' aria-label='Nhập đề'>
                {bankId
                    ? <Button variant='primary' className='vt-bk-bar-main' loading={saving || checking} loadingText='Đang kiểm trùng và lưu…'
                              disabled={!left || !!blocker || reading} onClick={submit}>{label}</Button>
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
                    : checking ? `Đang kiểm ${blocksAll} khối với ngân hàng và giữa các đề vừa nhập`
                    : saving ? 'Lưu lần lượt từng đề, đừng đóng trang.'
                    : bankId && retry && left > 0 ? <><b>{left} đề</b> chưa lưu</>
                    : review && stillSuspect > 0 ? <>Còn <b>{stillSuspect} chỗ nghi trùng</b> · bỏ chọn hoặc sửa rồi bấm nhập</>
                    : !bankId && !folderId
                        ? <>Chọn môn học để tạo đề. Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</>
                    : paperBank ? 'Nguyên đề: mỗi lượt học sinh rút nguyên 1 đề, giữ thứ tự câu.'
                    : bankId ? `${chosen.length} đề sẽ nhập · hệ thống tự kiểm trùng khi bạn bấm nhập` : ''}
                </span>
            </Card>

            <DupDialog open={dialog !== null} items={dialog || []} total={chosen.length} onKeep={() => saveToBank(chosen.filter(e => state[e.id] !== 'saved' && !otherBank[e.id]))} onReview={reviewDups}/>
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
