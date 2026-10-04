import {useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {ExamSummary, Folder} from '../types/exam';

/** Một key duy nhất cho `exam/list` — Dashboard và ExamFile phải khớp nhau. */
const EXAMS_KEY = ['exam', 'list'] as const;

/** Đề NGOÀI thư mục (BE không nhận `folder` thì trả đúng nhóm này). */
export function useExams(enabled = true) {
    return useQuery({
        queryKey: EXAMS_KEY,
        queryFn: () => Api.get<ExamSummary[]>('exam/list'),
        enabled,
    });
}

/**
 * Xoá / nhân bản / chuyển thư mục xong thì gọi hàm này. Thay cho bản cũ tự
 * `Api.get('exam/list')` rồi nhét vào global state ở ba chỗ khác nhau —
 * sót một chỗ là danh sách lệch với thực tế cho tới khi F5.
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
