import {useQuery} from '@tanstack/react-query';

import Api from '../services/api';
import type {Submission, SubmissionDetail} from '../types/submission';
import {retryFlaky} from './student';

/** Query keys of submitted attempts. ExamRoom invalidates ['submission'] after a submit. */
export const submissionKeys = {
    all: ['submission'] as const,
    mine: () => [...submissionKeys.all, 'mine'] as const,
    detail: (id: string) => [...submissionKeys.all, 'detail', id] as const,
};

/**
 * `exam/my_submissions` — own attempts, newest first (home, history, title badge share this entry).
 * Short staleTime: essays get graded meanwhile.
 */
export function useMySubmissions(enabled = true) {
    return useQuery({
        queryKey: submissionKeys.mine(),
        queryFn: () => Api.get<Submission[]>('exam/my_submissions'),
        enabled,
        staleTime: 15_000,
        retry: retryFlaky,
    });
}

/**
 * `exam/submission/<id>` — one attempt with every answer, the correct answers, explanations and
 * scores (after submit only). Not cached: `ranking_contribution` moves when another attempt of the
 * same exam this week beats it, and essays get graded — always refetched when the screen opens.
 */
export function useSubmission(id: string | undefined) {
    return useQuery({
        queryKey: submissionKeys.detail(id || ''),
        queryFn: () => Api.get<SubmissionDetail>('exam/submission/' + id),
        enabled: !!id,
        staleTime: 0,
        refetchOnMount: 'always',
        retry: retryFlaky,
    });
}
