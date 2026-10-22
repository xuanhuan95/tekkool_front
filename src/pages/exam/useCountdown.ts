import {useEffect, useState} from 'react';

/** Whole seconds left until `deadlineMs`, never negative. */
export function secondsUntil(deadlineMs: number, now = Date.now()): number {
    return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}

/**
 * Countdown to a wall-clock deadline. The deadline is fixed ONCE from the server's
 * `remaining_sec` when the paper loads (Date.now() + remaining), so the device clock being
 * wrong does not matter, and every tick recomputes from Date.now() instead of decrementing —
 * a throttled background tab or a sleeping phone shows the true time when it wakes.
 * null deadline = no time limit → null.
 */
export function useCountdown(deadlineMs: number | null): number | null {
    const [left, setLeft] = useState(() => deadlineMs === null ? null : secondsUntil(deadlineMs));

    useEffect(() => {
        if (deadlineMs === null) { setLeft(null); return; }
        const tick = () => setLeft(secondsUntil(deadlineMs));
        tick();
        const timer = setInterval(tick, 1000);
        document.addEventListener('visibilitychange', tick);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [deadlineMs]);

    return left;
}
