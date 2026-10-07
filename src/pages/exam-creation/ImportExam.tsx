import React, {Component} from 'react';
import {Button, Checkbox, Dropdown, Header, Icon, Input, Label, Message, Modal, Radio, Segment, Table} from 'semantic-ui-react';
import type {SemanticCOLORS} from 'semantic-ui-react';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import {Editor} from '../../components/Editor';
import Api from '../../services/api';
import {blockLabel} from './blockTypes';
import {convertData, type QuestionData} from './convertData';
import type {RouterProps} from '../../withRouter';
import type {BankCapacity, Folder, QuestionBank} from '../../types/exam';


/**
 * Exam as returned by `import_docx/preview` — NOT saved yet, and exactly the
 * payload that will be sent to `exam/create`. Unlike the editor's `Exam`, it
 * also carries `source` (the original text in the Word file) to build the right column.
 */
type ImportQuestion = {id: string; type: string; data: QuestionData};

type ImportSection = {
    id: string;
    name: string;
    question_type?: string;
    questions: ImportQuestion[];
};

type ImportedExam = {
    id: string;
    name: string;
    duration?: number;
    sections: ImportSection[];
    /** Each line of the original text, already escaped by the backend. */
    source?: string[];
};

/** Duplicate-check result for ONE question — `question_bank/check_trung`. */
type DuplicateInfo = {
    score: number;
    khop: Array<{id?: string; khoi?: string; score: number; trong_file?: boolean}>;
};


/** Pull the error message out of an Api exception — the three endpoints here use three different fields. */
const errorMessage = (e: any, fallback: string) =>
    (e && (e.message || e.description || e.error)) || fallback;


// Right column: original text from the Word file, with line numbers and
// highlighted keywords so teachers can spot where the parser misread.
// The string is already escaped by the backend.
// ponytail: highlight with plain regex, no extra highlight library —
// only 3 token kinds to tell apart.
function highlight(html: string) {
    // A structural marker only counts at the START of a line: 'Nhung Cau chuyen nay...'
    // mid-line is not a marker. Highlight up to the period/colon if any, otherwise
    // the whole 'VAN BAN 2' / 'DE SO 5' phrase. Allow </b> in between because
    // Word's bold marker wraps the keyword right away.
    let head = html.match(
        /^(?:<b>)?\s*(?:(?:Câu|Phần)\s*\d*[^.:<]{0,18}(?:<\/b>)?\s*[.:]|(?:VĂN BẢN|ĐỀ SỐ)\s*\d+(?:<\/b>)?|ĐÁP\s*ÁN(?:<\/b>)?)/
    );
    if (head) return '<em class="src-q">' + head[0] + '</em>' + html.slice(head[0].length);
    return html.replace(/(^|<br>|\s)([A-D]\s*\.)(\s)/g, '$1<em class="src-a">$2</em>$3');
}

function SourceView({lines}: {lines?: string[]}) {
    if (!lines || !lines.length)
        return <div className='src-empty'>Không có văn bản gốc cho đề này.</div>;

    return <div className='src-view'>
        {lines.map((t, i) => <div key={i} className='src-line'>
            <span className='src-no'>{i + 1}</span>
            <span className='src-text' dangerouslySetInnerHTML={{__html: highlight(t)}}/>
        </div>)}
    </div>;
}


// ponytail: do NOT reuse MultipleChoiceAnswer — it hardcodes name='answer'
// (MultipleChoiceAnswer.jsx:61), and this screen shows 20 exams at once so every
// radio would share ONE group: picking the answer of question 2 unpicks question 1.
// Radios here take their name from question.id.
type AnswersProps = {
    question: ImportQuestion;
    onPick: (answerId: string) => void;
    onEdit: (answerId: string, value: string) => void;
};

function Answers({question, onPick, onEdit}: AnswersProps) {
    let {answers = [], correctAnswerId} = question.data;

    return answers.map((a, i) =>
        <div key={a.id} className='answer-row'>
            <Radio name={'ans-' + question.id} value={a.id}
                   checked={correctAnswerId === a.id}
                   onChange={() => onPick(a.id)}/>
            <span className='answer-key'>{String.fromCharCode(65 + i)}.</span>
            <div className='answer-body'>
                <Editor text={a.value} disableReturn disableStyle
                        onChange={html => onEdit(a.id, html)}/>
            </div>
        </div>
    );
}


// Question types that can be switched at import time. The parser can only guess
// multiple choice / free answer (has A.B.C.D. or not); the other three are
// picked by the teacher.
const QUESTION_TYPES = [
    {key: 'MultipleChoice', text: 'Trắc nghiệm'},
    {key: 'FreeAnswer', text: 'Tự luận'},
    {key: 'TrueFalse', text: 'Đúng / Sai'},
    {key: 'FillBlank', text: 'Điền vào chỗ trống'},
    {key: 'ErrorIdentify', text: 'Tìm lỗi sai'},
];

// ponytail: `data.answer` means DIFFERENT things per type — TrueFalse.jsx reads it
// as a boolean, FillBlank.jsx as an HTML string. Switching type while spreading the
// old data whole makes TrueFalse swallow an HTML string -> neither radio is checked,
// the teacher thinks nothing is picked, and auto-grading is wrong after saving.
// So keep only the shared part and drop the type-specific part.
type State = {
    loading: boolean;
    error: string | null;
    exams: ImportedExam[];
    warnings: string[];
    /** exam id -> ticked or not. */
    picked: Record<string, boolean>;
    openId: string | null;
    infoId: string | null;
    saving: boolean;
    progress: number;
    folder: Folder | null;
    bankInfo: QuestionBank | null;
    duplicates: Record<string, DuplicateInfo>;
    checkingDuplicates: boolean;
    /** Number of blocks just added, for the hint line. The old version was missing from the initial state. */
    banked: number;
    /** Stock of the bank being imported into. null = no ?bank= or load failed. */
    bank: BankCapacity | null;
};

class ImportExam extends Component<RouterProps, State> {
    state: State = {
        loading: false,
        error: null,
        exams: [],
        warnings: [],
        picked: {},
        openId: null,    // only ONE exam open at a time (see toggleOpen)
        infoId: null,    // exam whose 'Exam info' modal is showing
        saving: false,
        progress: 0,
        folder: null,
        bankInfo: null,
        duplicates: {},  // question id -> {score, khop[]}; only shows numbers, doesn't block saving
        checkingDuplicates: false,
        banked: 0,
        bank: null,
    };

    // The bank comes from ?bank= — an entity with a name and a subject, created by
    // the teacher. Before, the subject had to be guessed from the FOLDER NAME: importing
    // outside a folder left the subject empty, every block went into one shared
    // basket, and no bank could be told apart from another.
    bankId = () => new URLSearchParams(this.props.location.search).get('bank');

    componentDidMount = async () => {
        let id = new URLSearchParams(this.props.location.search).get('folder');
        if (id) {
            const folders: Folder[] = await Api.get('folder/list');
            this.setState({folder: folders.find(f => f.id === id) || null});
        }
        if (this.bankId()) {
            const banks: QuestionBank[] = await Api.get('question_bank/list');
            this.setState({bankInfo: banks.find(b => b.id === this.bankId()) || null});
        }
        this.loadBank();
    };

    refFile = React.createRef<HTMLInputElement>();

    pickFile = () => this.refFile.current && this.refFile.current.click();

    upload = async ({target}: React.ChangeEvent<HTMLInputElement>) => {
        const file = target.files && target.files[0];
        if (!file) return;

        this.setState({loading: true, error: null, exams: [], warnings: []});

        try {
            const res: {exams: ImportedExam[]; warnings?: string[]} =
                await Api.upload('import_docx/preview', file);
            // ponytail: tick ALL by default. With a 20-exam file, unticking all
            // takes 20 clicks for the teacher; dropping a few exams is easier than
            // re-picking from scratch.
            const picked: Record<string, boolean> = {};
            res.exams.forEach(e => picked[e.id] = true);
            // Open the first exam so it's obvious it can be viewed/edited, no hunting around.
            let openId = res.exams.length ? res.exams[0].id : null;
            this.setState({exams: res.exams, warnings: res.warnings || [], picked, openId});
        } catch (e) {
            this.setState({error: errorMessage(e, 'Không đọc được file')});
        } finally {
            target.value = '';   // allow re-selecting the very same file
            this.setState({loading: false});
        }
    };

    toggle = (id: string) => this.setState(({picked}) => ({picked: {...picked, [id]: !picked[id]}}));

    // ponytail: open only ONE exam. Each editing box is a TipTap instance; 20 exams x
    // 12 questions x (1 body + 4 answers) ~ 1200 ProseMirror views -> the browser
    // chokes. One exam is ~60, runs smoothly.
    toggleOpen = (id: string) => this.setState(({openId}) => ({openId: openId === id ? null : id}));

    toggleAll = () => {
        let {exams, picked} = this.state;
        let all = exams.every(e => picked[e.id]);
        const next: Record<string, boolean> = {};
        exams.forEach(e => next[e.id] = !all);
        this.setState({picked: next});
    };

    // ponytail: edit IN PLACE on state.exams — this payload is exactly what gets
    // sent to exam/create, no intermediate shape needed.
    patchExam = (examId: string, fn: (exam: ImportedExam) => ImportedExam) => this.setState(({exams}) => ({
        exams: exams.map(e => e.id === examId ? fn({...e}) : e),
    }));

    patchQuestion = (examId: string, qid: string, fn: (q: ImportQuestion) => ImportQuestion) => this.patchExam(examId, exam => {
        exam.sections = exam.sections.map(s => ({
            ...s,
            questions: s.questions.map(q => q.id === qid ? fn({...q}) : q),
        }));
        return exam;
    });

    setName = (examId: string, name: string) => this.patchExam(examId, e => ({...e, name}));

    setBody = (examId: string, qid: string, html: string) =>
        this.patchQuestion(examId, qid, q => ({...q, data: {...q.data, question: html}}));

    // ponytail: changing type must update section.question_type TOO — the BE stores
    // this field (core_docx takes it from the section's first question) and the
    // editor reads it to know what kind this section is. Changing only q.type leaves
    // the section tagged with the wrong type.
    setType = (examId: string, qid: string, type: string) => this.patchExam(examId, exam => {
        exam.sections = exam.sections.map(s => {
            if (!s.questions.some(q => q.id === qid)) return s;

            let questions = s.questions.map(q =>
                q.id === qid ? {...q, type, data: convertData(q.data, type)} : q);

            return {...s, questions, question_type: questions[0].type};
        });
        return exam;
    });

    // ponytail: the passage is a COPY inside each question of the group, so an edit
    // must be written back to the WHOLE GROUP by passageId. Editing only the first
    // question leaves questions 2-5 with the old copy -> after saving, students read
    // the unedited text.
    setPassage = (examId: string, passageId: string | undefined, html: string) => this.patchExam(examId, exam => {
        exam.sections = exam.sections.map(sec => ({
            ...sec,
            questions: sec.questions.map(q => q.data.passageId === passageId
                ? {...q, data: {...q.data, passage: html}} : q),
        }));
        return exam;
    });

    setCorrect = (examId: string, qid: string, answerId: string) =>
        this.patchQuestion(examId, qid, q => ({...q, data: {...q.data, correctAnswerId: answerId}}));

    setAnswer = (examId: string, qid: string, answerId: string, value: string) =>
        this.patchQuestion(examId, qid, q => ({
            ...q,
            data: {
                ...q.data,
                answers: (q.data.answers || []).map(a => a.id === answerId ? {...a, value} : a),
            },
        }));

    removeQuestion = (examId: string, qid: string) => this.patchExam(examId, exam => {
        exam.sections = exam.sections
            .map(s => ({...s, questions: s.questions.filter(q => q.id !== qid)}))
            .filter(s => s.questions.length);   // drop empty sections
        return exam;
    });

    countQuestions = (exam: ImportedExam) => exam.sections.reduce((n, s) => n + s.questions.length, 0);

    // Multiple-choice question with no correct answer picked -> auto-grading always gives 0.
    missingKeys = (exam: ImportedExam) => exam.sections.reduce((n, s) =>
        n + s.questions.filter(q => q.type === 'MultipleChoice' && !q.data.correctAnswerId).length, 0);

    // Stats for the "Exam info" modal: group questions by each criterion.
    examStats = (exam: ImportedExam) => {
        const all: Array<{q: ImportQuestion; s: ImportSection; no: number}> = [];
        exam.sections.forEach(s => s.questions.forEach((q, i) => all.push({q, s, no: i + 1})));

        const rows: Array<[string, typeof all]> = [
            ['Tổng số câu trắc nghiệm', all.filter(x => x.q.type === 'MultipleChoice')],
            ['Tổng số câu tự luận', all.filter(x => x.q.type !== 'MultipleChoice')],
            ['Câu trắc nghiệm chưa có đáp án đúng',
                all.filter(x => x.q.type === 'MultipleChoice' && !x.q.data.correctAnswerId)],
            ['Câu không đủ 4 lựa chọn',
                all.filter(x => x.q.type === 'MultipleChoice' && (x.q.data.answers || []).length !== 4)],
            ['Câu nội dung rỗng',
                all.filter(x => !String(x.q.data.question || '').replace(/<[^>]*>/g, '').trim())],
        ];
        return {total: all.length, rows: rows.filter(r => r[1].length)};
    };

    // ponytail: scroll to a question by DOM id instead of ref — keeping refs for 240
    // questions means managing a ref map, while the id is already in the payload.
    jumpTo = (examId: string, qid: string) => {
        this.setState({infoId: null, openId: examId}, () => {
            let el = document.getElementById('imp-' + qid);
            if (el) {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                el.classList.add('flash');
                setTimeout(() => el.classList.remove('flash'), 1200);
            }
        });
    };

    // Measure duplication against questions already in the bank. Only shows numbers —
    // the importer decides whether to save, just like Azota. Called separately rather
    // than merged into save: once measured, the teacher can still look before clicking Save.
    checkDuplicates = async () => {
        let chosen = this.state.exams.filter(e => this.state.picked[e.id]);
        if (!chosen.length) return;
        this.setState({checkingDuplicates: true});
        try {
            let merged = {};
            for (let e of chosen) {
                let r = await Api.post('question_bank/check_trung',
                    {...e, bank: this.bankId()});
                Object.assign(merged, r.trung || {});
            }
            this.setState({duplicates: merged, checkingDuplicates: false});
        } catch (err) {
            // A failed duplicate check must NOT block saving — it's extra info.
            // But it must SAY so: the old version swallowed the error, the teacher
            // saw the spinner stop with no chips and assumed the bank had no duplicates.
            this.setState({checkingDuplicates: false, error: errorMessage(err, 'Không đo được trùng lặp')});
        }
    };

    // toBank=true: cut into blocks and put them in the question bank, do NOT create an exam.
    // The exam is generated when a student starts it, drawn randomly from the bank.
    save = async (toBank: boolean) => {
        let {exams, picked} = this.state;
        let chosen = exams.filter(e => picked[e.id]);
        if (!chosen.length) return;

        // banked must reset to 0: if the previous save left its number, the hint line
        // still brags "Đã thêm N khối" while this time we create the exam directly
        // without touching the bank.
        this.setState({saving: true, error: null, progress: 0, banked: 0});
        try {
            // ponytail: call sequentially, not Promise.all. 20 exams x 12 questions = 240
            // Question writes; firing them in parallel easily chokes a 2-core server.
            let folder = new URLSearchParams(this.props.location.search).get('folder');
            let saved = 0;
            for (let i = 0; i < chosen.length; i++) {
                if (toBank) {
                    // ponytail: the subject name comes from the folder being imported into —
                    // the teacher already picked the right subject there, asking again is a wasted step.
                    let r = await Api.post('question_bank/save',
                        {...chosen[i], bank: this.bankId()});
                    saved += r.saved;
                } else {
                    await Api.post('exam/create', chosen[i]);
                    // exam/create doesn't accept a folder -> use the existing move_to_folder.
                    if (folder) await Api.post('exam/move_to_folder', {examId: chosen[i].id, folderId: folder});
                }
                this.setState({progress: i + 1});
            }
            if (toBank) {
                this.setState({saving: false, banked: saved});
                this.loadBank();   // stock numbers must update right after adding
            }
            else this.props.history.push('/');
        } catch (e) {
            this.setState({error: errorMessage(e, 'Lưu thất bại'), saving: false});
        }
    };

    folderName = () => this.state.folder && this.state.folder.name;

    // "Duplicate rate" chip — only shown when the question has a duplicate. Colour by
    // level, but NOT red: this is a warning to read, not an error to fix. Questions with
    // the same template ("Cho hàm số y=f(x)... nghịch biến trên khoảng nào") measure 80-90%
    // yet are still two different questions — paint it red and teachers switch the feature off.
    renderDuplicateChip = (qid: string) => {
        let t = this.state.duplicates[qid];
        if (!t) return null;
        let pct = (t.score * 100).toFixed(2);
        const color: SemanticCOLORS = t.score >= 0.95 ? 'orange' : t.score >= 0.8 ? 'yellow' : 'grey';
        let matches = t.khop.map(k => (k.trong_file ? 'trong file này' : (k.khoi || k.id))
            + ' — ' + (k.score * 100).toFixed(2) + '%').join('\n');
        return <Label size='tiny' color={color} title={'Trùng với:\n' + matches}>
            Tỷ lệ trùng: {pct}%
        </Label>;
    };

    renderQuestion = (exam: ImportedExam, section: ImportSection, q: ImportQuestion, idx: number) => {
        // ErrorIdentify is also pick-1-of-4 -> shares the answer UI.
        let isMC = q.type === 'MultipleChoice' || q.type === 'ErrorIdentify';
        let noKey = isMC && !q.data.correctAnswerId;

        // ponytail: the passage belongs to the whole group -> print it only at the group's
        // FIRST question. Comparing with the previous question in the same section is enough,
        // since questions of one group are always consecutive.
        let prev = section.questions[idx - 1];
        let showPassage = q.data.passage &&
            (!prev || prev.data.passageId !== q.data.passageId);

        return <div key={q.id} id={'imp-' + q.id}
                    className={'import-question' + (noKey ? ' has-warning' : '')}>
            {showPassage && <div className='passage passage-edit'>
                <div className='passage-label'>Ngữ liệu dùng chung — sửa ở đây áp dụng cho cả nhóm câu</div>
                <Editor text={q.data.passage}
                        onChange={html => this.setPassage(exam.id, q.data.passageId, html)}/>
            </div>}
            <div className='import-question-head'>
                <b>Câu {idx + 1}</b>
                <Dropdown compact selection className='import-type'
                          value={q.type}
                          options={QUESTION_TYPES.map(t => ({key: t.key, value: t.key, text: t.text}))}
                          onChange={(_e, {value}) => this.setType(exam.id, q.id, String(value))}/>
                {noKey && <Label size='tiny' color='orange'>chưa có đáp án đúng</Label>}
                {this.renderDuplicateChip(q.id)}
                <Icon name='trash alternate outline' link color='grey'
                      title='Xoá câu này'
                      onClick={() => this.removeQuestion(exam.id, q.id)}/>
            </div>

            <Editor text={q.data.question}
                    onChange={html => this.setBody(exam.id, q.id, html)}/>

            {!isMC &&
            <div className='import-wordlimit'>
                <Input size='mini' type='number' min={0} label='khoảng ... từ'
                       labelPosition='left' placeholder='0 = không ghi'
                       value={q.data.max_words || 0}
                       onChange={(_e, {value}) => this.patchQuestion(exam.id, q.id, qq => {
                           const data: QuestionData = {...qq.data, max_words: parseInt(value, 10) || 0};
                           // 0 = no limit -> drop the field entirely, don't write junk into the DB.
                           if (!data.max_words) delete data.max_words;
                           return {...qq, data};
                       })}/>
            </div>}

            {isMC && <Answers question={q}
                              onPick={aid => this.setCorrect(exam.id, q.id, aid)}
                              onEdit={(aid, v) => this.setAnswer(exam.id, q.id, aid, v)}/>}
        </div>;
    };

    renderExam = (exam: ImportedExam) => {
        let {picked, openId, duplicates} = this.state;
        let missing = this.missingKeys(exam);
        let isOpen = openId === exam.id;
        let duplicateCount = exam.sections.reduce(
            (n, s) => n + s.questions.filter(q => duplicates[q.id]).length, 0);

        return <Segment key={exam.id}>
            <div className='import-exam-head'>
                <Checkbox checked={!!picked[exam.id]} onChange={() => this.toggle(exam.id)}/>

                <Input transparent value={exam.name} className='import-exam-name'
                       onChange={(_e, {value}) => this.setName(exam.id, String(value))}/>

                <Input size='mini' type='number' min={0} label='phút'
                       labelPosition='right' className='import-exam-num'
                       value={exam.duration === undefined ? 45 : exam.duration}
                       onChange={(_e, {value}) =>
                           this.patchExam(exam.id, ex => ({...ex, duration: parseInt(String(value), 10) || 0}))}/>

                <span className='import-exam-meta'>
                    {this.countQuestions(exam)} câu
                    {missing > 0 && <Label size='tiny' color='orange' className='margin-left'>
                        {missing} câu thiếu đáp án
                    </Label>}
                    {/* Each question's duplicate chip lives in the "Xem & sửa" section — a
                        collapsed exam shows nothing. Count it up here to know which exam to open. */}
                    {duplicateCount > 0 && <Label size='tiny' color='yellow' className='margin-left'>
                        {duplicateCount} câu trùng
                    </Label>}
                </span>

                <Button size='tiny' basic onClick={() => this.setState({infoId: exam.id})}>
                    <Icon name='info circle'/> Thông tin đề
                </Button>

                <Button size='tiny' basic onClick={() => this.toggleOpen(exam.id)}>
                    <Icon name={isOpen ? 'chevron up' : 'chevron down'}/>
                    {isOpen ? 'Thu gọn' : 'Xem & sửa'}
                </Button>
            </div>

            {isOpen && <div className='import-split'>
                <div className='import-parsed'>
                    <div className='import-col-head'>Đã nhận diện — sửa trực tiếp</div>
                    {exam.sections.map(s => <div key={s.id} className='import-section'>
                        {/* ponytail: dangerouslySetInnerHTML must be on the INNER tag. Put
                            directly on <Header>, semantic still injects children
                            -> React #60 "Can only set one of children or
                            dangerouslySetInnerHTML". */}
                        <Header as='h5' dividing>
                            <span dangerouslySetInnerHTML={{__html: s.name}}/>
                        </Header>
                        {s.questions.map((q, i) => this.renderQuestion(exam, s, q, i))}
                    </div>)}
                </div>

                <div className='import-source'>
                    <div className='import-col-head'>Văn bản gốc trong file Word</div>
                    <SourceView lines={exam.source}/>
                </div>
            </div>}
        </Segment>;
    };

    renderInfoModal = () => {
        let exam = this.state.exams.find(e => e.id === this.state.infoId);
        if (!exam) return null;

        let {total, rows} = this.examStats(exam);

        return <Modal open size='small' onClose={() => this.setState({infoId: null})}>
            <Modal.Header>Thông tin đề</Modal.Header>
            <Modal.Content>
                <p>Tổng số câu trong đề: <b>{total} câu</b></p>
                <Table celled compact size='small'>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Thông tin</Table.HeaderCell>
                            <Table.HeaderCell collapsing textAlign='center'>Số lượng</Table.HeaderCell>
                            <Table.HeaderCell>Danh sách các câu</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {rows.map(([label, items]) => <Table.Row key={label}>
                            <Table.Cell>{label}</Table.Cell>
                            <Table.Cell textAlign='center'>{items.length}</Table.Cell>
                            <Table.Cell>
                                {items.map(x =>
                                    <Label key={x.q.id} as='a' size='tiny' className='q-chip'
                                           onClick={() => this.jumpTo(exam.id, x.q.id)}>
                                        Câu {x.no}
                                    </Label>)}
                            </Table.Cell>
                        </Table.Row>)}
                    </Table.Body>
                </Table>
            </Modal.Content>
            <Modal.Actions>
                <Button onClick={() => this.setState({infoId: null})}>Đóng</Button>
            </Modal.Actions>
        </Modal>;
    };

    // The bank lives RIGHT HERE rather than as a separate menu item: this is the only
    // screen that pours blocks into the bank, so it's also where teachers want to see how
    // many are left. Before, it was a left-menu button next to 'Tao de' — it looked like
    // a way to create an exam, but clicking it jumped to the TAKE-TEST screen.
    loadBank = async () => {
        let bankId = this.bankId();
        if (!bankId) return this.setState({bank: null});
        try {
            let cap = await Api.post('question_bank/capacity', {bank: bankId});
            this.setState({bank: cap});
        } catch (e) {
            // A broken bank must not stop importing — just hide the stats panel.
            this.setState({bank: null});
        }
    };

    renderBank = () => {
        let {bank} = this.state;
        if (!bank) return null;

        let per = bank.per_type || {};
        let slots = bank.slots || {};
        let drawable = bank.capacity || 0;
        let total = Object.keys(per).reduce((a, t) => a + per[t], 0);
        if (!total) return null;   // empty bank -> don't show an empty panel

        let {bankInfo} = this.state;
        let bottleneck = bank.bottleneck;

        return <Segment className='import-bank margin-top'>
            <div className='import-bank-head'>
                <Icon name='database' size='large' color={drawable > 0 ? 'green' : 'grey'}/>
                <div className='import-bank-text'>
                    <b>{bankInfo ? bankInfo.name : 'Ngân hàng câu hỏi'}: {total} khối</b>
                    <div className='text-muted'>
                        {drawable > 0
                            ? <span>Đủ rút {drawable} đề không trùng khối
                                {bottleneck && <span> · nghẽn ở <b>{blockLabel(bottleneck[0])}</b></span>}
                              </span>
                            : 'Chưa đủ khối để rút một đề hoàn chỉnh — nhập thêm đề bên dưới.'}
                    </div>
                </div>
                <Link to={'/draw-exam/bank/' + this.bankId()}>
                    <Button basic primary disabled={drawable < 1}>
                        <Icon name='random'/> Rút thử một đề
                    </Button>
                </Link>
            </div>

            <div className='import-bank-types'>
                {Object.keys(slots).map(t => {
                    let have = per[t] || 0, drawn = Math.floor(have / slots[t]);
                    return <Label key={t} basic
                                  color={drawn < 1 ? 'red' : drawn < 4 ? 'yellow' : 'green'}>
                        {blockLabel(t)}
                        <Label.Detail>{have} khối · rút được {drawn}</Label.Detail>
                    </Label>;
                })}
            </div>
        </Segment>;
    };

    render() {
        const {loading, error, exams, warnings, picked, saving, progress, banked,
               checkingDuplicates, duplicates} = this.state;
        let chosen = exams.filter(e => picked[e.id]).length;

        return <div className='margin import-exam'>
            <Header as='h2'>
                <Icon name='file word outline'/>
                <Header.Content>
                    Nhập đề từ file Word
                    <Header.Subheader>
                        Xem trước rồi mới lưu — chưa ghi vào hệ thống
                        {this.state.bankInfo
                            ? ` · lưu vào ngân hàng ${this.state.bankInfo.name}`
                            : this.folderName() && ` · lưu vào thư mục ${this.folderName()}`}
                    </Header.Subheader>
                </Header.Content>
            </Header>

            <input type='file' accept='.docx' ref={this.refFile}
                   onChange={this.upload} style={{display: 'none'}}/>

            <Button primary loading={loading} disabled={loading || saving} onClick={this.pickFile}>
                <Icon name='upload'/> Chọn file .docx
            </Button>

            {this.renderBank()}

            {error && <Message negative>{error}</Message>}

            {warnings.length > 0 &&
            <Message warning>
                <Message.Header>Cần kiểm tra lại {warnings.length} chỗ</Message.Header>
                <Message.List items={warnings}/>
            </Message>}

            {exams.length > 0 && <Segment.Group className='margin-top'>
                <Segment secondary>
                    <Checkbox label={`Đọc được ${exams.length} đề — đã chọn ${chosen}`}
                              checked={chosen === exams.length}
                              indeterminate={chosen > 0 && chosen < exams.length}
                              onChange={this.toggleAll}/>
                </Segment>

                {exams.map(this.renderExam)}

                <Segment>
                    {/* Without ?bank= do NOT allow saving to a bank: before, it still
                        saved, and blocks fell into a shared nameless, subject-less basket
                        that no screen could draw from. Block it here, close the way in. */}
                    <Button positive loading={saving}
                            disabled={!chosen || saving || !this.bankId()}
                            onClick={() => this.save(true)}>
                        <Icon name='database'/> Lưu {chosen} đề vào ngân hàng
                    </Button>
                    <Button basic loading={saving} disabled={!chosen || saving}
                            onClick={() => this.save(false)}>
                        <Icon name='save'/> Tạo thẳng {chosen} đề
                    </Button>
                    {/* The duplicate check is optional, not a required step before
                        saving: an empty bank measures 0 anyway, forcing a click is pointless. */}
                    <Button basic loading={checkingDuplicates}
                            disabled={!chosen || saving || !this.bankId()}
                            onClick={this.checkDuplicates}>
                        <Icon name='copy outline'/> Kiểm tra trùng lặp
                    </Button>
                    <span className='import-save-hint'>
                        {saving ? `Đang lưu ${progress}/${chosen}…`
                            : banked ? `Đã thêm ${banked} khối vào ngân hàng.`
                            : !this.bankId()
                                ? <span>Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>
                                    Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</span>
                                : Object.keys(duplicates).length
                                    ? `Có ${Object.keys(duplicates).length} câu trùng với ngân hàng — xem chip trên từng câu rồi tự quyết.`
                                    : 'Vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.'}
                    </span>
                </Segment>
            </Segment.Group>}

            {this.renderInfoModal()}
        </div>;
    }
}

export default withRouter(ImportExam);
