import type {ReactNode} from 'react';

import {StudentLayout} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useWallet} from '../../queries/wallet';
import {useMySubmissions} from '../../queries/student';
import {studentTitle} from '../hs/title';

/**
 * Student app shell, design D (SPT-55): sticky header + bottom nav on phones, top menu on web.
 * Stars: no API yet → the pill is not drawn. Title: temporary rule in hs/title.ts, hidden when null.
 */
export default function StudentShell({children}: {children: ReactNode}) {
    const name = useAuthStore(s => s.user?.name);
    const wallet = useWallet();
    const subs = useMySubmissions();
    const title = studentTitle(subs.data);
    return <StudentLayout name={name} turns={wallet.data?.remaining ?? null} title={title?.title ?? null}>
        {children}
    </StudentLayout>;
}
