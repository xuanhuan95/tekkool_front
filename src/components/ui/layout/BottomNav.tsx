import type {CSSProperties} from 'react';
import {Link, useLocation} from 'react-router-dom';

import {cx} from '../cx';
import {STUDENT_NAV_MOBILE, isNavActive} from './nav';
import type {NavItem} from './nav';

export interface BottomNavProps {
    items?: NavItem[];
    label?: string;
    className?: string;
}

/** Phone tab bar: white, ink top border, Patrick Hand 18px, current item blue (aria-current="page" from NavLink). */
export default function BottomNav({items = STUDENT_NAV_MOBILE, label = 'Điều hướng chính', className}: BottomNavProps) {
    const {pathname} = useLocation();
    return <nav aria-label={label} className={cx('vt-bottomnav', className)}
                style={{'--vt-tabs': items.length} as CSSProperties}>
        {items.map(it => <Link key={it.to} to={it.to}
                aria-current={isNavActive(it, pathname) ? 'page' : undefined}>{it.label}</Link>)}
    </nav>;
}
