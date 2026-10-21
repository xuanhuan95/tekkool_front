import {describe, it, expect} from 'vitest';
import {effectiveCriteria, formatMetricValue, parseRankingQuery, serializeRankingQuery} from './rankingQuery';

const metrics = [
    {name: 'best_percent', label: 'Điểm cao nhất', format: 'percent' as const, default_order: 'desc' as const},
    {name: 'fastest_time', label: 'Nhanh nhất', format: 'duration' as const, default_order: 'asc' as const},
];
const presets = [{name: 'top_score', label: 'Điểm cao nhất', criteria: ['best_percent', 'fastest_time']}];

describe('formatMetricValue', () => {
    it('percent rounds to one decimal', () => {
        expect(formatMetricValue(95, 'percent')).toBe('95%');
        expect(formatMetricValue(66.666, 'percent')).toBe('66,7%');
    });
    it('duration uses minutes / hours', () => {
        expect(formatMetricValue(840, 'duration')).toBe('14 phút');
        expect(formatMetricValue(3900, 'duration')).toBe('1h05');
    });
    it('count is plain, datetime parses ISO', () => {
        expect(formatMetricValue(7, 'count')).toBe('7');
        expect(formatMetricValue('2026-01-05T03:00:00', 'datetime')).not.toBe('—');
    });
    it('missing value shows a dash, but 0 count is real', () => {
        expect(formatMetricValue(null, 'percent')).toBe('—');
        expect(formatMetricValue(0, 'count')).toBe('0');
    });
});

describe('query parse / serialize', () => {
    it('round-trips folder and criteria with order', () => {
        const q = parseRankingQuery(new URLSearchParams('folder=abc&criteria=best_percent:desc,fastest_time:asc'));
        expect(q.criteria).toEqual([{name: 'best_percent', order: 'desc'}, {name: 'fastest_time', order: 'asc'}]);
        expect(serializeRankingQuery(q).toString())
            .toBe('folder=abc&criteria=best_percent%3Adesc%2Cfastest_time%3Aasc');
    });
    it('missing order defaults to desc, extra criteria are capped at 4', () => {
        const q = parseRankingQuery(new URLSearchParams('criteria=a,b,c,d,e'));
        expect(q.criteria).toHaveLength(4);
        expect(q.criteria[0].order).toBe('desc');
    });
    it('preset is kept only when no custom criteria', () => {
        expect(serializeRankingQuery({folder: 'f', period: 'all' as const, preset: 'top_score', criteria: []}).toString())
            .toBe('folder=f&preset=top_score');
        expect(serializeRankingQuery({folder: '', period: 'all' as const, preset: '', criteria: []}).toString()).toBe('');
    });
});

describe('effectiveCriteria', () => {
    it('falls back to top_score with metric default orders', () => {
        expect(effectiveCriteria({folder: '', period: 'all' as const, preset: '', criteria: []}, metrics, presets))
            .toEqual([{name: 'best_percent', order: 'desc'}, {name: 'fastest_time', order: 'asc'}]);
    });
});

describe('period', () => {
    it('defaults to all and is omitted from the URL', () => {
        const q = parseRankingQuery(new URLSearchParams('folder=abc'));
        expect(q.period).toBe('all');
        expect(serializeRankingQuery(q).toString()).toBe('folder=abc');
    });
    it('week / month round-trip, unknown value falls back to all', () => {
        expect(serializeRankingQuery(parseRankingQuery(new URLSearchParams('period=week'))).toString()).toBe('period=week');
        expect(parseRankingQuery(new URLSearchParams('period=month')).period).toBe('month');
        expect(parseRankingQuery(new URLSearchParams('period=year')).period).toBe('all');
    });
});
