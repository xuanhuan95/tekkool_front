import {forwardRef} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {cx} from './cx';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    /** Name of the action: aria-label + native title + the hover/focus tooltip. Icon-only controls MUST have one. */
    label: string;
    icon: ReactNode;
    /** outline = 2px ink border (header sign-out); ghost = border appears on hover (table row actions). */
    variant?: 'outline' | 'ghost';
    /** Renders a router link instead of a button (row "xem chi tiết"). */
    to?: string;
    /** Tooltip hugs the right edge (rightmost control of a row, so it does not leave the screen). */
    tipEnd?: boolean;
    /** Tooltip below instead of above (header). */
    tipBelow?: boolean;
}

/**
 * 44×44 icon-only control with a named tooltip (hover AND keyboard focus) — design DS-Header "đăng xuất",
 * AD-* row actions. Shared so the teacher/student headers can adopt it later.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    {label, icon, variant = 'ghost', to, tipEnd, tipBelow, className, type = 'button', ...rest}, ref) {
    const cls = cx('vt-iconbtn', 'vt-iconbtn--' + variant, 'vt-tip', tipEnd && 'vt-tip--end', tipBelow && 'vt-tip--below', className);
    if (to) return <Link to={to} className={cls} aria-label={label} title={label} data-tip={label}>{icon}</Link>;
    return <button ref={ref} type={type} className={cls} aria-label={label} title={label} data-tip={label} {...rest}>{icon}</button>;
});

export default IconButton;
