import type {ReactNode} from 'react';

import {StudentLayout} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useWallet} from '../../queries/wallet';
import {useMeProfile} from '../../queries/student';

/**
 * Student app shell, design D (SPT-55): sticky header + bottom nav on phones, top menu on web.
 * Stars: no API yet → the pill is not drawn. Title: from me/profile (SPT-64, BE rule), hidden when null.
 */
export default function StudentShell({children}: {children: ReactNode}) {
    const name = useAuthStore(s => s.user?.name);
    const wallet = useWallet();
    const profile = useMeProfile();
    const title = profile.data?.title;
    return <StudentLayout name={name} turns={wallet.data?.remaining ?? null} title={title?.name ?? null}>
        {children}
    </StudentLayout>;
}
