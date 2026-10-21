import type {ButtonHTMLAttributes, HTMLAttributes, ReactNode} from 'react';

import {IconCheck} from './icons';
import {cx} from './cx';

export type BadgeTone = 'ok' | 'sun' | 'sun-strong' | 'err' | 'draft' | 'title' | 'popular';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    children: ReactNode;
}

/** Status label: 12px, 600, padding 3px 9px, small hand-drawn radius. Always has text (colour is never the only cue). */
export default function Badge({tone = 'draft', className, ...rest}: BadgeProps) {
    return <span {...rest} className={cx('vt-badge', 'vt-badge--' + tone, className)}/>;
}

/** Statuses used across screens, with the wording from the design. */
export const STATUS_BADGE = {
    graded: {tone: 'ok', label: 'Đã chấm'},
    pending: {tone: 'sun', label: 'Chờ chấm'},
    inProgress: {tone: 'sun-strong', label: 'Đang làm dở'},
    draft: {tone: 'draft', label: 'Nháp'},
    published: {tone: 'ok', label: 'Đã xuất bản'},
    failed: {tone: 'err', label: 'Thất bại'},
    paid: {tone: 'ok', label: 'Thành công'},
    waiting: {tone: 'sun', label: 'Đang xác nhận'},
    correct: {tone: 'ok', label: 'Đúng'},
    wrong: {tone: 'err', label: 'Sai'},
    popular: {tone: 'popular', label: 'Phổ biến'},
} as const satisfies Record<string, {tone: BadgeTone; label: string}>;

export type Status = keyof typeof STATUS_BADGE;

export function StatusBadge({status, children, ...rest}: Omit<BadgeProps, 'tone' | 'children'> & {status: Status; children?: ReactNode}) {
    const s = STATUS_BADGE[status];
    return <Badge tone={s.tone} {...rest}>{children ?? s.label}</Badge>;
}

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    selected: boolean;
    onChange?: (selected: boolean) => void;
}

/** Toggle chip for filters (subject...). Selected = blue + ink border + tick. Hit area grown to 44px. */
export function FilterChip({selected, onChange, onClick, className, children, ...rest}: FilterChipProps) {
    return <button type='button' {...rest} aria-pressed={selected}
                   className={cx('vt-chip', 'vt-hit', className)}
                   onClick={e => { onClick?.(e); onChange?.(!selected); }}>
        {selected && <IconCheck/>}{children}
    </button>;
}
