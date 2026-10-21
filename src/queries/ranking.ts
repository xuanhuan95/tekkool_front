import {useQuery} from '@tanstack/react-query';

import Api from '../services/api';

export type RankingFormat = 'percent' | 'duration' | 'count' | 'datetime';
export type SortOrder = 'asc' | 'desc';

export type Metric = {name: string; label: string; format: RankingFormat; default_order: SortOrder};
export type Preset = {name: string; label: string; criteria: string[]};
export type RankingFolder = {id: string; name: string; children: {id: string; name: string}[]};

export type RankingOptions = {metrics: Metric[]; presets: Preset[]; folders: RankingFolder[]};

export type Criterion = {name: string; label: string; format: RankingFormat; order: SortOrder};

export type RankingEntry = {
    rank: number;
    name: string;
    is_me: boolean;
    values: Record<string, number | string | null>;
};

export type RankingResponse = {
    criteria: Criterion[];
    total: number;
    entries: RankingEntry[];
    me: RankingEntry | null;
};

/** `queryString` is already serialized (folder + criteria/preset), see rankingQuery.ts. */
export type RankingParams = {queryString: string} | null;

export function useRankingOptions() {
    return useQuery({
        queryKey: ['ranking', 'options'],
        queryFn: () => Api.get<RankingOptions>('ranking/options'),
    });
}

export function useRanking(params: RankingParams) {
    return useQuery({
        queryKey: ['ranking', 'list', params && params.queryString],
        queryFn: () => Api.get<RankingResponse>('ranking/list?' + params!.queryString),
        enabled: !!params,
        retry: false, // 403 is a permanent answer, not a flake
    });
}
