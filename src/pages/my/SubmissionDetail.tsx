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
import {AnswerImageThumbs} from '../exam/AnswerImages';

/** Scores/comments the teacher is typing, keyed by `question_id`. */
type Draft = Record<string, string>;

/**
 * Review a submitted attempt. ONE screen for both roles:
 *  - student: reads their own attempt, the correct answers, score, remarks
 *  - teacher (exam owner): adds a score input + comment input for each essay question
 *
 * ponytail: not split into two screens because the displayed content is identical,
 * only whether the inputs show differs. Two files means two places to edit every time
 * the attempt display changes.
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

    // Grading permission is decided by the BE (`can_grade` = exam owner). `user` is only to
    // make sure the session is alive — a casual visitor can never open this screen.
    const canGrade = !!(sub && sub.can_grade && user);

    // Value currently shown in the score input: prefer what the teacher just typed.
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
            // Take back the version the BE returns: total score and status are computed by the BE,
            // not guessed on the FE.
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
     * Show EXACTLY what the student saw while taking the exam: the reading passage
     * printed once at the start of the group, multiple choice showing all of A/B/C/D.
     *
     * ponytail: it used to print only the string the student chose, so the teacher
     * could not see the other options and did not know what the student weighed between.
     */
    const renderAnswer = (a: SubmissionAnswer, idx: number, list: SubmissionAnswer[]) => {
        const grading = canGrade && !a.auto_graded;
        const wrong = a.auto_graded && a.score === 0;

        // Shared passage: printed only at the FIRST question of the group, same as the exam screen.
        const prev = list[idx - 1];
        const showPassage = a.passage && !(prev && prev.passage_id === a.passage_id);

        const choices = a.answers || [];

        return <Segment key={a.question_id} className='sub-answer'>
            {showPassage &&
            <div className='sub-passage'>{renderHTML(a.passage || '')}</div>}

            <div className='sub-answer-head'>
                <b>Câu {idx + 1}</b>
                {/* ponytail: dropped the Correct/Wrong label — the '1 / 1' score right next to it
                    already says that, and the coloured dot on each option says it a third time. */}
                {!a.auto_graded && a.score === null &&
                <Label size='tiny' color='yellow'>chờ chấm</Label>}
                <span className='sub-answer-score'>
                    {a.score === null ? '—' : round(a.score)} / {round(a.max_score)}
                </span>
            </div>

            <div className='sub-question'>{renderHTML(a.question_text || '')}</div>

            {/* Multiple choice: show every option, mark the one the student chose and
                the correct one — identical to the exam screen, only locked from editing.

                ponytail: a coloured dot instead of a text label 'answer' / 'chosen'.
                The green/red background says enough; another label says the same thing three times. */}
            {!!choices.length &&
            <div className='sub-choices'>
                {choices.map((c, i) => {
                    const picked = c.value === a.answer || c.id === a.answer;
                    const isKey = c.id === a.correct_id;
                    return <div key={c.id || i}
                                className={'sub-choice' + (picked ? ' picked' : '') + (isKey ? ' key' : '')}>
                        <span className='sub-dot'/>
                        {/* renderHTML rather than string concatenation: the option content is HTML,
                            printing it directly makes '->' show up as '-&gt;'. */}
                        <span className='sub-choice-text'>
                            {numToChar(i)}. {renderHTML(c.value || '')}
                        </span>
                    </div>;
                })}
            </div>}

            {/* Essay / fill-in: no options, show the written answer. */}
            {!choices.length &&
            <div>
                <div className='sub-label'>Bài làm của học sinh</div>
                <div className={'sub-given' + (wrong ? ' wrong' : '')}>
                    {a.answer ? renderHTML(a.answer) : <i className='text-muted'>(bỏ trống)</i>}
                </div>
                {!!a.images?.length && <>
                    <div className='sub-label'>Ảnh bài làm · {a.images.length} ảnh</div>
                    <AnswerImageThumbs ids={a.images}/>
                </>}
            </div>}

            {/* Correct answer as text: only needed when there is NO option list
                (fill-in, true/false) — with A/B/C/D it is already marked above. */}
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
