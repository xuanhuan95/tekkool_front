import type {HTMLAttributes, ReactNode} from 'react';

import {cx} from './cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
    /** lg: big hand-drawn radius, padding 20–22 (default). md: list rows, padding 12–14. */
    size?: 'lg' | 'md';
    /** error: red border (error state card). */
    tone?: 'default' | 'error';
    /** No padding, clips content (tables). */
    flush?: boolean;
    as?: 'div' | 'section' | 'article' | 'li' | 'aside';
    children?: ReactNode;
}

export default function Card({size = 'lg', tone = 'default', flush, as: Tag = 'div', className, ...rest}: CardProps) {
    return <Tag {...rest}
                className={cx('vt-card', size === 'md' && 'vt-card--md', tone === 'error' && 'vt-card--error',
                    flush && 'vt-card--flush', className)}/>;
}

/** Card heading: Patrick Hand 22px. */
export function CardTitle({as: Tag = 'h3', className, ...rest}: HTMLAttributes<HTMLHeadingElement> & {as?: 'h2' | 'h3' | 'h4' | 'span'}) {
    return <Tag {...rest} className={cx('vt-card-title', className)}/>;
}

/** Page heading: Patrick Hand 32px (mobile) / 40px (web). */
export function PageTitle({className, ...rest}: HTMLAttributes<HTMLHeadingElement>) {
    return <h1 {...rest} className={cx('vt-page-title', className)}/>;
}
