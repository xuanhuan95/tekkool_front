import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {AnswerSaver, clearMirror, isNetworkError, takeMirror} from './answerSaver';
import type {SaverStatus} from './answerSaver';

const KEY = 'test-pending';
let statuses: SaverStatus[];

beforeEach(() => {
    vi.useFakeTimers();
    statuses = [];
    clearMirror(KEY);
});
afterEach(() => vi.useRealTimers());

const make = (send: (id: string, a: string) => Promise<unknown>, extra = {}) =>
    new AnswerSaver({send, onStatus: s => statuses.push(s), storageKey: KEY, deadlineMs: Date.now() + 60_000, ...extra});

const last = () => statuses[statuses.length - 1];

describe('AnswerSaver', () => {
    it('debounces text: only the last value of a burst is sent', async () => {
        const send = vi.fn().mockResolvedValue({});
        const s = make(send);
        s.queue('Q1', '2', 800);
        s.queue('Q1', '2,', 800);
        s.queue('Q1', '2,5', 800);
        await vi.advanceTimersByTimeAsync(900);
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith('Q1', '2,5');
        expect(last().state).toBe('saved');
        expect(last().savedAt).toBeInstanceOf(Date);
    });

    it('one request in flight per question; a newer answer goes out after, never before', async () => {
        let release!: () => void;
        const send = vi.fn()
            .mockImplementationOnce(() => new Promise(r => { release = () => r({}); }))
            .mockResolvedValue({});
        const s = make(send);
        s.queue('Q1', 'A');
        s.queue('Q1', 'B');
        await vi.advanceTimersByTimeAsync(0);
        expect(send).toHaveBeenCalledTimes(1);
        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(send.mock.calls.map(c => c[1])).toEqual(['A', 'B']);
        expect(s.pendingCount).toBe(0);
    });

    it('network loss: status offline, answer kept, retried with backoff until it succeeds', async () => {
        const send = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce({code: 502})
            .mockResolvedValue({});
        const s = make(send);
        s.queue('Q1', 'A');
        await vi.advanceTimersByTimeAsync(0);
        expect(last().state).toBe('offline');
        expect(s.pendingCount).toBe(1);
        expect(takeMirror(KEY)).toEqual({Q1: 'A'});
        await vi.advanceTimersByTimeAsync(1000);   // 1st retry → 502
        expect(last().state).toBe('offline');
        await vi.advanceTimersByTimeAsync(2000);   // 2nd retry → ok
        expect(send).toHaveBeenCalledTimes(3);
        expect(last().state).toBe('saved');
        expect(takeMirror(KEY)).toEqual({});
    });

    it('the browser "online" event retries at once', async () => {
        const send = vi.fn().mockRejectedValueOnce(new TypeError('x')).mockResolvedValue({});
        const s = make(send);
        s.queue('Q1', 'A');
        await vi.advanceTimersByTimeAsync(0);
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(0);
        expect(send).toHaveBeenCalledTimes(2);
        expect(s.pendingCount).toBe(0);
    });

    it('409 (server: time is up) stops saving and calls onExpired', async () => {
        const onExpired = vi.fn();
        const send = vi.fn().mockRejectedValue({code: 409, error: 'Đã hết giờ'});
        const s = make(send, {onExpired});
        s.queue('Q1', 'A');
        await vi.advanceTimersByTimeAsync(0);
        expect(onExpired).toHaveBeenCalledTimes(1);
        expect(s.isStopped).toBe(true);
        s.queue('Q2', 'B');
        await vi.advanceTimersByTimeAsync(5000);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('403 (no open attempt) calls onClosed', async () => {
        const onClosed = vi.fn();
        const s = make(vi.fn().mockRejectedValue({code: 403}), {onClosed});
        s.queue('Q1', 'A');
        await vi.advanceTimersByTimeAsync(0);
        expect(onClosed).toHaveBeenCalled();
    });

    it('400 is not retried; status error with the server message', async () => {
        const send = vi.fn().mockRejectedValue({code: 400, error: 'Câu trả lời quá dài'});
        const s = make(send);
        s.queue('Q1', 'A');
        await vi.advanceTimersByTimeAsync(10_000);
        expect(send).toHaveBeenCalledTimes(1);
        expect(last()).toMatchObject({state: 'error', message: 'Câu trả lời quá dài'});
    });

    it('flush skips the debounce and resolves true once everything is saved', async () => {
        const send = vi.fn().mockResolvedValue({});
        const s = make(send);
        s.queue('Q1', 'A', 5000);
        const p = s.flush();
        await vi.advanceTimersByTimeAsync(0);
        await expect(p).resolves.toBe(true);
        expect(send).toHaveBeenCalledWith('Q1', 'A');
    });

    it('flush resolves false after the timeout when still offline', async () => {
        const s = make(vi.fn().mockRejectedValue(new TypeError('x')));
        s.queue('Q1', 'A');
        const p = s.flush(3000);
        await vi.advanceTimersByTimeAsync(3000);
        await expect(p).resolves.toBe(false);
        s.stop();
    });
});

describe('localStorage mirror', () => {
    it('a mirror from an attempt whose deadline passed is ignored and removed', () => {
        window.localStorage.setItem(KEY, JSON.stringify({deadline: Date.now() - 1, answers: {Q1: 'A'}}));
        expect(takeMirror(KEY)).toEqual({});
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });

    it('a live mirror is returned', () => {
        window.localStorage.setItem(KEY, JSON.stringify({deadline: Date.now() + 1000, answers: {Q1: 'A'}}));
        expect(takeMirror(KEY)).toEqual({Q1: 'A'});
    });

    it('garbage in storage does not throw', () => {
        window.localStorage.setItem(KEY, '{nope');
        expect(takeMirror(KEY)).toEqual({});
    });
});

it('isNetworkError: fetch failure and 5xx yes, 4xx no', () => {
    expect(isNetworkError(new TypeError('x'))).toBe(true);
    expect(isNetworkError({code: 500})).toBe(true);
    expect(isNetworkError({code: 409})).toBe(false);
});
