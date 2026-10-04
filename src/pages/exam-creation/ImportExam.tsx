import React, {Component} from 'react';
import {Button, Checkbox, Dropdown, Header, Icon, Input, Label, Message, Modal, Radio, Segment, Table} from 'semantic-ui-react';
import type {SemanticCOLORS} from 'semantic-ui-react';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import {Editor} from '../../components/Editor';
import Api from '../../services/api';
import {tenLoai} from './blockTypes';
import {convertData, type QuestionData} from './convertData';
import type {RouterProps} from '../../withRouter';
import type {BankCapacity, Folder, QuestionBank} from '../../types/exam';


/**
 * Đề như `import_docx/preview` trả về — CHƯA lưu, chính là payload sẽ gửi
 * lên `exam/create`. Khác `Exam` của màn soạn đề: có thêm `source` (văn bản
 * gốc trong file Word) để dựng cột phải.
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
    /** Từng dòng văn bản gốc, backend đã escape sẵn. */
    source?: string[];
};

/** Kết quả đo trùng của MỘT câu — `question_bank/check_trung`. */
type TrungInfo = {
    score: number;
    khop: Array<{id?: string; khoi?: string; score: number; trong_file?: boolean}>;
};


/** Lấy câu lỗi từ exception của Api — ba endpoint ở đây trả ba field khác nhau. */
const loi = (e: any, mac_dinh: string) =>
    (e && (e.message || e.description || e.error)) || mac_dinh;


// Cot phai: van ban goc tu file Word, danh so dong + to mau tu khoa de
// giao vien soi cho parser doc sai. Chuoi da duoc backend escape san.
// ponytail: to mau bang regex thuan, khong keo them thu vien highlight —
// chi co 3 loai token can phan biet.
function highlight(html: string) {
    // Moc cau truc chi tinh khi o DAU dong: 'Nhung Cau chuyen nay...' giua
    // dong khong phai moc. To toi het dau cham/hai cham neu co, khong thi het
    // cum 'VAN BAN 2' / 'DE SO 5'. Cho </b> lot vao giua vi marker in dam cua
    // Word boc ngay tu khoa.
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


// ponytail: KHONG tai dung MultipleChoiceAnswer — no hardcode name='answer'
// (MultipleChoiceAnswer.jsx:61), man nay hien 20 de cung luc nen moi radio se
// chung MOT group: chon dap an cau 2 lam bo chon cau 1. Radio o day lay
// name theo question.id.
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


// Loai cau hoi doi duoc luc import. Parser chi doan duoc Trac nghiem / Tu luan
// (co A.B.C.D. hay khong), ba loai con lai giao vien tu chon.
const QUESTION_TYPES = [
    {key: 'MultipleChoice', text: 'Trắc nghiệm'},
    {key: 'FreeAnswer', text: 'Tự luận'},
    {key: 'TrueFalse', text: 'Đúng / Sai'},
    {key: 'FillBlank', text: 'Điền vào chỗ trống'},
    {key: 'ErrorIdentify', text: 'Tìm lỗi sai'},
];

// ponytail: `data.answer` mang nghia KHAC nhau tung loai — TrueFalse.jsx doc no
// nhu boolean, FillBlank.jsx nhu chuoi HTML. Doi loai ma bung nguyen data cu thi
// TrueFalse an phai chuoi HTML -> ca hai radio deu khong checked, giao vien tuong
// chua chon, luu xong cham may sai. Nen giu dung phan dung chung, bo phan rieng.
type State = {
    loading: boolean;
    error: string | null;
    exams: ImportedExam[];
    warnings: string[];
    /** id đề -> có tick hay không. */
    picked: Record<string, boolean>;
    openId: string | null;
    infoId: string | null;
    saving: boolean;
    progress: number;
    folder: Folder | null;
    bankInfo: QuestionBank | null;
    trung: Record<string, TrungInfo>;
    dangDoTrung: boolean;
    /** Số khối vừa thêm, cho dòng hint. Bản cũ thiếu trong state khởi tạo. */
    banked: number;
    /** Tồn kho ngân hàng đang nhập vào. null = không có ?bank= hoặc tải hỏng. */
    bank: BankCapacity | null;
};

class ImportExam extends Component<RouterProps, State> {
    state: State = {
        loading: false,
        error: null,
        exams: [],
        warnings: [],
        picked: {},
        openId: null,    // chi mo MOT de mot luc (xem toggleOpen)
        infoId: null,    // de dang xem modal 'Thong tin de'
        saving: false,
        progress: 0,
        folder: null,
        bankInfo: null,
        trung: {},       // id cau -> {score, khop[]}; chi hien so, khong chan luu
        dangDoTrung: false,
        banked: 0,
        bank: null,
    };

    // Ngan hang lay tu ?bank= — mot thuc the co ten va co mon, giao vien tu tao.
    // Truoc day mon phai doan tu TEN THU MUC: import ngoai thu muc thi mon rong,
    // moi khoi do chung mot ro, khong tach duoc ngan hang nao voi ngan hang nao.
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
            // ponytail: mặc định tick HẾT. File 20 đề mà bỏ tick hết thì giáo
            // viên phải bấm 20 lần; bỏ bớt vài đề dễ hơn chọn lại từ đầu.
            const picked: Record<string, boolean> = {};
            res.exams.forEach(e => picked[e.id] = true);
            // Mở sẵn đề đầu để thấy ngay là xem/sửa được, không phải bấm dò.
            let openId = res.exams.length ? res.exams[0].id : null;
            this.setState({exams: res.exams, warnings: res.warnings || [], picked, openId});
        } catch (e) {
            this.setState({error: loi(e, 'Không đọc được file')});
        } finally {
            target.value = '';   // cho phép chọn lại đúng file vừa chọn
            this.setState({loading: false});
        }
    };

    toggle = (id: string) => this.setState(({picked}) => ({picked: {...picked, [id]: !picked[id]}}));

    // ponytail: chi mo MOT de. Moi o soan la mot instance TipTap; 20 de x 12 cau
    // x (1 than + 4 dap an) ~ 1200 ProseMirror view -> trinh duyet i ra. Mo mot
    // de la ~60, chay muot.
    toggleOpen = (id: string) => this.setState(({openId}) => ({openId: openId === id ? null : id}));

    toggleAll = () => {
        let {exams, picked} = this.state;
        let all = exams.every(e => picked[e.id]);
        const next: Record<string, boolean> = {};
        exams.forEach(e => next[e.id] = !all);
        this.setState({picked: next});
    };

    // ponytail: sua TAI CHO tren state.exams — payload nay chinh la cai gui len
    // exam/create, khong can shape trung gian nao khac.
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

    // ponytail: doi loai phai cap nhat CA section.question_type — BE luu field nay
    // (core_docx lay tu cau dau section) va man soan de doc no de biet phan nay
    // thuoc dang gi. Sua moi q.type thi phan bi gan nham loai cua cau da doi.
    setType = (examId: string, qid: string, type: string) => this.patchExam(examId, exam => {
        exam.sections = exam.sections.map(s => {
            if (!s.questions.some(q => q.id === qid)) return s;

            let questions = s.questions.map(q =>
                q.id === qid ? {...q, type, data: convertData(q.data, type)} : q);

            return {...s, questions, question_type: questions[0].type};
        });
        return exam;
    });

    // ponytail: ngu lieu la BAN SAO trong tung cau cung nhom, nen sua thi phai
    // ghi lai cho CA NHOM theo passageId. Sua moi cau dau thi cau 2-5 giu ban cu
    // -> luu xong hoc sinh doc phai van ban chua sua.
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
            .filter(s => s.questions.length);   // phần rỗng thì bỏ luôn
        return exam;
    });

    countQuestions = (exam: ImportedExam) => exam.sections.reduce((n, s) => n + s.questions.length, 0);

    // Câu trắc nghiệm chưa chọn đáp án đúng -> chấm máy sẽ luôn ra 0 điểm.
    missingKeys = (exam: ImportedExam) => exam.sections.reduce((n, s) =>
        n + s.questions.filter(q => q.type === 'MultipleChoice' && !q.data.correctAnswerId).length, 0);

    // Thống kê cho modal "Thông tin đề": gom câu theo từng tiêu chí.
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

    // ponytail: cuon toi cau bang id DOM thay vi ref — 240 cau ma giu ref het
    // thi phai quan ly map ref, trong khi id da co san tu payload.
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

    // Đo trùng với câu đã có trong ngân hàng. Chỉ hiện số — người import tự
    // quyết có lưu hay không, y như Azota. Gọi riêng chứ không gộp vào save:
    // đo xong mới hiện nút Lưu thì giáo viên còn kịp nhìn trước khi bấm.
    doTrung = async () => {
        let chosen = this.state.exams.filter(e => this.state.picked[e.id]);
        if (!chosen.length) return;
        this.setState({dangDoTrung: true});
        try {
            let gop = {};
            for (let e of chosen) {
                let r = await Api.post('question_bank/check_trung',
                    {...e, bank: this.bankId()});
                Object.assign(gop, r.trung || {});
            }
            this.setState({trung: gop, dangDoTrung: false});
        } catch (err) {
            // Đo trùng hỏng KHÔNG được chặn việc lưu — nó là thông tin thêm.
            // Nhưng phải NÓI ra: bản cũ nuốt lỗi, giáo viên bấm xong thấy
            // spinner tắt mà không có chip nào, tưởng ngân hàng sạch trùng.
            this.setState({dangDoTrung: false, error: loi(err, 'Không đo được trùng lặp')});
        }
    };

    // toBank=true: cắt thành khối rồi bỏ vào ngân hàng câu hỏi, KHÔNG tạo đề.
    // Đề sinh ra lúc học sinh bấm thi, rút ngẫu nhiên từ ngân hàng.
    save = async (toBank: boolean) => {
        let {exams, picked} = this.state;
        let chosen = exams.filter(e => picked[e.id]);
        if (!chosen.length) return;

        // banked phải về 0: lần lưu trước để lại số cũ thì dòng hint vẫn khoe
        // "Đã thêm N khối" trong khi lần này tạo thẳng đề, chưa động vào ngân hàng.
        this.setState({saving: true, error: null, progress: 0, banked: 0});
        try {
            // ponytail: gọi tuần tự, không Promise.all. 20 đề x 12 câu = 240
            // lượt ghi Question; bắn song song dễ làm server 2 nhân nghẹn.
            let folder = new URLSearchParams(this.props.location.search).get('folder');
            let saved = 0;
            for (let i = 0; i < chosen.length; i++) {
                if (toBank) {
                    // ponytail: tên môn lấy từ thư mục đang import vào — giáo
                    // viên đã chọn đúng môn ở đó rồi, hỏi lại là thừa một bước.
                    let r = await Api.post('question_bank/save',
                        {...chosen[i], bank: this.bankId()});
                    saved += r.saved;
                } else {
                    await Api.post('exam/create', chosen[i]);
                    // exam/create không nhận folder -> dùng move_to_folder sẵn có.
                    if (folder) await Api.post('exam/move_to_folder', {examId: chosen[i].id, folderId: folder});
                }
                this.setState({progress: i + 1});
            }
            if (toBank) {
                this.setState({saving: false, banked: saved});
                this.loadBank();   // so lieu ton kho phai doi ngay sau khi them
            }
            else this.props.history.push('/');
        } catch (e) {
            this.setState({error: loi(e, 'Lưu thất bại'), saving: false});
        }
    };

    folderName = () => this.state.folder && this.state.folder.name;

    // Chip "Tỷ lệ trùng" — chỉ hiện khi câu có trùng. Màu theo mức, nhưng
    // KHÔNG màu đỏ: đây là cảnh báo để đọc, không phải lỗi phải sửa. Câu cùng
    // khung ("Cho hàm số y=f(x)... nghịch biến trên khoảng nào") đo ra 80-90%
    // mà vẫn là hai câu khác nhau — bôi đỏ thì giáo viên tắt tính năng đi.
    renderChipTrung = (qid: string) => {
        let t = this.state.trung[qid];
        if (!t) return null;
        let pct = (t.score * 100).toFixed(2);
        const mau: SemanticCOLORS = t.score >= 0.95 ? 'orange' : t.score >= 0.8 ? 'yellow' : 'grey';
        let ds = t.khop.map(k => (k.trong_file ? 'trong file này' : (k.khoi || k.id))
            + ' — ' + (k.score * 100).toFixed(2) + '%').join('\n');
        return <Label size='tiny' color={mau} title={'Trùng với:\n' + ds}>
            Tỷ lệ trùng: {pct}%
        </Label>;
    };

    renderQuestion = (exam: ImportedExam, section: ImportSection, q: ImportQuestion, idx: number) => {
        // ErrorIdentify cung la chon 1 trong 4 phuong an -> dung chung UI dap an.
        let isMC = q.type === 'MultipleChoice' || q.type === 'ErrorIdentify';
        let noKey = isMC && !q.data.correctAnswerId;

        // ponytail: ngu lieu la cua ca nhom -> chi in o cau DAU nhom. So voi cau
        // lien truoc trong cung section la du, vi cac cau cung nhom luon lien tiep.
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
                {this.renderChipTrung(q.id)}
                <Icon name='trash alternate outline' link color='grey'
                      title='Xoá câu này'
                      onClick={() => this.removeQuestion(exam.id, q.id)}/>
            </div>

            <Editor text={q.data.question}
                    onChange={html => this.setBody(exam.id, q.id, html)}/>

            {!isMC &&
            <div className='import-wordlimit'>
                <Input size='mini' type='number' min={0} label='giới hạn từ'
                       labelPosition='left' placeholder='0 = không giới hạn'
                       value={q.data.max_words || 0}
                       onChange={(_e, {value}) => this.patchQuestion(exam.id, q.id, qq => {
                           const data: QuestionData = {...qq.data, max_words: parseInt(value, 10) || 0};
                           // 0 = khong gioi han -> bo han field, khong ghi rac vao DB.
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
        let {picked, openId, trung} = this.state;
        let missing = this.missingKeys(exam);
        let isOpen = openId === exam.id;
        let soTrung = exam.sections.reduce(
            (n, s) => n + s.questions.filter(q => trung[q.id]).length, 0);

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
                    {/* Chip trùng của từng câu nằm trong phần "Xem & sửa" — đề
                        thu gọn thì không thấy gì. Đếm lên đây để biết nên mở đề nào. */}
                    {soTrung > 0 && <Label size='tiny' color='yellow' className='margin-left'>
                        {soTrung} câu trùng
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
                        {/* ponytail: dangerouslySetInnerHTML phai o the TRONG. Dat
                            thang tren <Header> thi semantic van tu chen children
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

    // Ngan hang o NGAY DAY chu khong phai mot muc menu rieng: day la man duy
    // nhat do khoi vao ngan hang, nen cung la cho giao vien muon xem con bao
    // nhieu. Truoc do no nam o nut menu trai, canh 'Tao de' — trong nhu mot
    // cach tao de, nhung bam vao lai nhay sang man LAM BAI.
    loadBank = async () => {
        let bankId = this.bankId();
        if (!bankId) return this.setState({bank: null});
        try {
            let cap = await Api.post('question_bank/capacity', {bank: bankId});
            this.setState({bank: cap});
        } catch (e) {
            // Ngan hang loi thi van phai import duoc — chi an bang thong ke.
            this.setState({bank: null});
        }
    };

    renderBank = () => {
        let {bank} = this.state;
        if (!bank) return null;

        let per = bank.per_type || {};
        let slots = bank.slots || {};
        let lan = bank.capacity || 0;
        let tong = Object.keys(per).reduce((a, t) => a + per[t], 0);
        if (!tong) return null;   // ngan hang rong thi khong bay bang trong

        let {bankInfo} = this.state;
        let nghen = bank.bottleneck;

        return <Segment className='import-bank margin-top'>
            <div className='import-bank-head'>
                <Icon name='database' size='large' color={lan > 0 ? 'green' : 'grey'}/>
                <div className='import-bank-text'>
                    <b>{bankInfo ? bankInfo.name : 'Ngân hàng câu hỏi'}: {tong} khối</b>
                    <div className='text-muted'>
                        {lan > 0
                            ? <span>Đủ rút {lan} đề không trùng khối
                                {nghen && <span> · nghẽn ở <b>{tenLoai(nghen[0])}</b></span>}
                              </span>
                            : 'Chưa đủ khối để rút một đề hoàn chỉnh — nhập thêm đề bên dưới.'}
                    </div>
                </div>
                <Link to={'/draw-exam/bank/' + this.bankId()}>
                    <Button basic primary disabled={lan < 1}>
                        <Icon name='random'/> Rút thử một đề
                    </Button>
                </Link>
            </div>

            <div className='import-bank-types'>
                {Object.keys(slots).map(t => {
                    let co = per[t] || 0, duoc = Math.floor(co / slots[t]);
                    return <Label key={t} basic
                                  color={duoc < 1 ? 'red' : duoc < 4 ? 'yellow' : 'green'}>
                        {tenLoai(t)}
                        <Label.Detail>{co} khối · rút được {duoc}</Label.Detail>
                    </Label>;
                })}
            </div>
        </Segment>;
    };

    render() {
        const {loading, error, exams, warnings, picked, saving, progress, banked,
               dangDoTrung, trung} = this.state;
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
                    {/* Khong co ?bank= thi KHONG cho luu vao ngan hang: truoc day
                        van luu duoc, khoi roi vao ro chung khong ten khong mon,
                        khong man nao rut ra duoc. Chan tai day, chi ro loi vao. */}
                    <Button positive loading={saving}
                            disabled={!chosen || saving || !this.bankId()}
                            onClick={() => this.save(true)}>
                        <Icon name='database'/> Lưu {chosen} đề vào ngân hàng
                    </Button>
                    <Button basic loading={saving} disabled={!chosen || saving}
                            onClick={() => this.save(false)}>
                        <Icon name='save'/> Tạo thẳng {chosen} đề
                    </Button>
                    {/* Đo trùng là tuỳ chọn, không phải bước bắt buộc trước khi
                        lưu: ngân hàng rỗng thì đo xong vẫn ra 0, bắt bấm là thừa. */}
                    <Button basic loading={dangDoTrung}
                            disabled={!chosen || saving || !this.bankId()}
                            onClick={this.doTrung}>
                        <Icon name='copy outline'/> Kiểm tra trùng lặp
                    </Button>
                    <span className='import-save-hint'>
                        {saving ? `Đang lưu ${progress}/${chosen}…`
                            : banked ? `Đã thêm ${banked} khối vào ngân hàng.`
                            : !this.bankId()
                                ? <span>Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>
                                    Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</span>
                                : Object.keys(trung).length
                                    ? `Có ${Object.keys(trung).length} câu trùng với ngân hàng — xem chip trên từng câu rồi tự quyết.`
                                    : 'Vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.'}
                    </span>
                </Segment>
            </Segment.Group>}

            {this.renderInfoModal()}
        </div>;
    }
}

export default withRouter(ImportExam);
