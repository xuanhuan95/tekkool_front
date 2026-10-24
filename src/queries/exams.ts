import {useQueries, useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {ExamSummary, Folder} from '../types/exam';

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
        enabled,
    });
}

/** A subject's exams, including those filed in its child folders (exam/list?folder= is not recursive). */
export function useSubjectExams(subjectId: string, folders: Folder[]) {
    const ids = [subjectId, ...folders.filter(f => f.parent === subjectId).map(f => f.id)];
    const results = useQueries({queries: ids.map(id => ({
        queryKey: [...EXAMS_KEY, id],
        queryFn: () => Api.get<ExamSummary[]>('exam/list?folder=' + id),
    }))});
    return {
        data: results.some(r => !r.data) ? undefined : results.flatMap(r => r.data as ExamSummary[]),
        isError: results.some(r => r.isError),
        isFetching: results.some(r => r.isFetching),
        refetch: () => results.forEach(r => r.refetch()),
    };
}

