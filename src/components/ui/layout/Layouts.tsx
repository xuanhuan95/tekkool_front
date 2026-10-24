import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

import Avatar from '../Avatar';
import Badge from '../Badge';
import Button, {buttonClass} from '../Button';
import StatPill from '../StatPill';
import {EmptyState} from '../States';
import {cx} from '../cx';
import {useAuthStore} from '../../../stores/authStore';
import BottomNav from './BottomNav';
import HeaderSticky, {StudentStats} from './Header';
import {ADMIN_NAV, STUDENT_NAV_MOBILE, STUDENT_NAV_WEB, TEACHER_NAV} from './nav';
import type {NavItem} from './nav';

export interface StudentLayoutProps {
    children: ReactNode;
    name?: string | null;
    stars?: number | null;
    turns?: number | null;
    /** Danh hiệu, shown on web. */
    title?: string | null;
    navMobile?: NavItem[];
    navWeb?: NavItem[];
    accountTo?: string;
}

/**
 * Student shell. Phone (<1024px): sticky header (logo · star · turns · avatar) + bottom nav.
 * Web (≥1024px): sticky header with top menu + title/star/turns pills + avatar; content max 1280px.
 * Both headers are in the DOM and CSS shows one (display:none also hides the other from screen readers),
 * so there is no flash of the wrong layout before JS measures the screen. Page content is rendered once.
 */
export function StudentLayout({children, name, stars, turns, title, navMobile = STUDENT_NAV_MOBILE,
                               navWeb = STUDENT_NAV_WEB, accountTo = '/me'}: StudentLayoutProps) {
    return <div className='vt-paper vt-shell'>
        <HeaderSticky variant='mobile' className='vt-only-mobile'
                      right={<><StudentStats size='sm' stars={stars} turns={turns}/>
                          <Avatar name={name} size={36} to={accountTo}/></>}/>
        <HeaderSticky variant='web' className='vt-only-web' nav={navWeb}
                      right={<><StudentStats stars={stars} turns={turns} title={title}/>
                          <Avatar name={name} to={accountTo}/></>}/>
        {/* ONE <main>: children must mount once (their effects, queries, form state). */}
        <main className='vt-main vt-main--student'>{children}</main>
        <BottomNav items={navMobile} className='vt-only-mobile'/>
    </div>;
}

export interface WebLayoutProps {
    children: ReactNode;
    nav: NavItem[];
    navLabel: string;
    right?: ReactNode;
    className?: string;
}

/** Generic web page (GV / Admin): sticky header with menu, paper background, content max 1280px, padding 32/24. */
export function WebLayout({children, nav, navLabel, right, className}: WebLayoutProps) {
    return <div className={cx('vt-paper vt-shell', className)}>
        <HeaderSticky variant='web' nav={nav} navLabel={navLabel} right={right}/>
        <main className='vt-main vt-main--web'>{children}</main>
    </div>;
}

export interface TeacherLayoutProps {
    children: ReactNode;
    name?: string | null;
    /** Attempts waiting for grading (`exam/pending`); the pill hides at 0 / unknown. */
    pending?: number | null;
    accountTo?: string;
}

/**
 * Teacher shell (spec-giao-vien §1, copied from GV-TongQuan): web header with the 3-item menu (Môn & đề · Ngân hàng · Chấm bài),
 * yellow "N bài chờ chấm", purple "Giáo viên" badge, avatar; under 1024px the menu becomes the bottom nav.
 */
export function TeacherLayout({children, name, pending, accountTo = '/profile'}: TeacherLayoutProps) {
    const signOut = useAuthStore(s => s.signOut);
    const logout = <Button variant='ghost' size='sm' onClick={() => signOut()}>Đăng xuất</Button>;
    const grading = pending ? <StatPill kind='grading' to='/to-grade'>{pending + ' bài chờ chấm'}</StatPill> : null;
    return <div className='vt-paper vt-shell'>
        <HeaderSticky variant='mobile' className='vt-only-mobile'
                      right={<><Badge tone='title'>Giáo viên</Badge><Avatar name={name} size={36} to={accountTo}/>{logout}</>}/>
        <HeaderSticky variant='web' className='vt-only-web' nav={TEACHER_NAV} navLabel='Menu giáo viên'
                      right={<>{grading}<Badge tone='title'>Giáo viên</Badge><Avatar name={name} to={accountTo}/>{logout}</>}/>
        <main className='vt-main vt-main--student'>{children}</main>
        <BottomNav items={TEACHER_NAV} className='vt-only-mobile'/>
    </div>;
}

/**
 * GV screens that only work on a computer (import, create from bank): under 1024px show a note
 * instead of squeezing them (spec §1). ponytail: CSS switch, so the screen still mounts on phones.
 */
export function DesktopOnly({children, backTo = '/'}: {children: ReactNode; backTo?: string}) {
    return <>
        <div className='vt-only-mobile'>
            <EmptyState title='Màn này cần màn hình máy tính (từ 1024px)'
                        action={<Link to={backTo} className={buttonClass({variant: 'ghost'})}>Về Môn &amp; đề</Link>}/>
        </div>
        <div className='vt-only-web'>{children}</div>
    </>;
}

export interface AdminLayoutProps {
    children: ReactNode;
    name?: string;
    nav?: NavItem[];
}

/** Admin: Giáo viên · Người dùng · Gói thi · Doanh thu · Giao dịch; "Admin" role badge + name + avatar, no stat pills. */
export function AdminLayout({children, name = 'Quản trị viên', nav = ADMIN_NAV}: AdminLayoutProps) {
    const signOut = useAuthStore(s => s.signOut);
    return <WebLayout nav={nav} navLabel='Menu quản trị'
                      right={<>
                          <Badge tone='title'>Admin</Badge>
                          <span className='vt-header-name'>{name}</span>
                          <Avatar name={name} initials={name === 'Quản trị viên' ? 'QT' : undefined}/>
                          <Button variant='ghost' size='sm' onClick={() => signOut()}>Đăng xuất</Button>
                      </>}>
        {children}
    </WebLayout>;
}

/** Main + side column (design: main flex 999 1 560px, side 1 1 300px max 380px; side drops below on phones). */
export function PageColumns({main, side, className}: {main: ReactNode; side?: ReactNode; className?: string}) {
    return <div className={cx('vt-cols', className)}>
        <div className='vt-cols-main'>{main}</div>
        {side && <div className='vt-cols-side'>{side}</div>}
    </div>;
}
