import {useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';

import {Button, Card} from './ui';
import {POLL_MS, fetchMaintenance, fetchServerVersion, isNewVersion} from '../lib/appStatus';
import type {Maintenance} from '../lib/appStatus';
import '../pages/auth/auth.css';
import './AppStatus.css';

const svg = {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true, focusable: false} as const;

/** Screens where a student is mid-attempt: no "new version" bar, maintenance shows the "attempt paused" note. */
const inExam = (pathname: string) => pathname.startsWith('/do-exam/');

/** Màn bảo trì (APP-maintenance-*): có / không lời nhắn; trong phòng thi thêm dòng "lượt đã được trả". */
export function MaintenanceScreen({message, inExam: exam, onRetry}: {message: string | null; inExam: boolean; onRetry: () => Promise<void>}) {
    const [busy, setBusy] = useState(false);
    const retry = async () => { setBusy(true); try { await onRetry(); } finally { setBusy(false); } };
    return <div className='vt-paper vt-auth vt-mt'>
        <main className='vt-auth-col'>
            <div className='vt-auth-brand'>
                <span className='vt-auth-logo'>viettestpro</span>
                <svg width='220' height='8' viewBox='0 0 220 8' aria-hidden='true' focusable='false'>
                    <path d='M1 4 C 22 2, 44 6, 70 4 S 112 2, 140 5 S 182 6, 204 3 S 214 4, 219 4' fill='none'
                          stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
                </svg>
                <span className='vt-auth-tagline'>Thi thử SPT – Đánh giá năng lực ĐH Sư phạm Hà Nội</span>
            </div>
            <Card as='section' className='vt-mt-card' aria-labelledby='vt-mt-title'>
                <span className='vt-mt-icon'>
                    <svg width='30' height='30' strokeWidth='2.2' {...svg}>
                        <path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'/>
                    </svg>
                </span>
                <h1 id='vt-mt-title' className='vt-mt-title'>Hệ thống đang bảo trì</h1>
                <p className='vt-mt-lead'>Chúng mình đang nâng cấp để hệ thống chạy tốt hơn. Bạn quay lại sau ít phút nhé.</p>
                {message && <div className='vt-mt-note vt-mt-note--msg' role='status'>
                    <svg width='18' height='18' strokeWidth='2.4' {...svg}><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/></svg>
                    <span>{message}</span>
                </div>}
                {exam && <div className='vt-mt-note vt-mt-note--ok' role='status'>
                    <svg width='18' height='18' strokeWidth='2.6' {...svg}><circle cx='12' cy='12' r='9'/><path d='M8 12.5l3 3 5-6'/></svg>
                    <span>Lượt làm bài đang dở của bạn đã được trả lại. Sau bảo trì, bạn vào thi lại từ đầu.</span>
                </div>}
                <Button variant='primary' block loading={busy} onClick={retry}>Thử lại</Button>
            </Card>
        </main>
    </div>;
}

/** Dải "Đã có phiên bản mới" (APP-new-version-banner): trên cùng, không tự tải lại. */
export function NewVersionBar() {
    return <div className='vt-nv' role='status'>
        <span className='vt-nv-text'>
            <svg width='18' height='18' strokeWidth='2.4' {...svg}><path d='M20 12a8 8 0 1 1-2.5-5.8'/><path d='M20 4v5h-5'/></svg>
            Đã có phiên bản mới
        </span>
        <Button onClick={() => window.location.reload()}>Tải lại</Button>
    </div>;
}

/**
 * Wraps the whole app. Every 60 s, and when the tab becomes visible again, reads /maintenance.json and
 * /version.json: maintenance on → maintenance screen instead of the app; build id changed → bar on top
 * (never during an exam; it appears after submitting because the result page is not `/do-exam/`).
 */
export default function AppStatus({children}: {children: ReactNode}) {
    const {pathname} = useLocation();
    const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
    const [stale, setStale] = useState(false);

    const check = useCallback(async () => {
        const [m, v] = await Promise.all([fetchMaintenance(), fetchServerVersion()]);
        setMaintenance(m);
        if (isNewVersion(v)) setStale(true);
    }, []);

    useEffect(() => {
        check();
        const timer = setInterval(check, POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
    }, [check]);

    const exam = inExam(pathname);
    if (maintenance) return <MaintenanceScreen message={maintenance.message} inExam={exam} onRetry={check}/>;
    return <>
        {stale && !exam && <NewVersionBar/>}
        {children}
    </>;
}
