import {create} from 'zustand';

import Api, {setSessionErrorHandler, setToken} from '../services/api';
import type {Auth, User} from '../types/user';

type AuthState = {
    /** Session token. Empty until initialization finishes. */
    token: string;
    user: User | null;
    /** false until `session/init` returns — App waits for this flag before rendering. */
    ready: boolean;

    init: () => Promise<void>;
    signIn: (token: string, user: User) => void;
    setUser: (user: User) => void;
    signOut: () => Promise<void>;
};

/**
 * Login session.
 *
 * Only the session lives here. Server data (exam list, submissions…) goes through
 * react-query — putting it in the store too would create two sources of truth to sync by hand.
 */
export const useAuthStore = create<AuthState>((set) => ({
    token: '',
    user: null,
    ready: false,

    /**
     * Request a session when the page opens. With no token BE issues a new `visitor`
     * session, so this can be called every time — even when `localStorage` is empty.
     */
    init: async () => {
        const saved = window.localStorage.getItem('sessionToken') || '';
        try {
            const auth = await Api.get<Auth>('session/init?token=' + saved);
            setToken(auth.id);
            set({token: auth.id, user: auth.user, ready: true});
        } catch (e) {
            // Offline or BE down: the app must still render, otherwise the screen
            // hangs on <Loading/> forever and the user has no idea what is going on.
            setToken(null);
            set({token: '', user: null, ready: true});
        }
    },

    /** BE rotates the token on every login (anti session fixation). */
    signIn: (token, user) => {
        setToken(token);
        set({token, user});
    },

    /** Profile change / turn deducted — token stays the same. */
    setUser: (user) => set({user}),

    signOut: async () => {
        try {
            await Api.get('session/logout');
        } catch (e) {
            // The session may already have expired on BE; FE must still clear its side.
        }
        setToken(null);
        // Reload the page instead of `set({user: null})`: every component is holding
        // the old user's data, and cleaning each one is easier to miss than dropping everything.
        window.location.href = '/';
    },
}));

export const SESSION_EXPIRED_KEY = 'sessionExpired';
export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.';

// BE lost the session (restart, lock, login elsewhere) but FE still holds the token: every call
// fails with 400. Only for a logged-in user — an anonymous visitor's dead token is renewed by
// loginWithRetry. Reload at '/' like signOut: init() then finds no token, so no redirect loop.
export function watchSessionExpiry(): void {
    setSessionErrorHandler(() => {
        if (!useAuthStore.getState().user) return;
        setToken(null);
        useAuthStore.setState({user: null});   // later in-flight calls must not fire this twice
        try { window.sessionStorage.setItem(SESSION_EXPIRED_KEY, '1'); } catch (e) { /* private mode: message is lost, redirect still works */ }
        window.location.href = '/';
    });
}
