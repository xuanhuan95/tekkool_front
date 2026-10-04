import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {Button, Form, Header, Icon, Input, Label, Message, Segment, TextArea} from 'semantic-ui-react';

import Loading from '../../components/Loading';
import renderHTML from '../../components/SafeHtml';
import Api from '../../services/api';
import {numToChar} from '../../services/tools';
import {useAuthStore} from '../../stores/authStore';
import type {SubmissionAnswer, SubmissionDetail as Sub} from '../../types/submission';
import {fmtDate, fmtDuration, round, ScoreLabel} from './fmt';

/** Điểm/nhận xét giáo viên đang gõ, khoá theo `question_id`. */
type Draft = Record<string, string>;

/**
 * Xem lại một bài đã nộp. MỘT màn cho cả hai vai:
 *  - học sinh: đọc bài mình làm, đáp án đúng, điểm, lời phê
 *  - giáo viên (chủ đề): thêm ô nhập điểm + ô phê cho từng câu tự luận
 *
 * ponytail: không tách hai màn vì nội dung hiển thị y hệt nhau, chỉ khác chỗ
 * ô nhập có hiện hay không. Hai file là hai chỗ phải sửa mỗi lần đổi cách hiện bài.
 */
export default function SubmissionDetail() {
    const {id} = useParams();
    const user = useAuthStore(s => s.user);

    const [sub, setSub] = useState<Sub | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scores, setScores] = useState<Draft>({});
    const [comments, setComments] = useState<Draft>({});
    const [teacherComment, setTeacherComment] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        Api.get<Sub>('exam/submission/' + id)
            .then(s => { setSub(s); setTeacherComment(s.teacher_comment || ''); })
            .catch((e: any) => setError((e && (e.error || e.message)) || 'Không xem được bài này'));
    }, [id]);

    // Quyền chấm do BE quyết (`can_grade` = chủ đề). `user` chỉ để chắc chắn
    // phiên còn sống — khách vãng lai không bao giờ mở được màn này.
    const canGrade = !!(sub && sub.can_grade && user);

    // Giá trị đang hiện trong ô điểm: ưu tiên cái giáo viên vừa gõ.
    const scoreOf = (a: SubmissionAnswer) => {
        const v = scores[a.question_id];
        if (v !== undefined) return v;
        return a.score === null || a.score === undefined ? '' : String(a.score);
    };

    const commentOf = (a: SubmissionAnswer) =>
        comments[a.question_id] !== undefined ? comments[a.question_id] : (a.comment || '');

    const save = async () => {
        setSaving(true);
        setSaved(false);
        try {
            // Lấy lại bản BE trả về: điểm tổng và trạng thái do BE tính,
            // không tự đoán ở FE.
            const fresh = await Api.post<Sub>('exam/grade/' + id, {
                scores, comments, teacher_comment: teacherComment,
            });
            setSub(fresh);
            setScores({});
            setComments({});
            setSaved(true);
        } catch (e: any) {
            alert((e && (e.error || e.message)) || 'Lưu điểm thất bại');
        }
        setSaving(false);
    };

    /**
     * Hiện lại ĐÚNG những gì học sinh nhìn thấy lúc làm bài: ngữ liệu đọc hiểu
     * in một lần đầu nhóm, trắc nghiệm hiện đủ A/B/C/D.
     *
     * ponytail: trước đây chỉ in ra chuỗi học sinh đã chọn, giáo viên không
     * thấy các phương án còn lại nên không biết em ấy đã cân nhắc giữa những gì.
     */
    const renderAnswer = (a: SubmissionAnswer, idx: number, list: SubmissionAnswer[]) => {
        const grading = canGrade && !a.auto_graded;
        const wrong = a.auto_graded && a.score === 0;

        // Ngữ liệu chung: chỉ in ở câu ĐẦU nhóm, y như màn làm bài.
        const prev = list[idx - 1];
        const showPassage = a.passage && !(prev && prev.passage_id === a.passage_id);

        const choices = a.answers || [];

        return <Segment key={a.question_id} className='sub-answer'>
            {showPassage &&
            <div className='sub-passage'>{renderHTML(a.passage || '')}</div>}

            <div className='sub-answer-head'>
                <b>Câu {idx + 1}</b>
                {/* ponytail: bỏ nhãn Đúng/Sai — điểm '1 / 1' ngay bên cạnh đã nói
                    điều đó rồi, và chấm màu ở từng phương án nói lần thứ ba. */}
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
                    const picked = c.value === a.answer || c.id === a.answer;
                    const isKey = c.id === a.correct_id;
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
                               value={scoreOf(a)}
                               onChange={(_e, {value}) => {
                                   setScores(s => ({...s, [a.question_id]: value}));
                                   setSaved(false);
                               }}/>
                    </Form.Field>
                </Form.Group>
                <TextArea rows={2} placeholder='Nhận xét cho câu này…'
                          value={commentOf(a)}
                          onChange={(_e, {value}) => {
                              setComments(c => ({...c, [a.question_id]: String(value ?? '')}));
                              setSaved(false);
                          }}/>
            </Form>}

            {!grading && a.comment &&
            <Message size='tiny' info className='sub-comment'>
                <Icon name='comment outline'/> {a.comment}
            </Message>}
        </Segment>;
    };

    if (error) return <Message negative className='margin'>{error}</Message>;
    if (!sub) return <Loading/>;

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

        {(sub.answers || []).map(renderAnswer)}

        {canGrade &&
        <Segment>
            <div className='sub-label'>Nhận xét cho cả bài</div>
            <Form>
                <TextArea rows={3} value={teacherComment}
                          placeholder='Nhận xét chung…'
                          onChange={(_e, {value}) => {
                              setTeacherComment(String(value ?? ''));
                              setSaved(false);
                          }}/>
            </Form>

            <Button primary className='margin-top' onClick={save}
                    loading={saving} disabled={saving}>
                <Icon name='save'/> Lưu điểm
            </Button>
            {saved && <span className='margin-left text-muted'>Đã lưu</span>}
        </Segment>}

        {!canGrade && sub.teacher_comment &&
        <Message info>
            <Message.Header>Nhận xét của giáo viên</Message.Header>
            {sub.teacher_comment}
        </Message>}
    </div>;
}
