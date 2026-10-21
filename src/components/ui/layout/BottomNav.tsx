import type {CSSProperties} from 'react';
import {NavLink} from 'react-router-dom';

import {cx} from '../cx';
import {STUDENT_NAV_MOBILE} from './nav';
import type {NavItem} from './nav';

export interface BottomNavProps {
    items?: NavItem[];
    label?: string;
    className?: string;
}

/** Phone tab bar: white, ink top border, Patrick Hand 18px, current item blue (aria-current="page" from NavLink). */
export default function BottomNav({items = STUDENT_NAV_MOBILE, label = 'Điều hướng chính', className}: BottomNavProps) {
    return <nav aria-label={label} className={cx('vt-bottomnav', className)}
                style={{'--vt-tabs': items.length} as CSSProperties}>
        {items.map(it => <NavLink key={it.to} to={it.to} end={it.end}>{it.label}</NavLink>)}
    </nav>;
}
