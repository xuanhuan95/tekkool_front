import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {ExamSummary, Folder} from '../types/exam';
import type {Board, ExamMeta, MeProfile, SubjectSummary} from '../types/student';

/** 403/404/400 are answers, not flakes — retry only network/5xx once. */
export function retryFlaky(count: number, e: unknown): boolean {
    const code = (e as {code?: unknown} | null)?.code;
    return count < 1 && !(typeof code === 'number' && code >= 400 && code < 500);
}

export function useSubjects() {
    return useQuery({
        queryKey: ['folder', 'subjects'],
        queryFn: () => Api.get<SubjectSummary[]>('folder/subjects'),
        retry: retryFlaky,
    });
}

/**
 * Every exam of a subject: `exam/browse` only lists ONE folder, and a subject's exams may sit in
 * its child folders (exam sets), so: children, then browse the subject + each child (2+N calls,
 * N = sets in one subject — small).
 */
export async function fetchSubjectExams(subjectId: string): Promise<ExamSummary[]> {
    const children = await Api.get<Folder[]>('folder/children?parent=' + encodeURIComponent(subjectId));
    const lists = await Promise.all([subjectId, ...(children || []).map(c => c.id)]
        .map(id => Api.get<ExamSummary[]>('exam/browse?folder=' + encodeURIComponent(id))));
    const seen = new Set<string>();
    return lists.flat().filter(e => !seen.has(e.id) && !!seen.add(e.id));
}

export function useSubjectExams(subjectId: string | undefined) {
    return useQuery({
        queryKey: ['exam', 'browse', 'subject', subjectId],
        queryFn: () => fetchSubjectExams(subjectId!),
        enabled: !!subjectId,
        retry: retryFlaky,
    });
}

export function useExamMeta(examId: string | undefined) {
    return useQuery({
        queryKey: ['exam', 'fetch', examId],
        queryFn: () => Api.get<ExamMeta>('exam/fetch/' + encodeURIComponent(examId!)),
        enabled: !!examId,
        retry: retryFlaky,
    });
}

// One hook for `exam/my_submissions` (home, title badge, history) — defined with the other submission queries.
export {useMySubmissions} from './submissions';

export type BoardKind = 'week' | 'achievements';

export function boardUrl(kind: BoardKind, folder?: string | null, limit?: number): string {
    const q = new URLSearchParams();
    if (folder) q.set('folder', folder);
    if (limit) q.set('limit', String(limit));
    const s = q.toString();
    return 'ranking/' + kind + (s ? '?' + s : '');
}

export function useBoard(kind: BoardKind, folder?: string | null, limit?: number, enabled = true) {
    return useQuery({
        queryKey: ['ranking', kind, folder || '', limit || 0],
        queryFn: () => Api.get<Board>(boardUrl(kind, folder, limit)),
        enabled,
        retry: retryFlaky,
    });
}

export const PROFILE_KEY = ['me', 'profile'] as const;

export function useMeProfile() {
    return useQuery({
        queryKey: PROFILE_KEY,
        queryFn: () => Api.get<MeProfile>('me/profile'),
        retry: retryFlaky,
    });
}

/** POST me/ranking_privacy {hide}. Boards are refetched: your own name shows either way, others' views change. */
export function useRankingPrivacy() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (hide: boolean) => Api.post<{hide_ranking_name: boolean}>('me/ranking_privacy', {hide}),
        onSuccess: r => {
            qc.setQueryData<MeProfile>(PROFILE_KEY, p => p && {...p, hide_ranking_name: r.hide_ranking_name});
            qc.invalidateQueries({queryKey: ['ranking']});
        },
    });
}
