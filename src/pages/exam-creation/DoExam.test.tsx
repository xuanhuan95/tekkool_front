import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import Api from '../../services/api';
import DoExam from './DoExam';

// This is the attempt-DEDUCTING screen. `GET exam/during_test/<id>` costs the
// student one attempt every time a new attempt opens, so everything here is
// measured in money:
//   - calling twice = deducting two attempts for one sitting
//   - getting in with no attempts left = the student lands in an exam room with no exam
//   - clock recomputed from duration = close the tab for 20 minutes and reopen
//     and get a full extra 20 minutes, while the server already fixed the deadline.

const EXAM = {
    id: 'E1',
    name: 'Đề kiểm tra',
    duration: 45,
    remaining_sec: 600,
    sections: [{
        id: 'S1',
        exam: 'E1',
        name: 'Phần I',
        question_type: 'MultipleChoice',
        questions: [{
            id: 'Q1',
            type: 'MultipleChoice',
            exam: 'E1',
            section: 'S1',
            data: {
                question: '<p>1+1=?</p>',
                answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}],
            },
            markedAnswer: null,
        }],
    }],
};

const navigatedTo: string[] = [];
function NavigatedAway() {
    navigatedTo.push(useLocation().pathname);
    return <div>ĐÃ RỜI TRANG</div>;
}

const renderPage = (path = '/do-exam/E1') => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path='/do-exam/:examId' element={<DoExam/>}/>
            <Route path='/packages' element={<NavigatedAway/>}/>
        </Routes>
    </MemoryRouter>
);

beforeEach(() => {
    navigatedTo.length = 0;
    vi.restoreAllMocks();
    vi.spyOn(Api, 'post').mockResolvedValue({});
});

afterEach(() => vi.useRealTimers());

describe('DoExam: opening the exam — every call costs an attempt', () => {
    it('opening the exam calls during_test EXACTLY ONCE', async () => {
        // RULES.md section 3 warns: wrapping during_test in useQuery and forgetting
        // retry:false means every retry costs the student an attempt.
        // DoExam currently calls Api.get directly — this test pins now number.
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText(/1\+1/);

        const calls = get.mock.calls.filter(c => String(c[0]).startsWith('exam/during_test'));
        expect(calls.length).toBe(1);
    });

    it('a network error must NOT call during_test again — a retry costs another attempt', async () => {
        const get = vi.spyOn(Api, 'get').mockRejectedValue({message: 'Network error'});
        renderPage();
        await screen.findByText(/Network error/);

        // Better to show the error and let the student click again than to silently deduct a second attempt.
        const calls = get.mock.calls.filter(c => String(c[0]).startsWith('exam/during_test'));
        expect(calls.length).toBe(1);
    });
});

describe('DoExam: out of attempts and paid exams', () => {
    it('402 out of attempts blocks in place, does NOT redirect elsewhere', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 402});
        renderPage();

        // The student wants to take EXACTLY this exam — redirecting to /packages loses
        // context, and after buying they would not know the way back.
        await waitFor(() => expect(document.body.textContent).not.toMatch(/ĐÃ RỜI TRANG/));
        expect(navigatedTo).toEqual([]);
    });

    it('403 unpurchased exam redirects to the packages page', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 403});
        renderPage();
        await screen.findByText('ĐÃ RỜI TRANG');
        expect(navigatedTo).toContain('/packages');
    });

    it('other errors must be shown, not leave the loader spinning forever', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({message: 'Đề đã bị xoá'});
        renderPage();
        await screen.findByText('Đề đã bị xoá');
    });
});

describe('DoExam: F5 right after submitting', () => {
    it('when the BE returns the submitted work, show the result, do not open a new attempt', async () => {
        // This bug already wrongly deducted 4 attempts from real students in production.
        vi.spyOn(Api, 'get').mockResolvedValue({
            ...EXAM, da_nop: true, score: 8, max_score: 10,
            graded_max_score: 10, pending_count: 0, status: 'GRADED',
        });
        renderPage();

        // Must jump straight to the result screen. Assert on something now ONLY exists
        // when da_nop is handled correctly — "no question visible" is not enough, the exam
        // also fails to show for many other reasons and the test would be green for the wrong reason.
        await screen.findByText('Đã nộp bài');
        expect(screen.queryByText(/1\+1/)).toBeNull();
    });
});

describe('DoExam: entering the exam to CONTINUE after just submitting', () => {
    // The BE's RECENT_SUBMIT_SEC window (15 minutes) exists so F5 does not deduct
    // another attempt. But `/do-exam/<id>` is both the exam room and the result
    // screen, so now same window also blocks someone who DELIBERATELY clicks into
    // the exam to continue: the student clicks the exam, gets pushed to the old
    // result, and can do nothing for 15 minutes.
    // The INTENT must be stated by the FE; the BE guessing by clock is wrong in one direction or the other.

    it('clicking an exam from the list (?lam_lai=1) must send the flag to the BE', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage('/do-exam/E1?lam_lai=1');
        await screen.findByText(/1\+1/);

        const calls = get.mock.calls.map(c => String(c[0]))
            .filter(u => u.startsWith('exam/during_test'));
        expect(calls.length).toBe(1);
        expect(calls[0]).toContain('lam_lai=1');
    });

    it('the flag must be ?lam_lai=1 — api.ts appends &token= itself, using & lands in the path', async () => {
        // `exam/during_test/E1&lam_lai=1` has no ? so api.ts appends `?token=`
        // after it -> lam_lai ends up in the path, the BE can never read it, and
        // the bug returns unchanged while the test stays green if it only checks 'lam_lai'.
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage('/do-exam/E1?lam_lai=1');
        await screen.findByText(/1\+1/);
        expect(String(get.mock.calls[0][0])).toBe('exam/during_test/E1?lam_lai=1');
    });

    it('a normal F5 (no flag) does NOT send lam_lai', async () => {
        // This is the other half: sending the flag unconditionally makes F5 after
        // submitting open a new attempt and deduct it — exactly the bug now wrongly
        // deducted 4 attempts in production.
        const get = vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText(/1\+1/);
        expect(String(get.mock.calls[0][0])).not.toContain('lam_lai');
    });

    it('the result screen has a retake button', async () => {
        // Without this button students must go back to the exam list and click in again.
        vi.spyOn(Api, 'get').mockResolvedValue({
            ...EXAM, da_nop: true, score: 8, max_score: 10,
            graded_max_score: 10, pending_count: 0, status: 'GRADED',
        });
        renderPage();
        await screen.findByText('Đã nộp bài');
        expect(screen.getByText('Làm lại')).toBeTruthy();
    });
});

describe('DoExam: clock fixed on the server', () => {
    it('counts by remaining_sec, does NOT recompute from duration', async () => {
        // remaining_sec=600 (10 minutes left) while duration=45 minutes.
        // Using duration would let a student close the tab for 35 minutes and reopen
        // to a full 45 minutes, while the server fixed the deadline long ago.
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        renderPage();
        await screen.findByText(/1\+1/);
        await screen.findByText('10:00');
        expect(screen.queryByText('45:00')).toBeNull();
    });

    it('remaining_sec = null (exam without a time limit) falls back to duration', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: null});
        renderPage();
        await screen.findByText(/1\+1/);
        await screen.findByText('45:00');
    });

    it('a small remaining_sec still shows correctly, never negative', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: 5});
        renderPage();
        await screen.findByText(/1\+1/);
        await screen.findByText('0:05');
    });
});

// ──────────────────────────────────────────────────────────────────────
// S3.2 time up · S3.4 network lost midway
// ──────────────────────────────────────────────────────────────────────

describe('DoExam: time up (S3.2)', () => {
    it('when time is up, auto-submit, do NOT ask confirm', async () => {
        // finish() has window.confirm. Asking "are you sure" after time is up is
        // pointless: the candidate presses Cancel and keeps working past the deadline.
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: 2});
        const post = vi.spyOn(Api, 'post').mockResolvedValue({score: 5, max_score: 10});
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        renderPage();
        await screen.findByText(/1\+1/);

        // Push the machine clock past the deadline then let the interval run.
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now + 3000);
        await waitFor(() => {
            const submits = post.mock.calls.filter(c => String(c[0]).startsWith('exam/submit'));
            expect(submits.length).toBe(1);
        });
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('a failed auto-submit still locks the exam, does not return to the exam screen', async () => {
        // Network drops exactly when time is up: the candidate must not be allowed to
        // continue indefinitely while the server already fixed the submit deadline.
        vi.spyOn(Api, 'get').mockResolvedValue({...EXAM, remaining_sec: 2});
        vi.spyOn(Api, 'post').mockRejectedValue({message: 'Network error'});
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        renderPage();
        await screen.findByText(/1\+1/);

        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now + 3000);
        await screen.findByText('Đã nộp bài');
    });
});

describe('DoExam: network lost while taking the exam (S3.4)', () => {
    it('a failed answer save must notify the student, not be swallowed silently', async () => {
        // setAnswer does `await Api.post(...)` and only then writes to state. If post
        // throws, state does not change AND there is no notification: the student clicks
        // an answer, sees the button not light up, thinks they missed, clicks again — and
        // the answer is still not saved.
        vi.spyOn(Api, 'get').mockResolvedValue(EXAM);
        vi.spyOn(Api, 'post').mockRejectedValue({message: 'Failed to fetch'});
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        renderPage();
        await screen.findByText(/1\+1/);

        // Semantic Radio: the click must hit the <input> itself; clicking the <label>
        // via Node.click() does not run onChange in jsdom.
        const radio = document.querySelector('input[type=radio][value="2"]')!;
        fireEvent.click(radio);

        await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    });

    it('previously saved answers show again after re-entering the exam', async () => {
        // Re-entering midway: BE returns the exam with markedAnswer. Without reading
        // this field the student's 30 minutes of work shows up blank.
        vi.spyOn(Api, 'get').mockResolvedValue({
            ...EXAM,
            sections: [{
                ...EXAM.sections[0],
                // DoExam compares checked by answer.VALUE, not id (core_grading.py
                // states the FE stores value). Putting 'A1' here would be a wrong
                // test, not wrong code.
                questions: [{...EXAM.sections[0].questions[0], markedAnswer: '2'}],
            }],
        });
        renderPage();
        await screen.findByText(/1\+1/);

        const radio = document.querySelector('input[type=radio][value="2"]') as HTMLInputElement;
        expect(radio.checked).toBe(true);
        // An unselected option must NOT be checked — otherwise the test is green
        // even when every radio is checked.
        const other = document.querySelector('input[type=radio][value="3"]') as HTMLInputElement;
        expect(other.checked).toBe(false);
    });
});

// ──────────────────────────────────────────────────────────────────────
// S5.1/5.2 questions awaiting grading · S5.6 time taken after F5
// ──────────────────────────────────────────────────────────────────────

/** Re-enter a submitted exam (BE returns `da_nop`) — the only path to the result screen. */
const submittedExam = (extra: Record<string, unknown>) => ({
    ...EXAM, da_nop: true, status: 'GRADING', ...extra,
});

describe('DoExam: result screen while questions await grading (S5.1/S5.2)', () => {
    it('the denominator is graded_max_score, NOT the whole exam max_score', async () => {
        // 10 multiple-choice questions (10 pts) + 2 essays (2 pts). The machine has only
        // graded the multiple-choice part: 8/10. Using 12 as the denominator gives "8/12" —
        // the student reads it as 4 wrong, when really only 2 are wrong and the other 2
        // have not been graded by anyone.
        vi.spyOn(Api, 'get').mockResolvedValue(submittedExam({
            score: 8, graded_max_score: 10, max_score: 12, pending_count: 2,
        }));
        renderPage();
        await screen.findByText('Đã nộp bài');

        await screen.findByText('8/10');
        // Assert the inverse: "8/12" must NOT appear anywhere. Without this line the
        // test stays green even if the screen prints both numbers.
        expect(screen.queryByText('8/12')).toBeNull();
    });

    it('when grading is incomplete say "awaiting grading" clearly, do not present a provisional score as final', async () => {
        // "Điểm của bạn: 8" while 2 questions are still ungraded is a lie: the final
        // score could be 10. The student closes the laptop thinking now is the real score.
        vi.spyOn(Api, 'get').mockResolvedValue(submittedExam({
            score: 8, graded_max_score: 10, max_score: 12, pending_count: 2,
        }));
        renderPage();
        await screen.findByText('Đã nộp bài');

        expect(document.body.textContent).toMatch(/chờ giáo viên chấm/);
        expect(screen.queryByText(/Điểm của bạn/)).toBeNull();
    });

    it('only show the final score out of the whole exam once everything is graded', async () => {
        // The flip side of the two tests above: with pending_count = 0 the final score
        // MUST appear. Without this test, deleting the score branch would stay green.
        vi.spyOn(Api, 'get').mockResolvedValue(submittedExam({
            score: 11, graded_max_score: 12, max_score: 12,
            pending_count: 0, status: 'GRADED',
        }));
        renderPage();
        await screen.findByText('Đã nộp bài');

        await screen.findByText('11/12');
        expect(document.body.textContent).not.toMatch(/chờ giáo viên chấm/);
    });
});

describe('DoExam: time taken after F5 (S5.6)', () => {
    it('uses duration_sec of the submitted work, does not show "0 phút"', async () => {
        // F5 on the result screen: state.passedTime goes back to 0 because the component
        // is rebuilt. Reading only passedTime shows the student "0 minutes" after sitting
        // 23 minutes — the wrong number sits right next to the score and costs the whole page its credibility.
        vi.spyOn(Api, 'get').mockResolvedValue(submittedExam({
            score: 9, graded_max_score: 10, max_score: 10,
            pending_count: 0, status: 'GRADED', duration_sec: 23 * 60 + 40,
        }));
        renderPage();
        await screen.findByText('Đã nộp bài');

        // 1420s -> 23 minutes (rounded down), not 0.
        await screen.findByText(/Thời gian làm bài: 23 phút/);
    });

    it('an old submission without duration_sec falls back to passedTime, does not blow up', async () => {
        // Submission made before the BE stored duration_sec. Must degrade smoothly to
        // 0 minutes, never NaN or a blank screen.
        vi.spyOn(Api, 'get').mockResolvedValue(submittedExam({
            score: 9, graded_max_score: 10, max_score: 10, pending_count: 0,
        }));
        renderPage();
        await screen.findByText('Đã nộp bài');

        expect(document.body.textContent).toMatch(/Thời gian làm bài: 0 phút/);
        expect(document.body.textContent).not.toMatch(/NaN/);
    });
});
