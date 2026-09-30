import React, {Component} from 'react';
import {Button, Checkbox, Dropdown, Header, Icon, Input, Label, Message, Modal, Radio, Segment, Table} from 'semantic-ui-react';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import {connectGlobalState} from '../../stateUtils';
import {Editor} from '../../components/Editor';
import Api from '../../services/api';
import {TEN_LOAI} from './blockTypes';


// Cot phai: van ban goc tu file Word, danh so dong + to mau tu khoa de
// giao vien soi cho parser doc sai. Chuoi da duoc backend escape san.
// ponytail: to mau bang regex thuan, khong keo them thu vien highlight —
// chi co 3 loai token can phan biet.
function highlight(html) {
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

function SourceView({lines}) {
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
function Answers({question, onPick, onEdit}) {
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
function convertData(data, to) {
    // question / passage / passageId / max_words dung chung moi loai.
    let {question, passage, passageId, max_words} = data;
    let next = {question};
    if (passage) { next.passage = passage; next.passageId = passageId; }

    if (to === 'MultipleChoice' || to === 'ErrorIdentify') {
        // Giu lai phuong an neu von la trac nghiem, khong thi giao vien tu them.
        next.answers = data.answers || [];
        if (data.correctAnswerId) next.correctAnswerId = data.correctAnswerId;
    } else if (to === 'FreeAnswer') {
        if (max_words) next.max_words = max_words;
    }
    // TrueFalse: khong set data.answer — TrueFalse.jsx coi undefined la CHUA CHON
    // va bo checked ca hai radio. Dat san true/false la gan bua dap an dung.
    // FillBlank: khong set data.answer — de trong cho giao vien go.
    return next;
}


class ImportExam extends Component {
    state = {
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
    };

    // Ngan hang lay tu ?bank= — mot thuc the co ten va co mon, giao vien tu tao.
    // Truoc day mon phai doan tu TEN THU MUC: import ngoai thu muc thi mon rong,
    // moi khoi do chung mot ro, khong tach duoc ngan hang nao voi ngan hang nao.
    bankId = () => new URLSearchParams(this.props.location.search).get('bank');

    componentDidMount = async () => {
        let id = new URLSearchParams(this.props.location.search).get('folder');
        if (id) {
            let folders = await Api.get('folder/list');
            this.setState({folder: folders.find(f => f.id === id) || null});
        }
        if (this.bankId()) {
            let banks = await Api.get('question_bank/list');
            this.setState({bankInfo: banks.find(b => b.id === this.bankId()) || null});
        }
        this.loadBank();
    };

    refFile = React.createRef();

    pickFile = () => this.refFile.current.click();

    upload = async ({target}) => {
        let file = target.files[0];
        if (!file) return;

        this.setState({loading: true, error: null, exams: [], warnings: []});

        try {
            let res = await Api.upload('import_docx/preview', file);
            // ponytail: mặc định tick HẾT. File 20 đề mà bỏ tick hết thì giáo
            // viên phải bấm 20 lần; bỏ bớt vài đề dễ hơn chọn lại từ đầu.
            let picked = {};
            res.exams.forEach(e => picked[e.id] = true);
            // Mở sẵn đề đầu để thấy ngay là xem/sửa được, không phải bấm dò.
            let openId = res.exams.length ? res.exams[0].id : null;
            this.setState({exams: res.exams, warnings: res.warnings || [], picked, openId});
        } catch (e) {
            this.setState({error: e.message || e.description || 'Không đọc được file'});
        } finally {
            target.value = '';   // cho phép chọn lại đúng file vừa chọn
            this.setState({loading: false});
        }
    };

    toggle = (id) => this.setState(({picked}) => ({picked: {...picked, [id]: !picked[id]}}));

    // ponytail: chi mo MOT de. Moi o soan la mot instance TipTap; 20 de x 12 cau
    // x (1 than + 4 dap an) ~ 1200 ProseMirror view -> trinh duyet i ra. Mo mot
    // de la ~60, chay muot.
    toggleOpen = (id) => this.setState(({openId}) => ({openId: openId === id ? null : id}));

    toggleAll = () => {
        let {exams, picked} = this.state;
        let all = exams.every(e => picked[e.id]);
        let next = {};
        exams.forEach(e => next[e.id] = !all);
        this.setState({picked: next});
    };

    // ponytail: sua TAI CHO tren state.exams — payload nay chinh la cai gui len
    // exam/create, khong can shape trung gian nao khac.
    patchExam = (examId, fn) => this.setState(({exams}) => ({
        exams: exams.map(e => e.id === examId ? fn({...e}) : e),
    }));

    patchQuestion = (examId, qid, fn) => this.patchExam(examId, exam => {
        exam.sections = exam.sections.map(s => ({
            ...s,
            questions: s.questions.map(q => q.id === qid ? fn({...q}) : q),
        }));
        return exam;
    });

    setName = (examId, name) => this.patchExam(examId, e => ({...e, name}));

    setBody = (examId, qid, html) =>
        this.patchQuestion(examId, qid, q => ({...q, data: {...q.data, question: html}}));

    // ponytail: doi loai phai cap nhat CA section.question_type — BE luu field nay
    // (core_docx lay tu cau dau section) va man soan de doc no de biet phan nay
    // thuoc dang gi. Sua moi q.type thi phan bi gan nham loai cua cau da doi.
    setType = (examId, qid, type) => this.patchExam(examId, exam => {
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
    setPassage = (examId, passageId, html) => this.patchExam(examId, exam => {
        exam.sections = exam.sections.map(sec => ({
            ...sec,
            questions: sec.questions.map(q => q.data.passageId === passageId
                ? {...q, data: {...q.data, passage: html}} : q),
        }));
        return exam;
    });

    setCorrect = (examId, qid, answerId) =>
        this.patchQuestion(examId, qid, q => ({...q, data: {...q.data, correctAnswerId: answerId}}));

    setAnswer = (examId, qid, answerId, value) =>
        this.patchQuestion(examId, qid, q => ({
            ...q,
            data: {
                ...q.data,
                answers: q.data.answers.map(a => a.id === answerId ? {...a, value} : a),
            },
        }));

    removeQuestion = (examId, qid) => this.patchExam(examId, exam => {
        exam.sections = exam.sections
            .map(s => ({...s, questions: s.questions.filter(q => q.id !== qid)}))
            .filter(s => s.questions.length);   // phần rỗng thì bỏ luôn
        return exam;
    });

    countQuestions = (exam) => exam.sections.reduce((n, s) => n + s.questions.length, 0);

    // Câu trắc nghiệm chưa chọn đáp án đúng -> chấm máy sẽ luôn ra 0 điểm.
    missingKeys = (exam) => exam.sections.reduce((n, s) =>
        n + s.questions.filter(q => q.type === 'MultipleChoice' && !q.data.correctAnswerId).length, 0);

    // Thống kê cho modal "Thông tin đề": gom câu theo từng tiêu chí.
    examStats = (exam) => {
        let all = [];
        exam.sections.forEach(s => s.questions.forEach((q, i) => all.push({q, s, no: i + 1})));

        let rows = [
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
    jumpTo = (examId, qid) => {
        this.setState({infoId: null, openId: examId}, () => {
            let el = document.getElementById('imp-' + qid);
            if (el) {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                el.classList.add('flash');
                setTimeout(() => el.classList.remove('flash'), 1200);
            }
        });
    };

    // toBank=true: cắt thành khối rồi bỏ vào ngân hàng câu hỏi, KHÔNG tạo đề.
    // Đề sinh ra lúc học sinh bấm thi, rút ngẫu nhiên từ ngân hàng.
    save = async (toBank) => {
        let {exams, picked} = this.state;
        let chosen = exams.filter(e => picked[e.id]);
        if (!chosen.length) return;

        this.setState({saving: true, error: null, progress: 0});
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
            this.setState({error: e.message || 'Lưu thất bại', saving: false});
        }
    };

    folderName = () => this.state.folder && this.state.folder.name;

    renderQuestion = (exam, section, q, idx) => {
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
                          onChange={(e, {value}) => this.setType(exam.id, q.id, value)}/>
                {noKey && <Label size='tiny' color='orange'>chưa có đáp án đúng</Label>}
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
                       onChange={(e, {value}) => this.patchQuestion(exam.id, q.id, qq => {
                           let data = {...qq.data, max_words: parseInt(value, 10) || 0};
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

    renderExam = (exam) => {
        let {picked, openId} = this.state;
        let missing = this.missingKeys(exam);
        let isOpen = openId === exam.id;

        return <Segment key={exam.id}>
            <div className='import-exam-head'>
                <Checkbox checked={!!picked[exam.id]} onChange={() => this.toggle(exam.id)}/>

                <Input transparent value={exam.name} className='import-exam-name'
                       onChange={(e, {value}) => this.setName(exam.id, value)}/>

                <Input size='mini' type='number' min={0} label='phút'
                       labelPosition='right' className='import-exam-num'
                       value={exam.duration === undefined ? 45 : exam.duration}
                       onChange={(e, {value}) =>
                           this.patchExam(exam.id, ex => ({...ex, duration: parseInt(value, 10) || 0}))}/>

                <Input size='mini' type='number' min={0} label='đ'
                       labelPosition='right' className='import-exam-num import-exam-price'
                       value={exam.price === undefined ? 100000 : exam.price}
                       onChange={(e, {value}) =>
                           this.patchExam(exam.id, ex => ({...ex, price: parseInt(value, 10) || 0}))}/>

                <span className='import-exam-meta'>
                    {this.countQuestions(exam)} câu
                    {missing > 0 && <Label size='tiny' color='orange' className='margin-left'>
                        {missing} câu thiếu đáp án
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
                                {nghen && <span> · nghẽn ở <b>{TEN_LOAI[nghen[0]] || nghen[0]}</b></span>}
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
                        {TEN_LOAI[t] || t}
                        <Label.Detail>{co} khối · rút được {duoc}</Label.Detail>
                    </Label>;
                })}
            </div>
        </Segment>;
    };

    render() {
        let {loading, error, exams, warnings, picked, saving, progress, banked, bank} = this.state;
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
                    <span className='import-save-hint'>
                        {saving ? `Đang lưu ${progress}/${chosen}…`
                            : banked ? `Đã thêm ${banked} khối vào ngân hàng.`
                            : !this.bankId()
                                ? <span>Muốn lưu vào ngân hàng thì vào <Link to='/question-bank'>
                                    Ngân hàng câu hỏi</Link> chọn một ngân hàng rồi bấm “Nhập đề”.</span>
                                : 'Vào ngân hàng: cắt thành khối để sau này rút đề ngẫu nhiên.'}
                    </span>
                </Segment>
            </Segment.Group>}

            {this.renderInfoModal()}
        </div>;
    }
}

export default withRouter(connectGlobalState(ImportExam));
