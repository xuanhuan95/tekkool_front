import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Link, NavLink, useLocation, useNavigate, useSearchParams} from 'react-router-dom';

import {useAuthStore} from '../../stores/authStore';
import {useWallet} from '../../queries/wallet';
import {useMediaQuery, DESKTOP} from '../useMediaQuery';
import {IconClock, IconCrown, IconHome, IconSearch, IconTicket, IconTicketLine, IconTrophy} from './icons';
import './spt.css';

const TABS = [
    {to: '/', label: 'Trang chủ', end: true, icon: IconHome},
    {to: '/my-exams', label: 'Lịch sử', end: false, icon: IconClock},
    {to: '/ranking', label: 'Xếp hạng', end: false, icon: IconTrophy},
    {to: '/packages', label: 'Gói thi', end: false, icon: IconTicketLine},
];

/** "Nguyễn Văn Minh" -> "M": the design's avatar shows the given name's initial. */
export function initial(name?: string | null): string {
    const parts = (name || '').trim().split(/\s+/);
    return (parts[parts.length - 1] || '?').charAt(0).toUpperCase();
}

export function TurnsChip({compact}: {compact?: boolean}) {
    const {data} = useWallet();
    if (!data) return null;
    return <Link to='/packages' className='spt-chip' title='Lượt thi còn lại'>
        <IconTicket size={compact ? 16 : 18}/> {data.remaining}{compact ? '' : ' lượt'}
    </Link>;
}

function MeMenu() {
    const user = useAuthStore(s => s.user);
    const signOut = useAuthStore(s => s.signOut);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const {pathname} = useLocation();
    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return <div className='spt-me' ref={ref}>
        {open && <div className='spt-menu' role='menu'>
            <Link to='/profile' role='menuitem'>Thông tin cá nhân</Link>
            <Link to='/billing' role='menuitem'>Lịch sử thanh toán</Link>
            <button type='button' role='menuitem' className='danger' onClick={signOut}>Đăng xuất</button>
        </div>}
        <button type='button' aria-haspopup='menu' aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className='spt-av'>{initial(user?.name)}</span>
            {/* ponytail: the design's "Lớp 12 · Khối A00" line has no data yet, the email stands in */}
            <span className='spt-me-name'><b>{user?.name}</b><small>{user?.email}</small></span>
        </button>
    </div>;
}

function SearchBox() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const {pathname} = useLocation();
    const q = pathname === '/' || pathname.startsWith('/subject/') ? params.get('q') || '' : '';
    // ponytail: searching filters the home page's subjects and exams via ?q=, no search endpoint.
    return <label className='spt-search'>
        <IconSearch/>
        <input type='search' placeholder='Tìm môn, đề thi...' aria-label='Tìm môn, đề thi' value={q}
               onChange={e => navigate(e.target.value ? '/?q=' + encodeURIComponent(e.target.value) : '/', {replace: pathname === '/'})}/>
    </label>;
}

export default function StudentShell({children}: {children: ReactNode}) {
    const desktop = useMediaQuery(DESKTOP);
    const {pathname} = useLocation();
    // The design's "Gói thi" desktop page has no top bar and no Premium upsell — it IS the upsell.
    const plain = pathname === '/packages';
    // A subject page is still "home" in the design's nav.
    const onCls = (to: string) => ({isActive}: {isActive: boolean}) =>
        isActive || (to === '/' && pathname.startsWith('/subject/')) ? 'on' : '';

    if (!desktop) return <div className='spt spt-mob'>
        <div className='spt-mob-body'>{children}</div>
        <nav className='spt-tabbar' aria-label='Điều hướng chính'>
            {TABS.map(({to, label, end, icon: Icon}) =>
                <NavLink key={to} to={to} end={end} className={onCls(to)}>
                    {({isActive}) => <>
                        <span><Icon size={22} w={isActive ? 2.2 : 2}/></span>
                        <span>{label}</span>
                    </>}
                </NavLink>)}
        </nav>
    </div>;

    return <div className='spt spt-desk'>
        <aside className='spt-side'>
            <Link to='/' className='spt-logo'>
                <img src='/mascot/avatar.svg' alt=''/>
                <span><b>Thi thử SPT</b><small>Luyện · Thi · Đỗ</small></span>
            </Link>
            <nav className='spt-sidenav' aria-label='Điều hướng chính'>
                {TABS.map(({to, label, end, icon: Icon}) =>
                    <NavLink key={to} to={to} end={end} className={onCls(to)}>
                        {({isActive}) => <><Icon w={isActive ? 2 : 1.9}/>{label}</>}
                    </NavLink>)}
            </nav>
            {!plain && <div className='spt-premium'>
                <span className='spt-premium-title'><IconCrown/> SPT Premium</span>
                <p>Mở khóa toàn bộ đề, lời giải chi tiết và phân tích điểm yếu.</p>
                <Link to='/packages'>Nâng cấp</Link>
            </div>}
            <MeMenu/>
        </aside>
        <div className='spt-col'>
            {!plain && <div className='spt-top'>
                <SearchBox/>
                <span style={{flex: 1}}/>
                <TurnsChip/>
            </div>}
            {children}
        </div>
    </div>;
}
