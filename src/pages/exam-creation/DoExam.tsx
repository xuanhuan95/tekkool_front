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
import OutOfTurnsModal from "../../components/OutOfTurnsModal";
import {round} from "../my/fmt";
import {blockStyle} from './blockTypes';
import type {RouterProps} from '../../withRouter';
import type {Question, Section} from './Default';
import type {ScoreSection, Submission} from '../../types/submission';


/**
 * The exam as returned by `exam/during_test/<id>`. Differs from the authoring
 * screen's `Exam` in two ways: each question carries `markedAnswer` (the
 * in-progress answer), and the exam has `remaining_sec` — the clock is fixed
 * on the SERVER, not recomputed from `duration`.
 */
type ExamQuestion = Question & {markedAnswer?: string | null};

/** `loai` only exists on exams drawn from the question bank — colors the section by block type. */
type ExamSection = Omit<Section, 'questions'> & {questions: ExamQuestion[]; loai?: string};

type TestExam = {
    id: string;
    name?: string;
    duration?: number;
    sections: ExamSection[];
    /** Seconds left in the attempt. null/undefined = exam has no time limit. */
    remaining_sec?: number | null;
    /** BE returns the submitted work instead of the exam when the student refreshes after submitting. */
    da_nop?: boolean;
};

/** Extract the error message from an Api exception. */
const errorMessage = (e: any, fallback: string) => (e && (e.error || e.message)) || fallback;


// Per-section score table on the "Submitted" screen.
// Split into 2 groups by pending, not by block_type: students care about
// "who grades this", not the question type. A section with any ungraded
// question is "waiting for the teacher" as a whole — a half-graded section is
// worse than an ungraded one.
function ScoreTable({sections}: {sections: ScoreSection[]}) {
    const auto = sections.filter(p => !p.pending);
    const manual = sections.filter(p => p.pending);
    const total = auto.reduce((t, p) => t + p.score, 0);
    const totalMax = auto.reduce((t, p) => t + p.max_score, 0);
    return <div className='tk-result'>
        {auto.length > 0 && <Fragment>
            <div className='tk-result-group'>Phần trắc nghiệm:</div>
            {auto.map(p => <div className='tk-result-row' key={p.ten}>
                <span>{p.ten}</span>
                <b>{round(p.score)}/{round(p.max_score)} điểm</b>
            </div>)}
            {auto.length > 1 && <div className='tk-result-row tk-result-total'>
                <span>Tổng</span><b>{round(total)}/{round(totalMax)} điểm</b>
            </div>}
        </Fragment>}
        {manual.length > 0 && <Fragment>
            <div className='tk-result-group'>Phần tự luận:</div>
            {manual.map(p => <div className='tk-result-row' key={p.ten}>
                <span>{p.ten}</span>
                <i>chờ giáo viên chấm</i>
            </div>)}
        </Fragment>}
    </div>;
}


type State = {
    exam: TestExam | null;
    startAt: Date | null;
    passedTime: number;
    remainingTime: number;
    loadError: string | null;
    outOfTurns: boolean;
    submitting: boolean;
    submitted: boolean;
    /** The submitted work, used to draw the result screen. The old version missed it in the initial state. */
    result: (Submission & {phan?: ScoreSection[]}) | null;
    /** Anchor for the right column's <Sticky>. Must be a ref that IS attached, not a plain variable. */
    contextRef: HTMLElement | null;
};

class DoExam extends React.Component<RouterProps, State> {
    state: State = {
        exam: null,
        startAt: null,
        passedTime: 0,
        remainingTime: 0,
        loadError: null,
        outOfTurns: false,
        submitting: false,
        submitted: false,
        result: null,
        contextRef: null,
    };

    /** id of the countdown setInterval. null when the exam has no time limit. */
    _counter: ReturnType<typeof setInterval> | null = null;

    handleContextRef = (contextRef: HTMLElement | null) => this.setState({contextRef});

    componentDidMount = async () => {
        let {examId} = this.props.match.params;

        // ponytail: api.js rejects when code!==200 -> if not caught, a 403 (paid exam)
        // is silently swallowed into a loader spinning forever.
        try {
            // ?lam_lai=1 goes straight to the BE: clicking an exam from the list means
            // the student DELIBERATELY wants to take it. Without this flag the BE treats
            // every entry within 15 minutes after submitting as "F5 to review the result"
            // and pushes out the old result screen — the student clicks the exam, cannot
            // get in, and thinks the app is broken.
            const retake = new URLSearchParams(this.props.location.search).get('lam_lai') === '1';
            const exam: TestExam & {da_nop?: boolean} = await Api.get(
                'exam/during_test/' + examId + (retake ? '?lam_lai=1' : ''));
            // Just submitted then F5: BE returns the submitted work (da_nop) instead of the
            // exam, without deducting another attempt. Show the result screen directly.
            if (exam && exam.da_nop) {
                return this.setState({submitted: true, result: exam as any});
            }
            // ponytail: once the exam is on screen it can be read -> start the clock NOW.
            // The old Start button let candidates read the whole exam before pressing it,
            // timing from zero.
            this.setState({exam}, this.startExam);
        } catch (e: any) {
            // 402 = out of attempts -> block IN PLACE with a popup, do not redirect
            // elsewhere: the student wants to take exactly this exam.
            if (e && e.code === 402) return this.setState({outOfTurns: true});
            if (e && e.code === 403) return this.props.history.push('/packages');
            this.setState({loadError: errorMessage(e, 'Không tải được đề thi')});
        }
    };

    setAnswer = async (questionId: string, answer: string) => {
        const {exam} = this.state;
        if (!exam) return;

        // ponytail: read the store outside React (getState) instead of a hook — DoExam is
        // still a class component. Converting the whole 429-line file to hooks just to get
        // a user id is an unjustified risk; this is the exam-taking and attempt-deducting path.
        let user = useAuthStore.getState().user;

        // ponytail: if the network flickers mid-exam, `await` throws, state does not change
        // AND there is no notification — the student clicks an answer, sees the button not
        // light up, thinks they missed and clicks again; on submit those questions score 0.
        // Report clearly in one sentence then return: do not write to state something that
        // could not be saved, otherwise the screen says "selected" while the server has nothing.
        try {
            await Api.post('exam/save_answer/' + questionId, {
                answer: answer,
                user_id: user && user.id
            });
        } catch (e) {
            return alert(errorMessage(e, 'Chưa lưu được câu trả lời. Kiểm tra mạng rồi chọn lại.'));
        }

        // ponytail: mutate IN PLACE then setState to re-render — keeps the old behavior.
        // The old version used `.map()` but threw the result away, reading like immutable
        // code while actually assigning straight into `question`; anyone cleaning up
        // "map result unused" and dropping the assignment loses the in-progress work.
        exam.sections.forEach(section => section.questions.forEach(q => {
            if (q.id === questionId) q.markedAnswer = answer;
        }));
        this.setState({exam});
    };

    // Question list in EXACTLY the on-screen order, with sequence numbers. Used for
    // both the navigation grid and the warning before submitting — one source of
    // truth, not counted in two places that then drift apart.
    //
    // Skips questions with empty `data` exactly like render does, otherwise the grid
    // would number differently from "Question N" in the exam.
    questionList = (): Array<{q: ExamQuestion; num: number}> => {
        const {exam} = this.state;
        const list: Array<{q: ExamQuestion; num: number}> = [];
        (exam ? exam.sections : []).forEach(s => (s.questions || []).forEach(q => {
            if (!q.data || !Object.keys(q.data).length) return;
            list.push({q, num: list.length + 1});
        }));
        return list;
    };

    // Unanswered = no markedAnswer yet. Editor returns HTML num a truly empty string
    // can be '<p></p>' or '<br>' — only striptags then trim tells.
    unanswered = () => this.questionList().filter(({q}) => {
        let a = q.markedAnswer;
        if (a === null || a === undefined) return true;
        return !striptags(String(a)).replace(/&nbsp;/g, ' ').trim();
    });

    // ponytail: original 2018 bug — leaving the page midway left the countdown
    // setInterval running and calling setState on an unmounted component (React 18
    // warns about a memory leak).
    componentWillUnmount = () => this.stopCounter();

    stopCounter = () => {
        if (this._counter) clearInterval(this._counter);
        this._counter = null;
    };

    // ponytail: original 2018 bug — finish() only alert()ed, calling no API. Now it is
    // where the attempt is CLOSED: after submitting the order expires, retaking needs a new order.
    finish = async () => {
        const {passedTime, submitting, submitted} = this.state;
        if (submitting || submitted) return;

        // Warn about unanswered questions BEFORE asking to submit. Not a hard block: students
        // may skip hard questions, and when time runs out autoSubmit must still submit.
        // Just state clearly how many questions are skipped and which ones.
        let missing = this.unanswered();
        if (missing.length) {
            let names = missing.map(c => c.num).join(', ');
            if (!window.confirm(
                'Còn ' + missing.length + ' câu chưa làm: câu ' + names + '.\n\n' +
                'Nộp bài bây giờ thì những câu này tính 0 điểm. Vẫn nộp?')) return;
        }

        if (!window.confirm('Nộp bài? Sau khi nộp, muốn làm lại đề này sẽ tính thêm một lượt.')) return;

        this.setState({submitting: true});
        let result;
        try {
            result = await Api.post('exam/submit/' + this.props.match.params.examId);
        } catch (e) {
            this.setState({submitting: false});
            return alert(errorMessage(e, 'Nộp bài thất bại, thử lại.'));
        }

        this.stopCounter();
        this.setState({submitting: false, submitted: true, passedTime, result});
    };

    startExam = () => {
        const {exam} = this.state;
        if (!exam) return;
        // ponytail: the clock runs on the SERVER. `remaining_sec` is the real number of
        // seconds left in the attempt (the server fixes the deadline when the attempt
        // opens), not exam.duration — close the tab for 20 minutes and reopen and exactly
        // those 20 minutes are lost, instead of getting the full time back as with the old
        // FE-side counting. null = exam has no time limit.
        let limit = exam.remaining_sec;
        if (limit === null || limit === undefined) limit = (exam.duration || 0) * 60;
        const deadline = limit;

        // Reference point to subtract time elapsed on the student's machine between two ticks.
        this.setState({startAt: new Date(), remainingTime: limit});
        if (!limit) return;

        this._counter = setInterval(() => {
            const passedTime = this.calculPassedTime();
            // max(0) — otherwise the last second shows '-1:-05' before the submit gets in.
            const remainingTime = Math.max(0, deadline - passedTime);
            this.setState({passedTime, remainingTime});

            // When time is up, submit for the candidate; do not let them continue indefinitely.
            if (remainingTime <= 0) {
                this.stopCounter();
                this.autoSubmit();
            }
        }, 1000);
    };

    // ponytail: separate from finish() because finish() has window.confirm — asking the
    // candidate 'are you sure' after time is up is pointless, they press Cancel and keep going.
    autoSubmit = async () => {
        if (this.state.submitting || this.state.submitted) return;

        this.setState({submitting: true});
        let result = null;
        try {
            result = await Api.post('exam/submit/' + this.props.match.params.examId);
        } catch (e) {
            // A failed submit must still lock the exam, not return to the exam screen.
        }
        this.setState({submitting: false, submitted: true, result});
        alert('Đã hết giờ làm bài. Bài của bạn được nộp tự động.');
    };

    calculPassedTime = () =>
        Math.round((Date.now() - Number(this.state.startAt)) / 1000);

    render() {
        const {contextRef, exam, remainingTime, startAt} = this.state;
        let qIdx = 0;

        if (this.state.loadError) {
            return <Message negative className='margin'>{this.state.loadError}</Message>;
        }

        // Out of attempts: the exam cannot load num `exam` is always null -> the popup must
        // come BEFORE the loader branch, otherwise the student stares at a spinner forever.
        if (this.state.outOfTurns) return <OutOfTurnsModal open/>;

        // ponytail: the RESULT screen must come BEFORE the loader branch. F5 right after
        // submitting: BE returns the submitted work (da_nop), NOT the exam, num `exam` is
        // still null -> the `if (!exam)` branch swallows the result screen and the student
        // stares at a spinner, never seeing the score. Same reason as outOfTurns above.
        if (this.state.submitted) {
            const r = this.state.result;
            // Celebrate only when JUST submitted; not on F5 reviewing the result (da_nop).
            const celebrate = !(r && (r as {da_nop?: boolean}).da_nop);
            return <Segment className='margin text-center tk-submitted' padded='very'>
                {celebrate && <div className='tk-confetti' aria-hidden='true'>
                    {Array.from({length: 18}, (_x, i) => <i key={i} style={{
                        left: (i * 53) % 100 + '%',
                        animationDelay: (i % 6) * 0.12 + 's',
                        background: ['var(--tk-block-reading)', 'var(--tk-block-paragraph)', 'var(--tk-block-essay)', 'var(--tk-block-choice)', 'var(--tk-block-short)', 'var(--tk-block-essay-math)'][i % 6],
                    }}/>)}
                </div>}
                <Icon name='check circle' color='green' size='huge' className='tk-submitted-icon'/>
                <h2>Đã nộp bài</h2>
                {/* Prefer duration_sec from the submitted work: after F5 passedTime
                    in state is 0, and showing "0 phút" would be wrong. */}
                <p>Thời gian làm bài: {Math.floor(
                    ((r && r.duration_sec) || this.state.passedTime) / 60)} phút</p>

                {/* Split per section instead of one combined number: students need to know
                    which sections the machine graded and which still wait for the teacher.
                    Old submissions (made before section_name existed) have no r.phan -> fall
                    back to the total line as before, no empty table. */}
                {r && r.phan && r.phan.length > 0 ? <ScoreTable sections={r.phan}/> : <Fragment>
                    {/* The denominator must be graded_max_score (max score of just the
                        graded part), not the whole exam's max_score: an exam with 10
                        multiple-choice + 2 essay questions showing '0/12' makes students
                        think they got all 12 wrong. */}
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
                {/* Retake right from the result screen: without this button students
                    must go back to the exam list and click in again to continue. */}
                <Button onClick={() => {
                    this.props.history.replace(
                        '/do-exam/' + this.props.match.params.examId + '?lam_lai=1');
                    window.location.reload();
                }}>Làm lại</Button>
                <Button onClick={() => this.props.history.push('/')}>Về trang chủ</Button>
            </Segment>;
        }

        if (!exam) {
            return <Loading/>;
        }

        const list = this.questionList();
        // Compute ONCE into a Set, do not call unanswered() again inside the loop (pointless O(n^2)).
        const emptyIds = new Set(this.unanswered().map(c => c.q.id));
        const doneCount = list.length - emptyIds.size;
        const durationSec = (exam.duration || 0) * 60;
        // Under 5 minutes: yellow. Under 1 minute: red and blinking — num they submit before the system auto-submits.
        const timerLevel = remainingTime <= 60 ? ' time-up' : remainingTime <= 300 ? ' time-low' : '';

        return <Grid id="Exam" className='margin padding'>
            <Grid.Column width={13}>
                <div ref={this.handleContextRef}>
                    <Segment>
                        {exam.sections.map((s, idx) => {
                            const m = blockStyle(s.loai);
                            return <div className="section tk-part" key={s.id}
                                        style={{'--block-color': m.color} as React.CSSProperties}>
                                <div className='tk-part-head'>
                                    <span className='tk-part-num'><Icon name={m.icon}/></span>
                                    <div>
                                        <small>Phần {idx + 1}</small>
                                        <div className='tk-part-name'>{renderHTML(s.name || '')}</div>
                                    </div>
                                </div>

                                {s.questions.map((q, idx) => {
                                    if (!Object.keys(q.data).length)
                                        return null;
                                    qIdx++;

                                    return <Fragment key={q.id}>
                                        <Passage question={q} prev={s.questions[idx - 1]} questions={s.questions}/>

                                        {/* id num the navigation grid on the right can scroll to the right question. */}
                                        <i id={'q-' + q.id} className={'tk-qlabel' + (emptyIds.has(q.id) ? '' : ' done')}>
                                            <b>Question {qIdx}:</b>
                                            {!emptyIds.has(q.id) && <Icon name='check circle' aria-label='Đã làm'/>}
                                        </i>

                                        {q.type === 'FillBlank' &&
                                        <div className='question FillBlank'>
                                            <span>{renderHTML(q.data.question || '')}</span>
                                            <Editor
                                                placeholder='Type your answer here...'
                                                onChange={answer => this.setAnswer(q.id, answer)}
                                                disableReturn={true}
                                                disableStyle={true}
                                                text={q.markedAnswer || undefined}
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
                                                {/* ponytail: original 2018 bug — all questions shared name='answer' num
                                                    choosing a later question cleared the earlier one. Group radios by question id. */}
                                                {q.data.answers && q.data.answers.map((answer: {value: string}, i: number) => {
                                                    const checked = answer.value === q.markedAnswer;

                                                    return <div key={i}>
                                                        <Radio type='radio' value={answer.value}
                                                               label={numToChar(i) + '. ' + answer.value}
                                                               name={'answer-' + q.id}
                                                               onChange={(_e, {value}) => this.setAnswer(q.id, String(value))}
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
                                                text={q.markedAnswer || undefined}
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
                            {startAt && (exam.duration || 0) > 0 &&
                            <div className={'tk-timer' + timerLevel}>
                                <Icon name='clock outline'/>
                                <h1>{Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}</h1>
                                {/* Remaining ring: one glance tells how much is left, no mental math needed. */}
                                <div className='tk-timer-bar'>
                                    <span style={{width: (durationSec ? Math.min(100, remainingTime / durationSec * 100) : 0) + '%'}}/>
                                </div>
                            </div>
                            }

                            {startAt && !exam.duration &&
                            <div className='text-center'>Không giới hạn thời gian</div>
                            }

                            {/* Question grid: filled cell = done, blank = not yet.
                                Without it students only learn they skipped something
                                at the moment they press Submit — too late to find which one. */}
                            {startAt && list.length > 0 &&
                            <div className='tk-progress' role='progressbar' aria-valuemin={0}
                                 aria-valuemax={list.length} aria-valuenow={doneCount}>
                                <div className='tk-progress-text'>
                                    <span>Đã làm</span><b>{doneCount}/{list.length} câu</b>
                                </div>
                                <div className='tk-progress-bar'>
                                    <span style={{width: doneCount / list.length * 100 + '%'}}/>
                                </div>
                            </div>}

                            {startAt &&
                                <div className='tk-qnav'>
                                    <div className='tk-qnav-grid'>
                                        {list.map(({q, num}) => {
                                            const done = !emptyIds.has(q.id);
                                            return <button key={q.id} type='button'
                                                    className={'tk-qnav-cell' + (done ? ' done' : '')}
                                                    title={done ? 'Đã làm' : 'Chưa làm'}
                                                    onClick={() => {
                                                        const el = document.getElementById('q-' + q.id);
                                                        if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                                                    }}>
                                                {num}
                                            </button>;
                                        })}
                                    </div>
                                    <div className='tk-qnav-count'>
                                        {emptyIds.size === 0
                                            ? <span className='done'><Icon name='check circle'/> Đã làm hết</span>
                                            : <span>Còn <b>{emptyIds.size}</b>/{list.length} câu chưa làm</span>}
                                    </div>
                                </div>}

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
