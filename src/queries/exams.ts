import {useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {ExamDetail, ExamSummary, Folder} from '../types/exam';

/** A single key for `exam/list` — Dashboard and ExamFile must match. */
const EXAMS_KEY = ['exam', 'list'] as const;

/** Exams OUTSIDE any folder (when no `folder` is passed, BE returns exactly this group). */
export function useExams(enabled = true) {
    return useQuery({
        queryKey: EXAMS_KEY,
        queryFn: () => Api.get<ExamSummary[]>('exam/list'),
        enabled,
    });
}

/**
 * Call this after delete / duplicate / move-to-folder. Replaces the old way of
 * calling `Api.get('exam/list')` and stuffing it into global state in three
 * different places — miss one and the list drifts from reality until F5.
 */
export function useRefreshExams() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({queryKey: EXAMS_KEY});
}

export function useFolders(enabled = true) {
    return useQuery({
        queryKey: ['folder', 'list'],
        queryFn: () => Api.get<Folder[]>('folder/list'),
        staleTime: 0, // exam counts change on other screens (create / import / editor), so refetch on every visit
        enabled,
    });
}

/** Query of a subject's exams, including those filed in its child folders (exam/list?folder= is not recursive). */
export function subjectExamsQuery(subjectId: string, folders: Folder[]) {
    const ids = [subjectId, ...folders.filter(f => f.parent === subjectId).map(f => f.id)];
    return {
        queryKey: [...EXAMS_KEY, 'subject', ids],
        queryFn: async () => (await Promise.all(ids.map(id => Api.get<ExamSummary[]>('exam/list?folder=' + id)))).flat(),
    };
}

export function useSubjectExams(subjectId: string, folders: Folder[]) {
    const q = useQuery(subjectExamsQuery(subjectId, folders));
    return {data: q.data, isError: q.isError, error: q.error, isFetching: q.isFetching, refetch: q.refetch};
}

/** `/exam/:id`: structure, source, bank capacity and submission counts of one exam (no questions). */
export function useExamDetail(id: string) {
    return useQuery({queryKey: ['exam', 'detail', id], queryFn: () => Api.get<ExamDetail>('exam/detail/' + id)});
}
