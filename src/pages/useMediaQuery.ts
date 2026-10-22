import {useCallback, useSyncExternalStore} from 'react';

/** Live `matchMedia`. False where it does not exist (jsdom, SSR) so tests get the phone layout. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback((cb: () => void) => {
        const m = window.matchMedia?.(query);
        m?.addEventListener('change', cb);
        return () => m?.removeEventListener('change', cb);
    }, [query]);
    return useSyncExternalStore(subscribe, () => !!window.matchMedia?.(query).matches, () => false);
}

/** The design's breakpoint: floating sidebar + three-block home from here up. */
export const DESKTOP = '(min-width: 1024px)';
