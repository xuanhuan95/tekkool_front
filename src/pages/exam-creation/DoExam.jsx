import withRouter from '../../withRouter';
import React, {Fragment} from 'react';
import Loading from '../../components/Loading';
import renderHTML from '../../components/SafeHtml';
import Passage from '../../components/Passage';
import striptags from 'striptags';

import {useAuthStore} from "../../stores/authStore";
import {Segment, Radio, Grid, Button, Icon, Rail, Sticky, Message} from 'semantic-ui-react';
import {numToChar} from "../../services/tools";
import {Editor} from "../../components/Editor";
import Api from "../../services/api";
import HetLuotModal from "../../components/HetLuotModal";
import {round} from "../my/fmt";


// Bang diem tung phan tren man "Da nop bai".
// Chia 2 nhom theo pending chu khong theo block_type: hoc sinh quan tam
// "cho ai cham", khong quan tam loai cau. Phan nao con cau chua cham thi ca
// phan do la "cho giao vien" — cham nua voi mot phan con te hon khong cham.
function BangDiem({phan}) {
    const may = phan.filter(p => !p.pending);
    const nguoi = phan.filter(p => p.pending);
    const tong = may.reduce((t, p) => t + p.score, 0);
    const tongMax = may.reduce((t, p) => t + p.max_score, 0);
    return <div className='tk-ketqua'>
        {may.length > 0 && <Fragment>
            <div className='tk-ketqua-nhom'>Phần trắc nghiệm:</div>
            {may.map(p => <div className='tk-ketqua-dong' key={p.ten}>
                <span>{p.ten}</span>
                <b>{round(p.score)}/{round(p.max_score)} điểm</b>
            </div>)}
            {may.length > 1 && <div className='tk-ketqua-dong tk-ketqua-tong'>
                <span>Tổng</span><b>{round(tong)}/{round(tongMax)} điểm</b>
            </div>}
        </Fragment>}
        {nguoi.length > 0 && <Fragment>
            <div className='tk-ketqua-nhom'>Phần tự luận:</div>
            {nguoi.map(p => <div className='tk-ketqua-dong' key={p.ten}>
                <span>{p.ten}</span>
                <i>chờ giáo viên chấm</i>
            </div>)}
        </Fragment>}
    </div>;
}


class DoExam extends React.Component {
    state = {
        exam: null,
        answers: [],
        startAt: null,
        endAt: null,
        passedTime: 0,
        remainingTime: 0,
        loadError: null,
        hetLuot: false,
        submitting: false,
        submitted: false
    };

    constructor(props) {
        super(props);

        this._counter = null;
    }

    handleContextRef = contextRef => this.setState({contextRef});

    componentDidMount = async () => {
        let {examId} = this.props.match.params;

        // ponytail: api.js reject khi code!==200 -> không bắt thì 403 (đề có phí)
        // nuốt im lặng thành loader quay mãi.
        try {
            let exam = await Api.get('exam/during_test/' + examId);
            // Vua nop xong roi F5: BE tra ve bai da nop (da_nop) thay vi de,
            // khong tru them luot. Hien thang man ket qua.
            if (exam && exam.da_nop) {
                return this.setState({submitted: true, result: exam});
            }
            // ponytail: de da hien ra man hinh la da doc duoc -> tinh gio NGAY.
            // Nut Start cu cho thi sinh doc het de roi moi bam, tinh gio bang 0.
            this.setState({exam}, this.startExam);
        } catch (e) {
            // 402 = hết lượt -> chặn TẠI CHỖ bằng popup, không đá sang trang
            // khác: học sinh đang muốn làm đúng đề này.
            if (e && e.code === 402) return this.setState({hetLuot: true});
            if (e && e.code === 403) return this.props.history.push('/packages');
            this.setState({loadError: (e && (e.error || e.message)) || 'Không tải được đề thi'});
        }
    };

    setAnswer = async (questionId, answer) => {
        let {exam} = this.state;

        // ponytail: doc store ngoai React (getState) thay vi hook — DoExam van
        // la class component. Chuyen ca file 429 dong sang hooks chi de lay mot
        // id nguoi dung la rui ro khong dang, day la duong lam bai va tru luot.
        let user = useAuthStore.getState().user;

        await Api.post('exam/save_answer/' + questionId, {
            answer:answer,
            user_id: user && user.id
        });

        exam.sections.forEach((section)=> {
            section.questions.map(question => {
                if(question.id === questionId){
                    question.markedAnswer = answer;
                    return question;
                }
                return question;
            })
        });
        this.setState({exam});
    };

    // Danh sach cau theo DUNG thu tu hien tren man, kem so thu tu. Dung cho
    // ca bang dieu huong lan canh bao truoc khi nop — mot nguon su that, khong
    // dem hai noi roi lech nhau.
    //
    // Bo qua cau `data` rong y het luc render, neu khong bang se danh so lech
    // so voi "Question N" trong bai.
    dsCau = () => {
        let {exam} = this.state;
        let ds = [];
        (exam ? exam.sections : []).forEach(s => (s.questions || []).forEach(q => {
            if (!q.data || !Object.keys(q.data).length) return;
            ds.push({q, so: ds.length + 1});
        }));
        return ds;
    };

    // Chua lam = chua co markedAnswer. Editor tra ve HTML nen chuoi rong that
    // su co the la '<p></p>' hoac '<br>' — striptags roi trim moi biet.
    chuaLam = () => this.dsCau().filter(({q}) => {
        let a = q.markedAnswer;
        if (a === null || a === undefined) return true;
        return !striptags(String(a)).replace(/&nbsp;/g, ' ').trim();
    });

    // ponytail: bug gốc 2018 — rời trang giữa chừng thì setInterval đếm giờ vẫn
    // chạy và setState trên component đã unmount (React 18 cảnh báo memory leak).
    componentWillUnmount = () => {
        clearInterval(this._counter);
    };

    // ponytail: bug gốc 2018 — finish() chỉ alert(), không gọi API nào. Giờ nó
    // là chỗ ĐÓNG LƯỢT THI: nộp bài xong đơn hết hiệu lực, làm lại phải mua đơn mới.
    finish = async () => {
        let {passedTime, submitting, submitted} = this.state;
        if (submitting || submitted) return;

        // Canh bao cau chua lam TRUOC khi hoi nop. Khong chan cung: hoc sinh
        // co quyen bo cau kho, va het gio thi autoSubmit van phai nop duoc.
        // Chi bao ro dang bo bao nhieu cau va la nhung cau nao.
        let thieu = this.chuaLam();
        if (thieu.length) {
            let ten = thieu.map(c => c.so).join(', ');
            if (!window.confirm(
                'Còn ' + thieu.length + ' câu chưa làm: câu ' + ten + '.\n\n' +
                'Nộp bài bây giờ thì những câu này tính 0 điểm. Vẫn nộp?')) return;
        }

        if (!window.confirm('Nộp bài? Sau khi nộp, muốn làm lại đề này sẽ tính thêm một lượt.')) return;

        this.setState({submitting: true});
        let result;
        try {
            result = await Api.post('exam/submit/' + this.props.match.params.examId);
        } catch (e) {
            this.setState({submitting: false});
            return alert((e && (e.error || e.message)) || 'Nộp bài thất bại, thử lại.');
        }

        clearInterval(this._counter);
        this.setState({submitting: false, submitted: true, passedTime, result});
    };

    startExam = () => {
        let {exam} = this.state;
        // ponytail: đồng hồ chạy trên SERVER. `remaining_sec` là số giây thật sự
        // còn lại của lượt (server chốt hạn nộp lúc mở lượt), không phải
        // exam.duration — đóng tab 20 phút rồi mở lại thì mất đúng 20 phút đó,
        // chứ không được cấp lại nguyên thời gian như bản đếm ở FE trước đây.
        // null = đề không giới hạn thời gian.
        let limit = exam.remaining_sec;
        if (limit === null || limit === undefined) limit = (exam.duration || 0) * 60;

        // Mốc để trừ đi thời gian trôi tại máy học sinh giữa hai tick.
        this.setState({startAt: new Date(), remainingTime: limit});
        if (!limit) return;

        this._counter = setInterval(() => {
            let passedTime = this.calculPassedTime();
            // max(0) — khong thi giay cuoi hien '-1:-05' truoc khi kip nop.
            let remainingTime = Math.max(0, limit - passedTime);
            this.setState({passedTime, remainingTime});

            // Het gio thi nop thay thi sinh, khong de ho lam tiep vo han.
            if (remainingTime <= 0) {
                clearInterval(this._counter);
                this.autoSubmit();
            }
        }, 1000);
    };

    // ponytail: tach khoi finish() vi finish() co window.confirm — het gio ma
    // con hoi thi sinh 'co chac khong' la vo nghia, ho bam Cancel la lam tiep.
    autoSubmit = async () => {
        if (this.state.submitting || this.state.submitted) return;

        this.setState({submitting: true});
        let result;
        try {
            result = await Api.post('exam/submit/' + this.props.match.params.examId);
        } catch (e) {
            // Nop that bai van phai khoa bai lai, khong tra ve man lam bai.
        }
        this.setState({submitting: false, submitted: true, result});
        alert('Đã hết giờ làm bài. Bài của bạn được nộp tự động.');
    };

    calculPassedTime = () => {
        return Math.round((+new Date() - +this.state.startAt) / 1000);
    };

    render() {
        const {contextRef} = this.state;
        let {exam, remainingTime, startAt} = this.state;
        let qIdx = 0;

        if (this.state.loadError) {
            return <Message negative className='margin'>{this.state.loadError}</Message>;
        }

        // Hết lượt: đề không tải được nên `exam` luôn null -> popup phải đứng
        // TRƯỚC nhánh loader, không thì học sinh nhìn vòng quay mãi.
        if (this.state.hetLuot) return <HetLuotModal open/>;

        if (!exam) {
            return <Loading/>;
        }

        if (this.state.submitted) {
            let r = this.state.result;
            return <Segment className='margin text-center' padded='very'>
                <Icon name='check circle' color='green' size='huge'/>
                <h2>Đã nộp bài</h2>
                {/* Uu tien duration_sec tu bai da nop: sau F5 thi passedTime
                    trong state ve 0, hien "0 phut" la sai. */}
                <p>Thời gian làm bài: {Math.floor(
                    ((r && r.duration_sec) || this.state.passedTime) / 60)} phút</p>

                {/* Tach tung phan thay vi mot con so gop: hoc sinh can biet
                    phan nao may da cham, phan nao con cho giao vien. Bai cu
                    (nop truoc khi co section_name) khong co r.phan -> roi ve
                    dong tong nhu truoc, khong hien bang rong. */}
                {r && r.phan && r.phan.length > 0 ? <BangDiem phan={r.phan}/> : <Fragment>
                    {/* Mau so phai la graded_max_score (diem toi da cua rieng
                        phan DA cham), khong phai max_score ca bai: bai 10 trac
                        nghiem + 2 tu luan hien '0/12' lam hoc sinh tuong sai
                        het 12 cau. */}
                    {r && r.pending_count > 0 &&
                    <p>Phần trắc nghiệm: <b>{round(r.score)}/{round(r.graded_max_score)}</b> điểm.
                        Còn {r.pending_count} câu tự luận chờ giáo viên chấm
                        (tổng cả bài {round(r.max_score)} điểm).</p>}
                    {r && r.pending_count === 0 && r.max_score > 0 &&
                    <p>Điểm của bạn: <b>{round(r.score)}/{round(r.max_score)}</b></p>}
                </Fragment>}

                {r && r.id &&
                <Button primary onClick={() => this.props.history.push('/my-exams/' + r.id)}>
                    Xem lại bài làm
                </Button>}
                <Button onClick={() => this.props.history.push('/')}>Về trang chủ</Button>
            </Segment>;
        }

        return <Grid id="Exam" className='margin padding'>
            <Grid.Column width={13}>
                <div ref={this.handleContextRef}>
                    <Segment>
                        {exam.sections.map((s, idx) => {
                            return <div className="section" style={{marginTop: '10px'}} key={s.id}>
                                <h4>Part {idx + 1}: </h4>

                                {renderHTML(s.name || '')}

                                {s.questions.map((q, idx) => {
                                    if (!Object.keys(q.data).length)
                                        return null;
                                    qIdx++;

                                    return <Fragment key={q.id}>
                                        <Passage question={q} prev={s.questions[idx - 1]}/>

                                        {/* id de bang dieu huong ben phai cuon toi dung cau. */}
                                        <i id={'cau-' + q.id}><b>Question {qIdx}:</b></i>

                                        {q.type === 'FillBlank' &&
                                        <div className='question FillBlank'>
                                            <span>{renderHTML(q.data.question || '')}</span>
                                            <Editor
                                                placeholder='Type your answer here...'
                                                onChange={answer => this.setAnswer(q.id, answer)}
                                                disableReturn={true}
                                                disableStyle={true}
                                                text={q.markedAnswer}
                                            />
                                        </div>
                                        }

                                        {q.type === 'TrueFalse' &&
                                        <div className='question TrueFalse'>
                                            <span>{renderHTML(q.data.question)}</span>
                                            <Radio label='A.True'
                                                   checked={q.markedAnswer==='true'}
                                                   name={'answerTrueFale-' + q.id}
                                                   onChange={() => this.setAnswer(q.id, 'true')}/>
                                            <br/>
                                            <Radio label='B.False'
                                                   checked={q.markedAnswer==='false'}
                                                   name={'answerTrueFale-' + q.id}
                                                   onChange={() => this.setAnswer(q.id, 'false')}/>
                                        </div>
                                        }

                                        {(q.type === 'MultipleChoice' || q.type === 'ErrorIdentify') &&
                                        <div className={'question ' + q.type}>
                                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}

                                            <div className='no-margin no-padding'>
                                                {/* ponytail: bug gốc 2018 — mọi câu chung name='answer' nên
                                                    chọn câu sau bỏ chọn câu trước. Nhóm radio theo id câu hỏi. */}
                                                {q.data.answers && q.data.answers.map((answer, i) => {
                                                    let checked = answer.value === q.markedAnswer;

                                                    return <div key={i}>
                                                        <Radio type='radio' value={answer.value}
                                                               label={numToChar(i) + '. ' + answer.value}
                                                               name={'answer-' + q.id}
                                                               onChange={(e, {value}) => this.setAnswer(q.id, value)}
                                                               checked={checked}
                                                        />
                                                    </div>
                                                })}
                                            </div>
                                        </div>
                                        }

                                        {q.type === 'FreeAnswer' &&
                                        <div className={'question FreeAnswer'}>
                                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}
                                            <Editor
                                                placeholder='Type your answer here...'
                                                onChange={answer => this.setAnswer(q.id, answer)}
                                                disableReturn={true}
                                                disableStyle={true}
                                                maxChars={q.data.max_chars}
                                                maxWords={q.data.max_words}
                                                text={q.markedAnswer}
                                            />
                                        </div>
                                        }

                                        <hr/>
                                    </Fragment>
                                })}
                            </div>
                        })}
                    </Segment>

                    <Rail position='right' style={{width: '24%', margin: 0, padding: 0}} className='text-center margin-top'>
                        <Sticky context={contextRef}>
                            {startAt && exam.duration > 0 &&
                            <h1 className={'text-center' + (remainingTime <= 60 ? ' time-up' : '')}>
                                {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
                            </h1>
                            }

                            {startAt && !exam.duration &&
                            <div className='text-center'>Không giới hạn thời gian</div>
                            }

                            {/* Bang cau hoi: o to = da lam, o trang = chua.
                                Khong co no thi hoc sinh chi biet minh bo sot
                                dung luc bam Nop — qua muon de tim lai cau nao. */}
                            {startAt && (() => {
                                let ds = this.dsCau();
                                // Tinh MOT lan thanh Set, khong goi chuaLam()
                                // lai trong vong lap (O(n^2) khong vi co).
                                let trong = new Set(this.chuaLam().map(c => c.q.id));
                                return <div className='tk-cau-nav'>
                                    <div className='tk-cau-grid'>
                                        {ds.map(({q, so}) => {
                                            let xong = !trong.has(q.id);
                                            return <button key={q.id} type='button'
                                                    className={'tk-cau' + (xong ? ' xong' : '')}
                                                    title={xong ? 'Đã làm' : 'Chưa làm'}
                                                    onClick={() => {
                                                        let el = document.getElementById('cau-' + q.id);
                                                        if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                                                    }}>
                                                {so}
                                            </button>;
                                        })}
                                    </div>
                                    <div className='tk-cau-dem'>
                                        {trong.size === 0
                                            ? <span className='du'><Icon name='check circle'/> Đã làm hết</span>
                                            : <span>Còn <b>{trong.size}</b>/{ds.length} câu chưa làm</span>}
                                    </div>
                                </div>;
                            })()}

                            {startAt &&
                            <Button onClick={this.finish} color='blue' fluid className='margin-top'
                                    loading={this.state.submitting} disabled={this.state.submitting}>
                                <Icon name='check'/> Nộp bài
                            </Button>
                            }
                        </Sticky>
                    </Rail>
                </div>
            </Grid.Column>
        </Grid>
    }
}

export default withRouter(DoExam);
