import type {ReactNode} from 'react';
import {Link, NavLink} from 'react-router-dom';

import WaveLine from '../WaveLine';
import StatPill from '../StatPill';
import {cx} from '../cx';
import type {NavItem} from './nav';

export interface HeaderStickyProps {
    /** mobile: logo 26px + right side, short wave. web: logo 30px + menu + right side, full-width wave. */
    variant: 'mobile' | 'web';
    /** Web menu items (ignored on mobile — mobile uses BottomNav). */
    nav?: NavItem[];
    navLabel?: string;
    /** Stat pills, role badge, avatar... */
    right?: ReactNode;
    logoTo?: string;
    className?: string;
}

/** Sticky header on paper with the hand-drawn wave underneath (DS-Header.dc.html). */
export default function HeaderSticky({variant, nav, navLabel = 'Menu chính', right, logoTo = '/', className}: HeaderStickyProps) {
    const logo = <Link to={logoTo} className='vt-logo' aria-label='viettestpro — Trang chủ'>viettestpro</Link>;

    if (variant === 'mobile') {
        return <header className={cx('vt-header', 'vt-header--mobile', className)}>
            <div className='vt-header-row'>
                {logo}
                {right && <div className='vt-header-right'>{right}</div>}
            </div>
            <WaveLine variant='mobile'/>
        </header>;
    }

    return <header className={cx('vt-header', 'vt-header--web', className)}>
        <div className='vt-header-inner'>
            {logo}
            {nav && nav.length > 0 &&
                <nav aria-label={navLabel} className='vt-topnav'>
                    {nav.map(it => <NavLink key={it.to} to={it.to} end={it.end}>{it.label}</NavLink>)}
                </nav>}
            {right && <div className='vt-header-right'>{right}</div>}
        </div>
        <WaveLine variant='web' className='vt-wave--web'/>
    </header>;
}

export interface StudentStatsProps {
    stars?: number | null;
    turns?: number | null;
    /** Danh hiệu ("Học sinh chăm") — web only. */
    title?: string | null;
    size?: 'md' | 'sm';
    /** Turns pill links here (buy more). */
    turnsTo?: string;
}

/** The student's pills: title (web), stars, turns. Missing values are simply not drawn (still loading). */
export function StudentStats({stars, turns, title, size = 'md', turnsTo = '/packages'}: StudentStatsProps) {
    const sm = size === 'sm';
    return <>
        {!sm && title && <StatPill kind='title'>{title}</StatPill>}
        {stars != null && <StatPill kind='star' size={size} label={stars + ' sao'}>{stars}</StatPill>}
        {turns != null &&
            <StatPill kind='turns' size={size} to={turnsTo} label={`Còn ${turns} lượt — mua thêm`}>
                {sm ? turns : turns + ' lượt'}
            </StatPill>}
    </>;
}
