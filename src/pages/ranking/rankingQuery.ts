import type {Metric, Preset, RankingFormat, SortOrder} from '../../queries/ranking';
import {fmtDate, fmtDuration} from '../my/fmt';

export const MAX_CRITERIA = 4;

export const PERIODS = [
    {value: 'all', label: 'Tất cả'},
    {value: 'week', label: 'Tuần này'},
    {value: 'month', label: 'Tháng này'},
] as const;
export type Period = typeof PERIODS[number]['value'];

export type CriterionChoice = {name: string; order: SortOrder};

/** What the URL carries. `criteria` set -> custom list; else `preset`; else BE default. */
export type RankingQuery = {
    folder: string;
    period: Period;
    preset: string;
    criteria: CriterionChoice[];
};

export function parseRankingQuery(params: URLSearchParams): RankingQuery {
    const criteria: CriterionChoice[] = [];
    for (const part of (params.get('criteria') || '').split(',')) {
        const [name, order] = part.trim().split(':');
        if (!name) continue;
        criteria.push({name, order: order === 'asc' ? 'asc' : 'desc'});
    }
    return {
        folder: params.get('folder') || '',
        period: params.get('period') === 'week' || params.get('period') === 'month' ? params.get('period') as Period : 'all',
        preset: params.get('preset') || '',
        criteria: criteria.slice(0, MAX_CRITERIA),
    };
}

export function serializeRankingQuery(q: RankingQuery): URLSearchParams {
    const out = new URLSearchParams();
    if (q.folder) out.set('folder', q.folder);
    if (q.period !== 'all') out.set('period', q.period);
    if (q.criteria.length) {
        out.set('criteria', q.criteria.map(c => c.name + ':' + c.order).join(','));
    } else if (q.preset) {
        out.set('preset', q.preset);
    }
    return out;
}

/** Criteria the picker should show: the custom list, else the preset's metrics at their default order. */
export function effectiveCriteria(q: RankingQuery, metrics: Metric[], presets: Preset[]): CriterionChoice[] {
    if (q.criteria.length) return q.criteria;
    const preset = presets.find(p => p.name === (q.preset || 'top_score'));
    if (!preset) return [];
    return preset.criteria.map(name => {
        const metric = metrics.find(m => m.name === name);
        return {name, order: metric ? metric.default_order : 'desc'};
    });
}

export function formatMetricValue(value: number | string | null | undefined, format: RankingFormat): string {
    if (value === null || value === undefined || value === '') return '—';
    switch (format) {
        case 'percent': return String(Math.round(Number(value) * 10) / 10).replace('.', ',') + '%';  // Vietnamese decimal comma
        case 'duration': return fmtDuration(Number(value));
        case 'count': return String(value);
        case 'datetime': return fmtDate(String(value));
        default: return String(value);
    }
}
