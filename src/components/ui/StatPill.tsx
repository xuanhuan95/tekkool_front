import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {IconCrown, IconPencil, IconStar, IconTicket} from './icons';
import {cx} from './cx';

export type StatKind = 'title' | 'star' | 'turns' | 'grading';

export interface StatPillProps {
    kind: StatKind;
    /** What is drawn: "20", "7 lượt", "Học sinh chăm", "3 bài chờ chấm". */
    children: ReactNode;
    /** Screen-reader text when the drawn text is just a number ("20 sao"). */
    label?: string;
    /** md: web header, Patrick Hand 19px + ink shadow. sm: mobile header, 14px, no shadow. */
    size?: 'md' | 'sm';
    /** Makes the pill a link (turns → buy more, grading → to-grade list). */
    to?: string;
    className?: string;
}

const ICON: Record<StatKind, (small: boolean) => ReactNode> = {
    title: s => <IconCrown size={s ? 14 : 18}/>,
    star: s => <IconStar size={s ? 14 : 16}/>,
    turns: s => <IconTicket size={s ? 14 : 16}/>,
    grading: s => <IconPencil size={s ? 14 : 18}/>,
};

/** Header stat box: title (purple crown), stars (sun), turns (blue ticket), teacher's "bài chờ chấm" (sun-soft). */
export default function StatPill({kind, children, label, size = 'md', to, className}: StatPillProps) {
    const cls = cx('vt-stat', size === 'sm' && 'vt-stat--sm', kind === 'grading' && 'vt-stat--grading', className);
    const body = <>{ICON[kind](size === 'sm')}<span aria-hidden={label ? true : undefined}>{children}</span>
        {label && <span className='vt-sr-only'>{label}</span>}</>;
    return to
        ? <Link to={to} className={cls}>{body}</Link>
        : <span className={cls}>{body}</span>;
}
