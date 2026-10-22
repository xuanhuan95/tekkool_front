import {useEffect, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {Package, Payment} from '../types/payment';
import {WALLET_KEY} from './wallet';

/** Packages on sale (student view). Same key the old StudentPackages used. */
export const PACKAGES_KEY = ['package', 'list', false] as const;
export const PAYMENT_HISTORY_KEY = ['payment', 'history'] as const;

export function usePackages() {
    return useQuery({queryKey: PACKAGES_KEY, queryFn: () => Api.get<Package[]>('package/list')});
}

export function usePaymentHistory() {
    return useQuery({queryKey: PAYMENT_HISTORY_KEY, queryFn: () => Api.get<Payment[]>('payment/history')});
}

/**
 * The bank reports back via IPN, usually 10–60 seconds after the scan. Poll for 90 seconds
 * before giving up (unchanged from the old PaymentResult screen). BE itself throttles its
 * SePay reconcile to one call per 6 seconds, so a 2-second poll is safe.
 */
export const POLL_TOTAL_SECONDS = 90;
export const POLL_INTERVAL_MS = 2000;

export type PaymentPoll = {
    payment: Payment | null;
    error: unknown;
    /** Seconds waited so far (ticks every second so the screen never looks frozen). */
    seconds: number;
    /** 90 s passed and the order is still PENDING — NOT a failure, the IPN may just be slow. */
    timedOut: boolean;
    /** Start polling again from zero ("Kiểm tra lại"). */
    restart: () => void;
};

/**
 * Polls `payment/status/<inv>` every 2 s until the order leaves PENDING, an error happens, or
 * 90 s pass. When the order turns PAID the wallet and the purchase history are refetched so the
 * header pill and "Bạn có N lượt" show the new balance.
 */
export function usePaymentStatus(inv: string | null): PaymentPoll {
    const qc = useQueryClient();
    const [payment, setPayment] = useState<Payment | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [seconds, setSeconds] = useState(0);
    const [timedOut, setTimedOut] = useState(false);
    const [run, setRun] = useState(0);
    const qcRef = useRef(qc);
    qcRef.current = qc;

    useEffect(() => {
        if (!inv) { setError({error: 'Thiếu mã đơn hàng'}); return; }
        // `cancelled` blocks setState after unmount/restart: an await loop does not stop by itself.
        let cancelled = false;
        const startedAt = Date.now();
        setError(null);
        setTimedOut(false);
        setSeconds(0);

        const clock = setInterval(() => {
            if (!cancelled) setSeconds(Math.round((Date.now() - startedAt) / 1000));
        }, 1000);

        (async () => {
            while (!cancelled && (Date.now() - startedAt) / 1000 < POLL_TOTAL_SECONDS) {
                let res: Payment;
                try {
                    res = await Api.get<Payment>('payment/status/' + encodeURIComponent(inv));
                } catch (e) {
                    if (!cancelled) setError(e);
                    return;
                }
                if (cancelled) return;
                setPayment(res);
                if (res.status !== 'PENDING') {
                    if (res.status === 'PAID') {
                        qcRef.current.invalidateQueries({queryKey: WALLET_KEY});
                        qcRef.current.invalidateQueries({queryKey: PAYMENT_HISTORY_KEY});
                    }
                    return;
                }
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
            }
            if (!cancelled) setTimedOut(true);
        })().finally(() => clearInterval(clock));

        return () => { cancelled = true; clearInterval(clock); };
    }, [inv, run]);

    return {payment, error, seconds, timedOut, restart: () => setRun(n => n + 1)};
}
