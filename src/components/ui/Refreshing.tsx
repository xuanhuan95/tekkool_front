import {useEffect, useState} from 'react';
import type {HTMLAttributes} from 'react';
import {useIsFetching} from '@tanstack/react-query';

import {LOADING_DELAY_MS} from './Loading';
import {cx} from './cx';

/**
 * Refetch while old data is on screen (filter, tab, page change): one signal for the whole app.
 * Queries marked `meta: {silent: true}` (background polling) do not count. Only after 300ms.
 */
export function useRefreshing() {
    const busy = useIsFetching({
        predicate: q => !q.meta?.silent
            && (q.state.data !== undefined || q.observers.some(o => o.getCurrentResult().isPlaceholderData)),
    }) > 0;
    const [on, setOn] = useState(false);
    useEffect(() => {
        if (!busy) { setOn(false); return; }
        const t = setTimeout(() => setOn(true), LOADING_DELAY_MS);
        return () => clearTimeout(t);
    }, [busy]);
    return on;
}

/** Wrap the data area (not the filters): old content stays, fades to 55% and ignores clicks while refreshing. */
export function Refreshable({children, className, ...rest}: HTMLAttributes<HTMLDivElement>) {
    const busy = useRefreshing();
    return <div className={cx(busy && 'is-refreshing', className)} aria-busy={busy} {...rest}>{children}</div>;
}
