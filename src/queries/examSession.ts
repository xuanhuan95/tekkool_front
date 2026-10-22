import Api from '../services/api';
import type {TestExam} from '../types/exam';
import type {Submission} from '../types/submission';

/*
 * Exam-taking calls. NOT react-query hooks on purpose (RULES.md §3): `during_test` may open an
 * attempt and deduct a turn, so it must never be retried or refetched behind the student's back.
 */

/** BE answer to `during_test` right after a submit (F5 within 15 min): the submission, not the paper. */
export type RecentSubmission = Submission & {da_nop: true};

export type DuringTestResponse = TestExam | RecentSubmission;

export const isRecentSubmission = (r: DuringTestResponse): r is RecentSubmission =>
    !!(r as RecentSubmission).da_nop;

/**
 * `?lam_lai=1` = the student deliberately opened the exam from a list (may start a NEW attempt).
 * Without it BE returns the submission they just made instead of charging another turn.
 * Must be `?`: api.ts appends `&token=` itself.
 */
export function fetchDuringTest(examId: string, retake: boolean): Promise<DuringTestResponse> {
    return Api.get<DuringTestResponse>('exam/during_test/' + examId + (retake ? '?lam_lai=1' : ''));
}

/** User comes from the session on BE (SPT-50); `user_id` in the body is ignored there. */
export function saveAnswer(questionId: string, answer: string): Promise<unknown> {
    return Api.post('exam/save_answer/' + questionId, {answer});
}

export type SubmitResponse = Submission & {submitted?: boolean};

/** Idempotent on BE: a second submit of the same attempt returns the first submission. */
export function submitExam(examId: string): Promise<SubmitResponse> {
    return Api.post<SubmitResponse>('exam/submit/' + examId);
}

/** localStorage keys of one exam (unsaved answers mirror, "Xem lại sau" flags). */
export const pendingKey = (examId: string) => 'vt-exam-pending:' + examId;
export const flagsKey = (examId: string) => 'vt-exam-flags:' + examId;
