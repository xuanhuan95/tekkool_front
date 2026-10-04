import React, {Component} from 'react';
import Loading from '../../components/Loading';
import withRouter from '../../withRouter';
import {connectGlobalState} from '../../stateUtils';
import {Button, Form, Header, Icon, Input, Label, Message, Segment, TextArea} from 'semantic-ui-react';
import renderHTML from '../../components/SafeHtml';
import Api from '../../services/api';
import {numToChar} from '../../services/tools';
import {fmtDate, fmtDuration, round, ScoreLabel} from './fmt';

/**
 * Xem lại một bài đã nộp. MỘT màn cho cả hai vai:
 *  - học sinh: đọc bài mình làm, đáp án đúng, điểm, lời phê
 *  - giáo viên (chủ đề): thêm ô nhập điểm + ô phê cho từng câu tự luận
 *
 * ponytail: không tách hai màn vì nội dung hiển thị y hệt nhau, chỉ khác chỗ
 * ô nhập có hiện hay không. Hai file là hai chỗ phải sửa mỗi lần đổi cách hiện bài.
 */
class SubmissionDetail extends Component {
    state = {sub: null, error: null, scores: {}, comments: {}, teacherComment: '', saving: false, saved: false};

    componentDidMount = async () => {
        try {
            let sub = await Api.get('exam/submission/' + this.props.match.params.id);
            this.setState({sub, teacherComment: sub.teacher_comment || ''});
        } catch (e) {
            this.setState({error: (e && (e.error || e.message)) || 'Không xem được bài này'});
        }
    };

    // Giáo viên chấm được khi đây là đề của chính mình.
    canGrade = () => {
        let {sub} = this.state;
        let {user} = this.globalState.auth;
        return !!(sub && sub.can_grade && user);
    };

    // Giá trị đang hiện trong ô điểm: ưu tiên cái giáo viên vừa gõ.
    scoreOf = (a) => {
        let v = this.state.scores[a.question_id];
        if (v !== undefined) return v;
        return a.score === null || a.score === undefined ? '' : String(a.score);
    };

    commentOf = (a) => {
        let v = this.state.comments[a.question_id];
        return v !== undefined ? v : (a.comment || '');
    };

    save = async () => {
        let {scores, comments, teacherComment} = this.state;

        this.setState({saving: true, saved: false});
        try {
            let sub = await Api.post('exam/grade/' + this.props.match.params.id, {
                scores, comments, teacher_comment: teacherComment,
            });
            // Lấy lại bản BE trả về: điểm tổng và trạng thái do BE tính, không tự đoán ở FE.
            this.setState({sub, scores: {}, comments: {}, saving: false, saved: true});
        } catch (e) {
            this.setState({saving: false});
            alert((e && (e.error || e.message)) || 'Lưu điểm thất bại');
        }
    };

    /**
     * Hiện lại ĐÚNG những gì học sinh nhìn thấy lúc làm bài: ngữ liệu đọc hiểu
     * in một lần đầu nhóm, trắc nghiệm hiện đủ A/B/C/D.
     *
     * ponytail: trước đây chỉ in ra chuỗi học sinh đã chọn, giáo viên không
     * thấy các phương án còn lại nên không biết em ấy đã cân nhắc giữa những gì.
     */
    renderAnswer = (a, idx, list) => {
        let grading = this.canGrade() && !a.auto_graded;
        let wrong = a.auto_graded && a.score === 0;

        // Ngữ liệu chung: chỉ in ở câu ĐẦU nhóm, y như màn làm bài.
        let prev = list[idx - 1];
        let showPassage = a.passage && !(prev && prev.passage_id === a.passage_id);

        let choices = a.answers || [];

        return <Segment key={a.question_id} className='sub-answer'>
            {showPassage &&
            <div className='sub-passage'>{renderHTML(a.passage)}</div>}

            <div className='sub-answer-head'>
                <b>Câu {idx + 1}</b>
                {/* ponytail: bo nhan Dung/Sai — diem '1 / 1' ngay ben canh da noi
                    dieu do roi, va cham mau o tung phuong an noi lan thu ba. */}
                {!a.auto_graded && a.score === null &&
                <Label size='tiny' color='yellow'>chờ chấm</Label>}
                <span className='sub-answer-score'>
                    {a.score === null ? '—' : round(a.score)} / {round(a.max_score)}
                </span>
            </div>

            <div className='sub-question'>{renderHTML(a.question_text || '')}</div>

            {/* Trắc nghiệm: hiện đủ phương án, đánh dấu cái học sinh chọn và
                cái đúng — giống hệt màn làm bài, chỉ khác là khoá không sửa được.

                ponytail: chấm tròn tô màu thay cho nhãn chữ 'đáp án' / 'đã chọn'.
                Nền xanh/đỏ đã nói đủ; thêm nhãn nữa là nói ba lần một chuyện. */}
            {!!choices.length &&
            <div className='sub-choices'>
                {choices.map((c, i) => {
                    let picked = c.value === a.answer || c.id === a.answer;
                    let isKey = c.id === a.correct_id;
                    return <div key={c.id || i}
                                className={'sub-choice' + (picked ? ' picked' : '') + (isKey ? ' key' : '')}>
                        <span className='sub-dot'/>
                        {/* renderHTML chứ không nối chuỗi: nội dung phương án là HTML,
                            in thẳng thì '->' hiện ra thành '-&gt;'. */}
                        <span className='sub-choice-text'>
                            {numToChar(i)}. {renderHTML(c.value || '')}
                        </span>
                    </div>;
                })}
            </div>}

            {/* Tự luận / điền khuyết: không có phương án, hiện bài viết. */}
            {!choices.length &&
            <div>
                <div className='sub-label'>Bài làm của học sinh</div>
                <div className={'sub-given' + (wrong ? ' wrong' : '')}>
                    {a.answer ? renderHTML(a.answer) : <i className='text-muted'>(bỏ trống)</i>}
                </div>
            </div>}

            {/* Đáp án đúng dạng chữ: chỉ cần khi KHÔNG có danh sách phương án
                (điền khuyết, đúng/sai) — có A/B/C/D rồi thì đã đánh dấu ở trên. */}
            {!choices.length && a.auto_graded && a.correct &&
            <div>
                <div className='sub-label'>Đáp án đúng</div>
                <div className='sub-correct'>{renderHTML(String(a.correct))}</div>
            </div>}

            {grading &&
            <Form className='sub-grade'>
                <Form.Group inline>
                    <Form.Field>
                        <Input size='small' type='number' step='0.25' min={0} max={a.max_score}
                               label={'/ ' + a.max_score} labelPosition='right'
                               placeholder='điểm'
                               value={this.scoreOf(a)}
                               onChange={(e, {value}) => this.setState(({scores}) => ({
                                   scores: {...scores, [a.question_id]: value}, saved: false,
                               }))}/>
                    </Form.Field>
                </Form.Group>
                <TextArea rows={2} placeholder='Nhận xét cho câu này…'
                          value={this.commentOf(a)}
                          onChange={(e, {value}) => this.setState(({comments}) => ({
                              comments: {...comments, [a.question_id]: value}, saved: false,
                          }))}/>
            </Form>}

            {!grading && a.comment &&
            <Message size='tiny' info className='sub-comment'>
                <Icon name='comment outline'/> {a.comment}
            </Message>}
        </Segment>;
    };

    render() {
        let {sub, error, saving, saved, teacherComment} = this.state;

        if (error) return <Message negative className='margin'>{error}</Message>;
        if (!sub) return <Loading/>;

        let grading = this.canGrade();

        return <div className='margin sub-detail'>
            <Header as='h2'>
                {sub.exam_name || '(đề không tên)'}
                <Header.Subheader>
                    {sub.student ? sub.student + ' — ' : ''}
                    Nộp {fmtDate(sub.submitted_at)} · làm trong {fmtDuration(sub.duration_sec)}
                    {sub.auto_submitted && ' · hết giờ, hệ thống nộp thay'}
                </Header.Subheader>
            </Header>

            <Segment className='sub-summary'>
                <span>Tổng điểm</span>
                <ScoreLabel sub={sub}/>
            </Segment>

            {(sub.answers || []).map(this.renderAnswer)}

            {grading &&
            <Segment>
                <div className='sub-label'>Nhận xét cho cả bài</div>
                <Form>
                    <TextArea rows={3} value={teacherComment}
                              placeholder='Nhận xét chung…'
                              onChange={(e, {value}) => this.setState({teacherComment: value, saved: false})}/>
                </Form>

                <Button primary className='margin-top' onClick={this.save}
                        loading={saving} disabled={saving}>
                    <Icon name='save'/> Lưu điểm
                </Button>
                {saved && <span className='margin-left text-muted'>Đã lưu</span>}
            </Segment>}

            {!grading && sub.teacher_comment &&
            <Message info>
                <Message.Header>Nhận xét của giáo viên</Message.Header>
                {sub.teacher_comment}
            </Message>}
        </div>;
    }
}

export default withRouter(connectGlobalState(SubmissionDetail));
