import type {ReactNode} from 'react';

import Button from './Button';
import Card from './Card';
import {IconDoc, IconWarn} from './icons';
import {cx} from './cx';

export interface EmptyStateProps {
    title: ReactNode;
    description?: ReactNode;
    /** 40px line icon; defaults to a sheet of paper. */
    icon?: ReactNode;
    /** One button (usually primary). */
    action?: ReactNode;
    /** Draw inside a card (default) or bare. */
    bare?: boolean;
    className?: string;
}

/** Empty state: icon + Patrick Hand 22px sentence + 14px muted description + one button. */
export function EmptyState({title, description, icon, action, bare, className}: EmptyStateProps) {
    const body = <div className='vt-empty'>
        {icon ?? <IconDoc/>}
        <span className='vt-empty-title'>{title}</span>
        {description && <span className='vt-empty-desc'>{description}</span>}
        {action}
    </div>;
    return bare ? <div className={className}>{body}</div> : <Card className={cx('vt-card--flush', className)}>{body}</Card>;
}

export interface ErrorStateProps {
    title: ReactNode;
    description?: ReactNode;
    onRetry?: () => void;
    retryLabel?: string;
    /** Retry in flight. */
    retrying?: boolean;
    className?: string;
}

/** Error state: red-bordered card, explanation, "Thử lại". */
export function ErrorState({title, description, onRetry, retryLabel = 'Thử lại', retrying, className}: ErrorStateProps) {
    return <Card tone='error' flush className={className}>
        <div role='alert' className='vt-error'>
            <span className='vt-error-title'><IconWarn/>{title}</span>
            {description && <span className='vt-error-desc'>{description}</span>}
            {onRetry && <Button variant='secondary' onClick={onRetry} loading={retrying}>{retryLabel}</Button>}
        </div>
    </Card>;
}
