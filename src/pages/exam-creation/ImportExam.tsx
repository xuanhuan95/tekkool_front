import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import {Editor} from '../../components/Editor';
import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, DesktopOnly, Modal, PageTitle, ProgressBar, Select, Table, TextField, buttonClass, cx, notify}
    from '../../components/ui';
import type {Column} from '../../components/ui';
import {useFolders} from '../../queries/exams';
import {bankKeys, useBankStock, useBanks} from '../../queries/questionBank';
import Api from '../../services/api';
import {errorText} from '../../lib/format';
import {blockLabel} from './blockTypes';
import {
    badTrueFalse, countQuestions, examStats, fileProblem, importErrorText, isBadTrueFalse, isChoice, isMissingKey, missingKeys,
    patchData, patchQuestion, removeQuestions, saveBlocker, setAnswer, setPassage, setType, toUnits, TRUE_FALSE_STATEMENTS,
    type DuplicateInfo, type ImportedExam, type NumberedUnit, type QuestionUnit,
} from './importRules';
import './import-exam.css';

// The parser can only guess pick-one / free answer (has A.B.C.D. or not); the rest the teacher picks.
const QUESTION_TYPES = [
    {value: 'MultipleChoice', label: 'Trắc nghiệm'},
    {value: 'TrueFalse', label: 'Đúng/Sai'},
    {value: 'FillBlank', label: 'Trả lời ngắn'},
    {value: 'FreeAnswer', label: 'Tự luận'},
    {value: 'ErrorIdentify', label: 'Tìm lỗi sai'},
];

type Edit = (fn: (e: ImportedExam) => ImportedExam) => void;

/**
 * Right column: the Word file's own lines (already escaped by the backend) so a teacher can see where
 * the parser misread. ponytail: plain regex, 3 token kinds — no highlight library.
 */
function highlight(html: string) {
    // A marker counts only at the START of a line: "Những Câu chuyện này…" mid-line is not one.
    const head = html.match(
        /^(?:<b>)?\s*(?:(Câu\s*\d*[^.:<]{0,18}(?:<\/b>)?\s*[.:])|((?:Phần\s*\d*[^.:<]{0,18}(?:<\/b>)?\s*[.:])|(?:VĂN BẢN|ĐỀ SỐ)\s*\d+(?:<\/b>)?|ĐÁP\s*ÁN(?:<\/b>)?))/
    );
    if (head) return `<em class="${head[1] ? 'src-q' : 'src-h'}">${head[0]}</em>${html.slice(head[0].length)}`;
    return html.replace(/(^|<br>|\s)([A-D]\s*\.)(\s)/g, '$1<em class="src-a">$2</em>$3');
}

function SourceView({lines}: {lines?: string[]}) {
    if (!lines || !lines.length) return <div className='vt-src vt-src-empty'>Không có văn bản gốc cho đề này.</div>;
    return <div className='vt-src'>
        {lines.map((t, i) => <div key={i} className='vt-src-line'>
            <span className='vt-src-no'>{i + 1}</span>
            {/* backend escapes every line; highlight only adds <em> */}
            <span className='vt-src-text' dangerouslySetInnerHTML={{__html: highlight(t)}}/>
        </div>)}
    </div>;
}

/** Duplicate rate: never red — a warning to read, not an error to fix (same-template questions measure 80–90%). */
function DuplicateChip({info}: {info?: DuplicateInfo}) {
    if (!info) return null;
    const matches = info.khop.map(k => (k.trong_file ? 'trong file này' : (k.khoi || k.id)) + ' — ' + (k.score * 100).toFixed(2) + '%').join('\n');
    return <span className={cx('vt-imp-dup', info.score >= 0.95 ? 'high' : info.score >= 0.8 && 'mid')} title={'Trùng với:\n' + matches}>
        Tỷ lệ trùng: {(info.score * 100).toFixed(2)}%
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
    </div>;
}

function ExamBody({exam, edit, duplicates}: {exam: ImportedExam; edit: Edit; duplicates: Record<string, DuplicateInfo>}) {
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
        <div className='vt-imp-col'>
            <div className='vt-imp-col-head'>Văn bản gốc trong file Word</div>
            <SourceView lines={exam.source}/>
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
    const folderId = params.get('folder');
    const navigate = useNavigate();
    const qc = useQueryClient();

    const {data: banks} = useBanks();
    const {data: folders} = useFolders(!!folderId);
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

    const chosen = exams.filter(e => picked[e.id]);
    const blocker = saveBlocker(chosen);
    const busy = saving || reading;

    const upload = async ({target}: ChangeEvent<HTMLInputElement>) => {
        const file = target.files && target.files[0];
        if (!file) return;
        setFileName(file.name);
        setExams([]); setWarnings([]); setDuplicates({});
        const bad = fileProblem(file);
        if (bad) { setProblem(bad); target.value = ''; return; }
        setProblem(null); setReading(true);
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
                const r = await Api.post<{trung?: Record<string, DuplicateInfo>}>('question_bank/check_trung', {...e, bank: bankId});
                Object.assign(merged, r.trung || {});
            }
            setDuplicates(merged);
        } catch {
            notify.error('Không đo được trùng lặp. Vẫn lưu được bình thường.');
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
            for (const e of chosen) {
                if (toBank) {
                    const r = await Api.post<{saved: number}>('question_bank/save', {...e, bank: bankId});
                    added += r.saved;
                } else {
                    await Api.post('exam/create', e);
                    // exam/create takes no folder → the existing move_to_folder.
                    if (folderId) await Api.post('exam/move_to_folder', {examId: e.id, folderId});
                }
                setProgress(++done);
            }
            if (toBank) {
                notify.success(`Đã thêm ${added} khối vào ngân hàng. Số liệu sức chứa ở trên đã cập nhật.`);
            } else if (folderId) {
                qc.invalidateQueries({queryKey: ['exam']});
                navigate('/subject/' + folderId);
            } else {
                qc.invalidateQueries({queryKey: ['exam']});
                notify.success(`Đã tạo ${done} đề. Đề đang ở 'Đề ngoài thư mục' — chọn môn để học sinh thấy.`);
                navigate('/question-bank');
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
        ? <>lưu vào ngân hàng <b>{bankInfo?.name || '…'}</b></>
        : folderId ? <>tạo trong môn <b>{folder?.name || '…'}</b></> : null;
    const direct = (label: string) => `${label} ${chosen.length} đề`;

    return <DesktopOnly backTo='/question-bank'>
        <div className='vt-imp'>
            <input type='file' accept='.docx' ref={fileRef} onChange={upload} hidden/>

            <div className='vt-imp-head'>
                <div>
                    <PageTitle>Nhập đề từ file Word</PageTitle>
                    <p>Xem trước rồi mới lưu — chưa ghi vào hệ thống{context && <> · {context}</>}</p>
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
                        {open && <ExamBody exam={exam} edit={patchExam(exam.id)} duplicates={duplicates}/>}
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
                              disabled={!chosen.length || !!blocker} onClick={() => save(false)}>
                        {folderId ? `Tạo ${chosen.length} đề trong ${folder?.name || 'môn này'}` : direct('Tạo thẳng')}
                    </Button>}
                <span className={cx('vt-imp-bar-hint', blocker && 'err')} role={blocker ? 'alert' : undefined}>
                    {blocker
                        ? blocker + ' — sửa ngay trong đề, hoặc sửa file Word rồi nhập lại.'
                        : saving ? 'Lưu lần lượt từng đề, đừng đóng trang.'
                        : !bankId && !folderId
                            ? <>Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</>
                        : Object.keys(duplicates).length
                            ? `Có ${Object.keys(duplicates).length} câu trùng với ngân hàng — xem chip trên từng câu rồi tự quyết.`
                        : bankId ? 'Vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.' : ''}
                </span>
            </Card>}

            <ExamInfoModal exam={exams.find(e => e.id === infoId)} onClose={() => setInfoId(null)}
                           onJump={x => infoId && jumpTo(infoId, x)}/>
        </div>
    </DesktopOnly>;
}
