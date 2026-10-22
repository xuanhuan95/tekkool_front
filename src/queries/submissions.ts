import {useQuery} from '@tanstack/react-query';

import Api from '../services/api';
import type {Submission, SubmissionDetail} from '../types/submission';

/** Query keys of submitted attempts. ExamRoom invalidates ['submission'] after a submit. */
export const submissionKeys = {
    all: ['submission'] as const,
    mine: () => [...submissionKeys.all, 'mine'] as const,
    detail: (id: string) => [...submissionKeys.all, 'detail', id] as const,
};

/** `exam/my_submissions` — own attempts, newest first. Short staleTime: essays get graded meanwhile. */
export function useMySubmissions() {
    return useQuery({
        queryKey: submissionKeys.mine(),
        queryFn: () => Api.get<Submission[]>('exam/my_submissions'),
        staleTime: 15_000,
    });
}

/** `exam/submission/<id>` — one attempt with every answer, the correct answers and scores (after submit only). */
export function useSubmission(id: string | undefined) {
    return useQuery({
        queryKey: submissionKeys.detail(id || ''),
        queryFn: () => Api.get<SubmissionDetail>('exam/submission/' + id),
        enabled: !!id,
        staleTime: 15_000,
        // 403/404 are answers, not flakes.
        retry: (count, e) => count < 1 && !((e as {code?: number})?.code && (e as {code: number}).code < 500),
    });
}
