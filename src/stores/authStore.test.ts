import {beforeEach, describe, expect, it, vi} from 'vitest';

import Api from '../services/api';
import {useAuthStore} from './authStore';

const reset = () => {
    useAuthStore.setState({token: '', user: null, ready: false});
    window.localStorage.clear();
    window.token = '';
    vi.restoreAllMocks();
};

const STUDENT = {id: 'u1', name: 'An', email: 'an@x.vn', group: 'student' as const};

describe('authStore.init', () => {
    beforeEach(reset);

    it('sends the saved token and receives the session', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue({id: 'tok-moi', user: STUDENT});
        window.localStorage.setItem('sessionToken', 'tok-cu');

        await useAuthStore.getState().init();

        expect(get).toHaveBeenCalledWith('session/init?token=tok-cu');
        const s = useAuthStore.getState();
        expect(s.token).toBe('tok-moi');
        expect(s.user).toEqual(STUDENT);
        expect(s.ready).toBe(true);
        // The new token must be written back, otherwise the next F5 sends the old one.
        expect(window.localStorage.getItem('sessionToken')).toBe('tok-moi');
        expect(window.token).toBe('tok-moi');
    });

    it('never logged in: sends an empty token, does not blow up', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue({id: 'khach', user: null});

        await useAuthStore.getState().init();

        expect(get).toHaveBeenCalledWith('session/init?token=');
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().ready).toBe(true);
    });

    it('BE down still sets ready — does not hang on the Loading screen', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 500});
        window.localStorage.setItem('sessionToken', 'tok-chet');

        await useAuthStore.getState().init();

        const s = useAuthStore.getState();
        expect(s.ready).toBe(true);
        expect(s.user).toBeNull();
        // The dead token must be removed, otherwise next time it is sent again.
        expect(window.localStorage.getItem('sessionToken')).toBeNull();
    });
});

describe('authStore.signIn', () => {
    beforeEach(reset);

    it('saves the new token to both the store and localStorage', () => {
        useAuthStore.getState().signIn('tok-login', STUDENT);

        expect(useAuthStore.getState().token).toBe('tok-login');
        expect(useAuthStore.getState().user).toEqual(STUDENT);
        expect(window.localStorage.getItem('sessionToken')).toBe('tok-login');
    });
});

describe('authStore.setUser', () => {
    beforeEach(reset);

    it('profile change KEEPS the token — renaming does not require logging in again', () => {
        useAuthStore.getState().signIn('tok-login', STUDENT);
        useAuthStore.getState().setUser({...STUDENT, name: 'An B'});

        expect(useAuthStore.getState().user?.name).toBe('An B');
        expect(useAuthStore.getState().token).toBe('tok-login');
        expect(window.localStorage.getItem('sessionToken')).toBe('tok-login');
    });
});
