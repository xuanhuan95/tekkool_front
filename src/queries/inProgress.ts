import {useQuery} from '@tanstack/react-query';

import Api from '../services/api';

/** `GET exam/in_progress` — the attempt whose clock is still running. */
export type InProgress = {
    exam_id: string;
    exam_name: string;
    subject?: string | null;
    remaining_sec: number;
    answered: number;
    total: number;
};

/** "còn 25 phút" — rounds UP so 61s reads 2 minutes, never "0 phút" while time is left. */
export function remainingLabel(sec: number): string {
    if (!(sec > 0)) return 'đã hết giờ';
    if (sec < 60) return 'còn dưới 1 phút';
    return 'còn ' + Math.ceil(sec / 60) + ' phút';
}

/**
 * Not-yet-deployed endpoint, or any error -> `null`, so the card simply hides.
 * ponytail: no polling; refetched on mount/focus, which is when the student comes back home.
 */
export function useInProgress(enabled = true) {
    return useQuery({
        queryKey: ['exam', 'in_progress'],
        queryFn: async (): Promise<InProgress | null> => {
            try {
                const r = await Api.get<{attempt: InProgress | null}>('exam/in_progress');
                return r?.attempt ?? null;
            } catch {
                return null;
            }
        },
        enabled,
        retry: false,
        refetchOnWindowFocus: true,
    });
}
