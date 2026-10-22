import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import {
    Button, Card, ConfirmDialog, ExamBanner, ExamEnd, ExamHeader, ExamLayout, ExamSection, Modal,
    QuestionGrid, QuestionNumberStrip, WARN_SECONDS,
} from '../../components/ui';
import type {QuestionGridPart, QuestionStatus} from '../../components/ui';
import {AutosaveNote} from '../../components/ui';
import Passage from '../../components/Passage';
import type {Question as LegacyQuestion} from '../exam-creation/Default';
import {flagsKey, pendingKey, saveAnswer, submitExam} from '../../queries/examSession';
import type {SubmitResponse} from '../../queries/examSession';
import type {ApiError} from '../../services/api';
import type {TestExam} from '../../types/exam';
import {AnswerSaver, clearMirror, isNetworkError, takeMirror} from './answerSaver';
import type {SaverStatus} from './answerSaver';
import {buildPaper, initialAnswers, isAnswered} from './paper';
import type {RawAnswers} from './paper';
import QuestionView from './QuestionView';
import SubmitDialog from './SubmitDialog';
import {useCountdown} from './useCountdown';
import {withSubject} from '../../lib/format';

/** Debounce per kind: clicks go out at once, typing waits for a pause. */
const TEXT_DELAY_MS = 800;

function readFlags(examId: string): Set<number> {
    try {
        const raw = window.localStorage.getItem(flagsKey(examId));
        return new Set(raw ? (JSON.parse(raw) as number[]) : []);
    } catch {
        return new Set();
    }
}

function writeFlags(examId: string, flags: Set<number> | null): void {
    try {
        if (flags && flags.size) window.localStorage.setItem(flagsKey(examId), JSON.stringify([...flags]));
        else window.localStorage.removeItem(flagsKey(examId));
    } catch { /* private mode */ }
}

const hhmm = (d: Date | null) => d ? d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) : null;

function submitErrorMessage(e: unknown): string {
    if (isNetworkError(e)) return 'Nộp bài chưa thành công — kiểm tra mạng rồi bấm Nộp lại. Bài làm của bạn vẫn được giữ.';
    return (e as ApiError)?.error || 'Nộp bài chưa thành công, thử lại.';
}

export type ExamRoomProps = {
    examId: string;
    exam: TestExam;
    /** Wall-clock end (ms) fixed from the server's remaining_sec; null = no time limit. */
    deadlineMs: number | null;
};

/**
 * The exam room: the WHOLE paper on one page (HS-LamBai, HS-Web-LamBai). Answers are saved as the
 * student goes (AnswerSaver), the clock follows the server deadline, time up = locked + auto-submit.
 */
export default function ExamRoom({examId, exam, deadlineMs}: ExamRoomProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const paper = useMemo(() => buildPaper(exam), [exam]);

    // Server answers, then anything a previous load could not save yet (F5 while offline).
    const [mirror] = useState(() => takeMirror(pendingKey(examId)));
    const [answers, setAnswers] = useState<RawAnswers>(() => ({...initialAnswers(exam), ...mirror}));
    const [flags, setFlags] = useState<Set<number>>(() => readFlags(examId));
    const [saveStatus, setSaveStatus] = useState<SaverStatus>({state: 'idle', pending: 0, savedAt: null});
    const [current, setCurrent] = useState(1);
    const [sheet, setSheet] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [exit, setExit] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    /** Time is up (clock, or the server said so): the paper is read-only, we submit for the student. */
    const [locked, setLocked] = useState(false);
    /** "Lên đầu" only once the student has scrolled away from the top (it covers answer buttons otherwise). */
    const [showTop, setShowTop] = useState(false);

    const submittingRef = useRef(false);
    const doneRef = useRef(false);
    const lockedRef = useRef(false);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const submitRef = useRef<(auto: boolean) => void>(() => {});

    const saverRef = useRef<AnswerSaver | null>(null);
    if (!saverRef.current) {
        saverRef.current = new AnswerSaver({
            send: saveAnswer,
            onStatus: setSaveStatus,
            onExpired: () => submitRef.current(true),
            onClosed: () => submitRef.current(true),
            storageKey: pendingKey(examId),
            deadlineMs,
        });
    }
    const saver = saverRef.current;

    useEffect(() => {
        Object.entries(mirror).forEach(([id, answer]) => saver.queue(id, answer));
        return () => {
            saver.stop();
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, [saver, mirror]);

    const secondsLeft = useCountdown(deadlineMs);

    const submit = useCallback(async (auto: boolean) => {
        if (doneRef.current || submittingRef.current) return;   // no double submit
        if (auto && !lockedRef.current) { lockedRef.current = true; setLocked(true); }
        submittingRef.current = true;
        setSubmitting(true);
        setSubmitError(null);

        const saved = await saver.flush(auto ? 5000 : 8000);
        if (!saved && !auto) {
            submittingRef.current = false;
            setSubmitting(false);
            setSubmitError(`Còn ${saver.pendingCount} câu chưa lưu được lên máy chủ. Kiểm tra mạng rồi bấm Nộp lại.`);
            return;
        }

        let result: SubmitResponse;
        try {
            result = await submitExam(examId);
        } catch (e) {
            submittingRef.current = false;
            setSubmitting(false);
            setSubmitError(submitErrorMessage(e));
            // Time is up: keep trying on our own, the student cannot do anything else anyway.
            if (auto) retryTimer.current = setTimeout(() => submitRef.current(true), 5000);
            return;
        }

        doneRef.current = true;
        saver.stop();
        clearMirror(pendingKey(examId));
        writeFlags(examId, null);
        queryClient.invalidateQueries({queryKey: ['payment', 'wallet']});
        queryClient.invalidateQueries({queryKey: ['exam']});
        queryClient.invalidateQueries({queryKey: ['submission']});
        navigate(result && result.id ? '/result/' + result.id : '/history', {
            replace: true, state: {submission: result, justSubmitted: true, auto},
        });
    }, [examId, navigate, queryClient, saver]);
    submitRef.current = submit;

    // Clock reached zero → lock and submit (no confirm: "are you sure?" after time is up is pointless).
    useEffect(() => {
        if (secondsLeft === 0 && !lockedRef.current) submit(true);
    }, [secondsLeft, submit]);

    // Leaving with answers not yet on the server: let the browser ask.
    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (doneRef.current || saver.pendingCount === 0) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saver]);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 600);
        window.addEventListener('scroll', onScroll, {passive: true});
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Which question is in view (strip + grid highlight).
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(entries => {
            const top = entries.filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (top) setCurrent(Number(top.target.id.replace('cau-', '')));
        }, {rootMargin: '-200px 0px -55% 0px'});
        document.querySelectorAll('[id^="cau-"]').forEach(el => io.observe(el));
        return () => io.disconnect();
    }, [paper]);

    const apply = useCallback((writes: RawAnswers, delay: number) => {
        if (lockedRef.current || submittingRef.current || doneRef.current) return;
        setAnswers(a => ({...a, ...writes}));
        Object.entries(writes).forEach(([id, value]) => saver.queue(id, value, delay));
    }, [saver]);

    const toggleFlag = useCallback((n: number) => setFlags(f => {
        const next = new Set(f);
        if (next.has(n)) next.delete(n); else next.add(n);
        writeFlags(examId, next);
        return next;
    }), [examId]);

    const jump = useCallback((n: number) => {
        setSheet(false);
        setConfirm(false);
        setCurrent(n);
        document.getElementById('cau-' + n)?.scrollIntoView?.({behavior: 'smooth', block: 'start'});
    }, []);

    const status: QuestionStatus[] = paper.questions.map(q => ({
        number: q.number, answered: isAnswered(q, answers), flagged: flags.has(q.number),
    }));
    const answered = status.filter(q => q.answered).length;
    const total = status.length;
    const unanswered = status.filter(q => !q.answered).map(q => q.number);
    const flagged = status.filter(q => q.flagged).length;
    const gridParts: QuestionGridPart[] = paper.parts.map(p => ({
        title: p.title, questions: status.filter(s => p.questions.some(q => q.number === s.number)),
    }));

    const offline = saveStatus.state === 'offline';
    const saving = saveStatus.state === 'saving';
    const savedAt = hhmm(saveStatus.savedAt);
    const openConfirm = () => { setSubmitError(null); setConfirm(true); };
    const warn = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= WARN_SECONDS;
    const disabled = locked || submitting;

    return <ExamLayout
        header={<ExamHeader title={withSubject(exam.subject?.name, exam.name) || 'Đề thi'} secondsLeft={secondsLeft} answered={answered} total={total}
                            onExit={() => setExit(true)} onSubmit={openConfirm} submitting={submitting && !locked}
                            strip={<>
                                {warn && <ExamBanner>Còn dưới 5 phút — bài sẽ tự nộp khi hết giờ</ExamBanner>}
                                {offline && <ExamBanner tone='warn'>
                                    Mất kết nối — đáp án được giữ trên máy và sẽ tự lưu khi có mạng.</ExamBanner>}
                                <QuestionNumberStrip questions={status} current={current} onJump={jump}
                                                     onOpenAll={() => setSheet(true)}/>
                            </>}/>}
        aside={<Card>
            <QuestionGrid showHeading parts={gridParts} current={current} onJump={jump}
                          footer={<>
                              <AutosaveNote savedAt={savedAt} saving={saving} offline={offline}
                                            error={saveStatus.state === 'error'}/>
                              <Button variant='primary' block onClick={openConfirm} disabled={locked}>Nộp bài</Button>
                          </>}/>
        </Card>}>

        {total === 0 && <p className='vt-q-note'>Đề này chưa có câu hỏi.</p>}

        {paper.parts.map(part => <ExamSection key={part.id} id={part.id} title={part.title} note={part.note}>
            {part.questions.map(q => <Fragment key={q.questionIds[0]}>
                {/* Shared reading text: printed once, before the first question of its group.
                    Đúng/Sai already shows its stem as the question text. */}
                {q.kind !== 'truefalse' && <Passage question={q.raw as unknown as LegacyQuestion}
                                                    prev={q.rawPrev as unknown as LegacyQuestion | undefined}
                                                    questions={part.rawQuestions as unknown as LegacyQuestion[]}/>}
                <QuestionView question={q} answers={answers} flagged={flags.has(q.number)} disabled={disabled}
                              onToggleFlag={toggleFlag} onWrite={apply} textDelayMs={TEXT_DELAY_MS}/>
            </Fragment>)}
        </ExamSection>)}

        <ExamEnd answered={answered} total={total} flagged={flagged} savedAt={savedAt} saving={saving}
                 offline={offline} saveError={saveStatus.state === 'error'} disabled={locked}
                 submitting={submitting && !locked} onSubmit={openConfirm}/>

        {saveStatus.state === 'error' && saveStatus.message &&
            <p role='alert' className='vt-saved vt-saved--error'>{saveStatus.message}</p>}

        {showTop && <Button variant='secondary' className='vt-totop' aria-label='Lên đầu trang'
                            onClick={() => jump(1)}>Lên đầu</Button>}

        <Modal open={sheet} onClose={() => setSheet(false)} title='Đi tới câu' placement='sheet' showClose
               footer={<>
                   <Button variant='secondary' onClick={() => setSheet(false)}>Đóng</Button>
                   <Button variant='primary' onClick={() => { setSheet(false); openConfirm(); }}>Nộp bài</Button>
               </>}>
            <p className='vt-submit-hint'>{answered} / {total} đã làm{flagged > 0 && ` · ${flagged} đánh dấu`} · bấm
                số câu để cuộn tới câu đó trong đề</p>
            <QuestionGrid parts={gridParts} current={current} onJump={jump}/>
        </Modal>

        <SubmitDialog open={confirm && !locked} answered={answered} total={total} unanswered={unanswered}
                      flagged={flagged} submitting={submitting} error={submitError} onJump={jump}
                      onCancel={() => setConfirm(false)} onConfirm={() => submit(false)}/>

        <ConfirmDialog open={exit} title='Rời phòng thi?' cancelLabel='Làm tiếp' confirmLabel='Rời đi'
                       message={saveStatus.pending > 0
                           ? `Còn ${saveStatus.pending} câu chưa lưu được lên máy chủ. Đồng hồ vẫn chạy khi bạn rời đi.`
                           : 'Đáp án đã được lưu. Đồng hồ vẫn chạy khi bạn rời đi — bạn có thể vào lại để làm tiếp trước khi hết giờ.'}
                       onCancel={() => setExit(false)} onConfirm={() => navigate('/')}/>

        {/* Time up: not dismissable — the only way out is the result page. */}
        <Modal open={locked} title='Hết giờ làm bài'
               footer={submitError && !submitting
                   ? <Button variant='primary' onClick={() => submit(true)}>Nộp lại</Button>
                   : undefined}>
            {submitError && !submitting
                ? <p role='alert'>{submitError} Hệ thống sẽ tự thử lại.</p>
                : <p role='status'>Bài của bạn đang được nộp tự động…</p>}
        </Modal>
    </ExamLayout>;
}
