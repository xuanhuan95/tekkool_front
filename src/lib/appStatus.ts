/** Maintenance switch + "new version" check (SPT-124). Spec: design/maintenance-plan.md §2, §2b. */

/** Polling period for /maintenance.json and /version.json. */
export const POLL_MS = 60_000;

export type Maintenance = {message: string | null};

async function getJson(url: string, f: typeof fetch): Promise<Record<string, unknown> | null> {
    try {
        const res = await f(url, {cache: 'no-store'});
        if (!res.ok) return null;
        const body = await res.json();
        return body && typeof body === 'object' ? body : null;
    } catch {
        // Network error, 404 page that is HTML (SPA fallback), broken JSON: all mean "nothing to report".
        return null;
    }
}

/**
 * Reads /maintenance.json. File missing / network error / unreadable = not in maintenance (null).
 * File present = on, unless it says `"enabled": false`. `message` is the admin's note (optional).
 */
export async function fetchMaintenance(f: typeof fetch = fetch): Promise<Maintenance | null> {
    const body = await getJson('/maintenance.json', f);
    if (!body || body.enabled === false) return null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    return {message: message || null};
}

/** Build id on the server (/version.json), null when unavailable (dev server, offline). */
export async function fetchServerVersion(f: typeof fetch = fetch): Promise<string | null> {
    const body = await getJson('/version.json', f);
    return body && typeof body.version === 'string' ? body.version : null;
}

/** True only when the server reports a build id different from the one this bundle was built with. */
export const isNewVersion = (server: string | null, current: string = __APP_VERSION__) =>
    server !== null && server !== current;

const RELOAD_KEY = 'vt-preload-reload';

/**
 * After a deploy the old chunks are gone, so a lazy import fails (`vite:preloadError`).
 * Reload the page ONCE per tab session (sessionStorage guards the loop). If storage is blocked we
 * cannot guard, so we do not reload at all.
 */
export function reloadOnceOnPreloadError(win: Window = window): () => void {
    const onError = (e: Event) => {
        try {
            if (win.sessionStorage.getItem(RELOAD_KEY)) return;
            win.sessionStorage.setItem(RELOAD_KEY, '1');
        } catch {
            return;
        }
        e.preventDefault();
        win.location.reload();
    };
    win.addEventListener('vite:preloadError', onError);
    return () => win.removeEventListener('vite:preloadError', onError);
}
