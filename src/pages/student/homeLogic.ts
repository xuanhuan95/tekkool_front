/*
 * SPT-135 · pure rules of the student home (no React): greeting, weekly streak strip, score ring level,
 * per-subject stats, which subjects are "đang luyện" vs "thử sức thêm", and the geometry of the dotted chain.
 */
import {formatDecimal, score10} from '../../lib/format';
import type {Streak, SubjectSummary} from '../../types/student';
import type {Submission} from '../../types/submission';
import {subjectKey, sortSubjects} from '../hs/subjects';

const VN_MS = 7 * 3600 * 1000;

/** Vietnam wall clock as a Date whose getUTC* fields are the local fields. */
function vn(now: Date): Date {
    return new Date(now.getTime() + VN_MS);
}

/** "Chào buổi sáng/chiều/tối": 05–11h sáng, 12–17h chiều, the rest tối (Vietnam time). */
export function greetingWord(now: Date = new Date()): 'sáng' | 'chiều' | 'tối' {
    const h = vn(now).getUTCHours();
    return h >= 5 && h < 12 ? 'sáng' : h >= 12 && h < 18 ? 'chiều' : 'tối';
}

export type StreakState = 'done' | 'keep' | 'zero';

/** done = already practised this week · keep = a streak is alive but this week is empty · zero = no streak. */
export function streakState(s: Pick<Streak, 'current' | 'this_week_done'>): StreakState {
    if (s.this_week_done) return 'done';
    return s.current > 0 ? 'keep' : 'zero';
}

export type WeekDay = {label: string; day: number; on: boolean; today: boolean; future: boolean};

const LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** The Mon–Sun strip of the current week (Vietnam time) with the BE's 7 booleans. */
export function weekStrip(thisWeek: boolean[] | undefined, now: Date = new Date()): {days: WeekDay[]; label: string; practised: number} {
    const t = vn(now);
    const todayIdx = (t.getUTCDay() + 6) % 7;   // Mon = 0
    const monday = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - todayIdx));
    const days = LABELS.map((label, i) => {
        const d = new Date(monday.getTime() + i * 86400000);
        return {label, day: d.getUTCDate(), on: !!thisWeek?.[i], today: i === todayIdx, future: i > todayIdx, date: d};
    });
    const first = days[0].date, last = days[6].date;
    const range = first.getUTCMonth() === last.getUTCMonth()
        ? `${first.getUTCDate()}–${last.getUTCDate()}/${last.getUTCMonth() + 1}`
        : `${first.getUTCDate()}/${first.getUTCMonth() + 1}–${last.getUTCDate()}/${last.getUTCMonth() + 1}`;
    return {
        days: days.map(({date: _d, ...rest}) => rest),
        label: 'Tuần ' + range,
        practised: days.filter(d => d.on).length,
    };
}

export type ScoreLevel = 'hi' | 'mid' | 'fair' | 'lo';

/** Ring colour by score on the 10-point scale: ≥8 hi · 6,5–<8 mid · 5–<6,5 fair · <5 lo. */
export function scoreLevel(s: number): ScoreLevel {
    return s >= 8 ? 'hi' : s >= 6.5 ? 'mid' : s >= 5 ? 'fair' : 'lo';
}

export type SubjectStat = {count: number; best: number | null; provisional: number | null};

const isPending = (s: Submission) => s.status === 'GRADING' || s.pending_count > 0;

/** Per subject id: attempts, best FINAL score (/10) and, when nothing is final yet, the best provisional one. */
export function subjectStats(subs: Submission[]): Map<string, SubjectStat> {
    const m = new Map<string, SubjectStat>();
    for (const s of subs) {
        const id = s.subject?.id;
        if (!id) continue;
        const st = m.get(id) ?? {count: 0, best: null, provisional: null};
        st.count += 1;
        const v = score10(s.score, s.max_score);
        if (v != null) {
            if (isPending(s)) st.provisional = Math.max(st.provisional ?? 0, v);
            else st.best = Math.max(st.best ?? 0, v);
        }
        m.set(id, st);
    }
    return m;
}

/**
 * Split the visible subjects. "Đang luyện" = the ones the student chose (`exam_subjects`); an old account
 * that never chose falls back to the subjects it has already attempted. Everything else = "thử sức thêm".
 */
export function splitSubjects(subjects: SubjectSummary[], chosen: string[], stats: Map<string, SubjectStat>) {
    const mine = chosen.length > 0
        ? subjects.filter(s => chosen.includes(s.id))
        : subjects.filter(s => (stats.get(s.id)?.count ?? 0) > 0 || s.done > 0);
    const ids = new Set(mine.map(s => s.id));
    const more = subjects.filter(s => !ids.has(s.id));
    return {
        practising: sortSubjects(mine),
        // open subjects first (they are the live part of the chain), then "Sắp có"
        more: [...sortSubjects(more.filter(s => s.exams > 0)), ...sortSubjects(more.filter(s => s.exams === 0))],
    };
}

/** True when a free-text subject name (in-progress attempt) is this subject. */
export function sameSubject(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    const ka = subjectKey(a), kb = subjectKey(b);
    return ka && kb ? ka === kb : a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type ChainNode = {left: string; top: number};

/**
 * Dotted zig-zag of "Thử sức thêm": node i sits at x = 50 + 100 i of a 100·n wide box, even nodes high
 * (28), odd nodes low (76). `open` joins the first `openCount` nodes (solid ink), `soon` the rest (grey).
 */
export function chainGeometry(n: number, openCount: number) {
    const W = 100 * n;
    const x = (i: number) => 50 + 100 * i;
    const y = (i: number) => (i % 2 === 0 ? 28 : 76);
    const seg = (a: number, b: number) => {
        if (b <= a) return '';
        let d = `M${x(a).toFixed(1)},${y(a).toFixed(1)}`;
        for (let i = a + 1; i <= b; i++) {
            const mid = (x(i - 1) + x(i)) / 2;
            d += ` C${mid.toFixed(1)},${y(i - 1).toFixed(1)} ${mid.toFixed(1)},${y(i).toFixed(1)} ${x(i).toFixed(1)},${y(i).toFixed(1)}`;
        }
        return d;
    };
    const nodes: ChainNode[] = Array.from({length: n}, (_, i) => ({
        left: (x(i) / W * 100).toFixed(2) + '%', top: i % 2 === 0 ? 0 : 48,
    }));
    return {viewBox: `0 0 ${W} 168`, nodes, open: seg(0, openCount - 1), soon: seg(Math.max(openCount - 1, 0), n - 1)};
}

/** "Cách hạng 3: 39 điểm" — points still missing to the 3rd place; null when already on the podium or no data. */
export function gapToThird(third: number | null | undefined, mine: number | null | undefined, myRank: number | null | undefined): string | null {
    if (third == null || mine == null || myRank == null || myRank <= 3) return null;
    const g = Math.max(third - mine, 0);
    return Number.isInteger(g) ? String(g) : formatDecimal(g, 1);
}
