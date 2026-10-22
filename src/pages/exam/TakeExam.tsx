import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

import {Button, ErrorState, Modal, SkeletonCard} from '../../components/ui';
import {IconTicket} from '../../components/ui/icons';
import {fetchDuringTest, isRecentSubmission} from '../../queries/examSession';
import type {ApiError} from '../../services/api';
import type {TestExam} from '../../types/exam';
import ExamRoom from './ExamRoom';

type LoadState =
    | {kind: 'loading'}
    | {kind: 'error'; message: string}
    | {kind: 'outOfTurns'}
    | {kind: 'ready'; exam: TestExam; deadlineMs: number | null};

/** remaining_sec from the server wins; only the exam owner (no attempt) falls back to the duration. */
export function deadlineFrom(exam: TestExam, now = Date.now()): number | null {
    if (exam.remaining_sec !== null && exam.remaining_sec !== undefined) return now + Math.max(0, exam.remaining_sec) * 1000;
    return exam.duration && exam.duration > 0 ? now + exam.duration * 60_000 : null;
}

function loadErrorMessage(e: unknown): string {
    const err = e as ApiError | null;
    if (err && typeof err.code === 'number' && err.error) return err.error;
    if (err && typeof err.code === 'number' && err.code >= 500) return 'Máy chủ đang lỗi, thử lại sau ít phút.';
    return (e as Error)?.message && !err?.code
        ? 'Không tải được đề — kiểm tra mạng rồi thử lại.'
        : 'Không tải được đề thi.';
}

/** "Bạn đã hết lượt thi" (HS-HetLuot). Nothing was deducted: BE refuses before opening an attempt. */
function OutOfTurns({examId}: {examId: string}) {
    const navigate = useNavigate();
    return <div className='vt-plain vt-exam'>
        <Modal open title='Bạn đã hết lượt thi' onClose={() => navigate('/exams/' + examId)}
               footer={<>
                   <Button variant='secondary' onClick={() => navigate('/exams/' + examId)}>Để sau</Button>
                   <Button variant='primary' onClick={() => navigate('/packages')}>Xem gói thi</Button>
               </>}>
            <span className='vt-out-icon' aria-hidden='true'><IconTicket size={30}/></span>
            <p>Mua thêm gói để tiếp tục. Lượt không hết hạn.</p>
        </Modal>
    </div>;
}

/**
 * Route `/do-exam/:examId` (kept: home, exam lists and DrawExam link here).
 * Opens the attempt with ONE `during_test` call per visit — it can deduct a turn, so it is never
 * retried automatically; the student presses "Thử lại".
 */
export default function TakeExam() {
    const {examId = ''} = useParams();
    const {search, pathname} = useLocation();
    const navigate = useNavigate();
    const [state, setState] = useState<LoadState>({kind: 'loading'});
    const started = useRef(false);
    // Read once: we strip ?lam_lai=1 from the URL right after loading.
    const retake = useRef(new URLSearchParams(search).get('lam_lai') === '1');

    const load = useCallback(async () => {
        setState({kind: 'loading'});
        try {
            const res = await fetchDuringTest(examId, retake.current);
            if (isRecentSubmission(res)) {
                // F5 right after submitting: BE hands back the submission instead of charging a turn.
                navigate('/result/' + res.id, {replace: true, state: {submission: res}});
                return;
            }
            // The attempt is open now. Drop ?lam_lai=1 so a later F5 resumes it instead of asking
            // for a new attempt (which would cost another turn after a submit).
            if (retake.current) {
                retake.current = false;
                navigate(pathname, {replace: true});
            }
            setState({kind: 'ready', exam: res, deadlineMs: deadlineFrom(res)});
        } catch (e) {
            if ((e as ApiError)?.code === 402) return setState({kind: 'outOfTurns'});
            setState({kind: 'error', message: loadErrorMessage(e)});
        }
    }, [examId, navigate, pathname]);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        load();
    }, [load]);

    if (state.kind === 'ready') return <ExamRoom examId={examId} exam={state.exam} deadlineMs={state.deadlineMs}/>;
    if (state.kind === 'outOfTurns') return <OutOfTurns examId={examId}/>;

    return <div className='vt-plain vt-exam'>
        <div className='vt-exam-body vt-exam-status'>
            {state.kind === 'loading'
                ? <SkeletonCard label='Đang mở đề thi'/>
                : <ErrorState title='Chưa mở được đề thi' description={state.message} onRetry={load}/>}
            {state.kind === 'error' &&
                <Button variant='secondary' onClick={() => navigate('/')}>Về trang chủ</Button>}
        </div>
    </div>;
}
