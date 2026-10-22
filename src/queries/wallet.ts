import {useQuery} from '@tanstack/react-query';

import Api from '../services/api';
import type {Wallet} from '../types/payment';

/** Remaining exam turns. Shared by the nav chip and the home rail so both show one number. */
export const WALLET_KEY = ['payment', 'wallet'] as const;

export function useWallet(enabled = true) {
    return useQuery({
        queryKey: WALLET_KEY,
        queryFn: () => Api.get<Wallet>('payment/wallet'),
        enabled,
        retry: false,
    });
}
