import type {ApiError} from '../../services/api';

/*
 * Autosave queue for the exam page. One instance per open attempt.
 *
 *  - queue(id, answer, delayMs): latest value per raw question wins; text is debounced,
 *    clicks go out almost at once.
 *  - At most ONE request in flight per question, so an older answer can never land after a newer one.
 *  - Network failure / 5xx: keep the answer, status 'offline', retry with backoff (1s → 15s)
 *    and immediately when the browser says it is back online.
 *  - 409 = the server says time is up (save_answer past expires_at + grace) → onExpired.
 *    403 = no open attempt any more (submitted in another tab) → onClosed. Both drop the queue.
 *  - Unsaved answers are mirrored in localStorage, so an F5 while offline does not lose them.
 *
 * ponytail: no IndexedDB/service worker — a few hundred bytes per question in localStorage is
 * plenty, and a closed tab with no network cannot be saved by anything anyway.
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export type SaverStatus = {
    state: SaveState;
    /** Answers not yet confirmed by the server. */
    pending: number;
    /** Time of the last successful save. */
    savedAt: Date | null;
    /** Message of a permanent error (400 too long...). */
    message?: string;
};

export type SaverOptions = {
    send: (questionId: string, answer: string) => Promise<unknown>;
    onStatus: (s: SaverStatus) => void;
    onExpired?: () => void;
    onClosed?: () => void;
    /** localStorage key for the unsaved mirror; omit = no mirror. */
    storageKey?: string;
    /** Wall-clock end of the attempt; stored with the mirror so a stale mirror from an old attempt is ignored. */
    deadlineMs?: number | null;
    now?: () => number;
};

type Entry = {answer: string; timer: ReturnType<typeof setTimeout> | null; due: boolean};

const MAX_BACKOFF_MS = 15_000;

/** A failure worth retrying: no HTTP code (fetch threw) or a server-side 5xx. */
export function isNetworkError(e: unknown): boolean {
    const code = (e as ApiError | null)?.code;
    return typeof code !== 'number' || code === 0 || code >= 500;
}

type Mirror = {deadline: number | null; answers: Record<string, string>};

function readMirror(key: string): Mirror | null {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as Mirror : null;
    } catch {
        return null;
    }
}

/**
 * Unsaved answers left by a previous load of THIS attempt (F5 while offline). A mirror whose
 * deadline has passed belongs to an attempt that is over → ignored and removed.
 */
export function takeMirror(key: string, now = Date.now()): Record<string, string> {
    const m = readMirror(key);
    if (!m || !m.answers) return {};
    if (m.deadline !== null && m.deadline !== undefined && m.deadline < now) {
        clearMirror(key);
        return {};
    }
    return m.answers;
}

export function clearMirror(key: string): void {
    try { window.localStorage.removeItem(key); } catch { /* private mode */ }
}

export class AnswerSaver {
    private entries = new Map<string, Entry>();
    private inFlight = new Set<string>();
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private backoff = 1000;
    private status: SaverStatus = {state: 'idle', pending: 0, savedAt: null};
    private stopped = false;
    private waiters: Array<() => void> = [];
    private readonly onlineListener = () => this.retryNow();

    constructor(private opts: SaverOptions) {
        if (typeof window !== 'undefined') window.addEventListener('online', this.onlineListener);
    }

    get pendingCount(): number {
        return this.entries.size;
    }

    get isStopped(): boolean {
        return this.stopped;
    }

    queue(questionId: string, answer: string, delayMs = 0): void {
        if (this.stopped) return;
        const old = this.entries.get(questionId);
        if (old?.timer) clearTimeout(old.timer);
        const entry: Entry = {answer, timer: null, due: delayMs <= 0};
        if (delayMs > 0) {
            entry.timer = setTimeout(() => { entry.timer = null; entry.due = true; this.pump(); }, delayMs);
        }
        this.entries.set(questionId, entry);
        this.writeMirror();
        if (this.status.state !== 'offline') this.emit({state: 'saving'});
        else this.emit({});
        this.pump();
    }

    /** Send everything now (debounce skipped) and wait until the queue is empty or `timeoutMs` passes. */
    flush(timeoutMs = 8000): Promise<boolean> {
        this.entries.forEach(e => { if (e.timer) clearTimeout(e.timer); e.timer = null; e.due = true; });
        this.retryNow();
        if (!this.entries.size) return Promise.resolve(true);
        return new Promise(resolve => {
            const timer = setTimeout(() => { done(); resolve(this.entries.size === 0); }, timeoutMs);
            const done = () => clearTimeout(timer);
            this.waiters.push(() => { done(); resolve(true); });
        });
    }

    /** Stop for good (submitted, time up, unmount). Pending answers stay in the mirror. */
    stop(): void {
        this.stopped = true;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.entries.forEach(e => { if (e.timer) clearTimeout(e.timer); });
        if (typeof window !== 'undefined') window.removeEventListener('online', this.onlineListener);
    }

    private retryNow(): void {
        if (this.stopped) return;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        this.backoff = 1000;
        this.pump();
    }

    private pump(): void {
        if (this.stopped || this.retryTimer) return;
        this.entries.forEach((entry, id) => {
            if (!entry.due || this.inFlight.has(id)) return;
            this.sendOne(id, entry.answer);
        });
    }

    private async sendOne(id: string, answer: string): Promise<void> {
        this.inFlight.add(id);
        try {
            await this.opts.send(id, answer);
            this.inFlight.delete(id);
            if (this.stopped) return;
            // Only drop the entry if nothing newer was queued while this request was out.
            if (this.entries.get(id)?.answer === answer) this.entries.delete(id);
            this.backoff = 1000;
            this.writeMirror();
            this.emit({state: this.entries.size ? 'saving' : 'saved', savedAt: new Date(this.now())});
            if (!this.entries.size) this.resolveWaiters();
            this.pump();
        } catch (e) {
            this.inFlight.delete(id);
            if (this.stopped) return;
            const code = (e as ApiError | null)?.code;
            if (code === 409) { this.drop(); this.opts.onExpired?.(); return; }
            if (code === 403) { this.drop(); this.opts.onClosed?.(); return; }
            if (isNetworkError(e)) {
                this.emit({state: 'offline'});
                this.scheduleRetry();
                return;
            }
            // 400 (too long) and the like: retrying cannot help. Keep the answer locally, say so.
            if (this.entries.get(id)?.answer === answer) this.entries.delete(id);
            this.emit({state: 'error', message: (e as ApiError)?.error || 'Chưa lưu được câu trả lời.'});
            if (!this.entries.size) this.resolveWaiters();
        }
    }

    private scheduleRetry(): void {
        if (this.retryTimer || this.stopped) return;
        const wait = this.backoff;
        this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
        this.retryTimer = setTimeout(() => { this.retryTimer = null; this.pump(); }, wait);
    }

    private drop(): void {
        this.stop();
        this.entries.clear();
        this.resolveWaiters();
    }

    private resolveWaiters(): void {
        const w = this.waiters;
        this.waiters = [];
        w.forEach(f => f());
    }

    private now(): number {
        return this.opts.now ? this.opts.now() : Date.now();
    }

    private writeMirror(): void {
        const key = this.opts.storageKey;
        if (!key) return;
        if (!this.entries.size) return clearMirror(key);
        const answers: Record<string, string> = {};
        this.entries.forEach((e, id) => { answers[id] = e.answer; });
        try {
            window.localStorage.setItem(key, JSON.stringify({deadline: this.opts.deadlineMs ?? null, answers}));
        } catch { /* quota / private mode: the in-memory queue still works */ }
    }

    private emit(patch: Partial<SaverStatus>): void {
        this.status = {...this.status, ...patch, pending: this.entries.size};
        if (patch.state && patch.state !== 'error') delete this.status.message;
        this.opts.onStatus(this.status);
    }
}
