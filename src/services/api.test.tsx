import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import Api, {isSessionError, isSessionReplaced} from './api';
import Login from '../pages/auth/Login';
import {SESSION_EXPIRED_KEY, SESSION_EXPIRED_MESSAGE, useAuthStore, watchSessionExpiry} from '../stores/authStore';

const respond = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({status, ok: status < 400, text: async () => JSON.stringify(body), json: async () => body}));

describe('isSessionError', () => {
    it('only matches 400 with a known session message', () => {
        expect(isSessionError({code: 400, error: 'Session does not exist'})).toBe(true);
        expect(isSessionError({code: 400, error: 'Token is not valid'})).toBe(true);
        expect(isSessionError({code: 400, error: 'Token is required'})).toBe(true);
        expect(isSessionError({code: 400, error: 'Email exists already'})).toBe(false);
        expect(isSessionError({code: 403, error: 'Token is not valid'})).toBe(false);
        expect(isSessionError(new TypeError('fetch'))).toBe(false);
    });
});

describe('session expired', () => {
    const hrefSet = vi.fn();
    beforeEach(() => {
        watchSessionExpiry();
        window.localStorage.setItem('sessionToken', 'cu');
        window.token = 'cu';
        window.sessionStorage.clear();
        hrefSet.mockClear();
        vi.stubGlobal('location', Object.defineProperty({}, 'href', {set: hrefSet}));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('logged in: clears token, leaves a notice, goes to /', async () => {
        useAuthStore.setState({user: {id: 'u', name: 'GV', email: 'a@b.c', group: 'teacher'} as any});
        respond(400, {code: 400, error: 'Session does not exist'});

        await expect(Api.get('exam/list')).rejects.toMatchObject({error: 'Session does not exist'});

        expect(window.localStorage.getItem('sessionToken')).toBeNull();
        expect(window.token).toBe('');
        expect(window.sessionStorage.getItem(SESSION_EXPIRED_KEY)).toBe(SESSION_EXPIRED_MESSAGE);
        expect(hrefSet).toHaveBeenCalledWith('/');
    });

    it('not logged in (visitor / login retry): no redirect, token kept', async () => {
        useAuthStore.setState({user: null});
        respond(400, {code: 400, error: 'Token is not valid'});

        await expect(Api.post('session/login', {})).rejects.toBeTruthy();

        expect(hrefSet).not.toHaveBeenCalled();
        expect(window.token).toBe('cu');
    });

    it('upload goes through the same check', async () => {
        useAuthStore.setState({user: {id: 'u', group: 'teacher'} as any});
        respond(400, {code: 400, error: 'Token is not valid'});

        await expect(Api.upload('x', new Blob(['a']))).rejects.toBeTruthy();

        expect(hrefSet).toHaveBeenCalledWith('/');
    });

    it('uploadBlob (PDF) goes through the same check', async () => {
        useAuthStore.setState({user: {id: 'u', group: 'teacher'} as any});
        respond(400, {code: 400, error: 'Session does not exist'});

        await expect(Api.uploadBlob('import_docx/pdf', new Blob(['a']))).rejects.toMatchObject({code: 400});

        expect(hrefSet).toHaveBeenCalledWith('/');
    });

    // QC bug: the store dropped `user` first, App swapped to <Login/> which read AND cleared the flag
    // before the reload, so the reloaded page had no notice.
    it('the notice survives the screen swapping to Login before the reload', async () => {
        function Gate() {
            const user = useAuthStore(s => s.user);
            return user ? <div>app</div> : <Login/>;
        }
        useAuthStore.setState({user: {id: 'u', name: 'GV', email: 'a@b.c', group: 'teacher'} as any});
        render(<MemoryRouter><Gate/></MemoryRouter>);
        respond(400, {code: 400, error: 'Session does not exist'});

        await expect(Api.get('exam/list')).rejects.toBeTruthy();
        await new Promise(r => setTimeout(r, 50));   // let React render whatever it wants

        expect(window.sessionStorage.getItem(SESSION_EXPIRED_KEY)).toBe(SESSION_EXPIRED_MESSAGE);
        expect(hrefSet).toHaveBeenCalledWith('/');
    });

    it('after the reload the Login screen shows the notice once', () => {
        window.sessionStorage.setItem(SESSION_EXPIRED_KEY, SESSION_EXPIRED_MESSAGE);
        useAuthStore.setState({user: null});
        const {unmount} = render(<MemoryRouter><Login/></MemoryRouter>);
        expect(screen.getByRole('alert').textContent).toContain('Phiên đăng nhập đã hết');
        unmount();
        render(<MemoryRouter><Login/></MemoryRouter>);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    // SPT-144: another device logged in with the same account.
    const REPLACED = {code: 401, reason: 'session_replaced', error: 'Tài khoản của bạn vừa đăng nhập ở nơi khác'};

    it('session_replaced: clears token, leaves the BE message, goes to / — once for parallel 401s', async () => {
        useAuthStore.setState({user: {id: 'u', group: 'student'} as any});
        respond(401, REPLACED);

        await Promise.all([Api.get('a'), Api.get('b'), Api.post('c', {})].map(p => expect(p).rejects.toMatchObject({reason: 'session_replaced'})));

        expect(isSessionReplaced(REPLACED)).toBe(true);
        expect(isSessionReplaced({code: 401, error: 'x'})).toBe(false);
        expect(window.token).toBe('');
        expect(window.localStorage.getItem('sessionToken')).toBeNull();
        expect(window.sessionStorage.getItem(SESSION_EXPIRED_KEY)).toBe(REPLACED.error);
        expect(hrefSet).toHaveBeenCalledTimes(1);
        expect(hrefSet).toHaveBeenCalledWith('/');
    });

    it('Login shows the replaced message once', () => {
        window.sessionStorage.setItem(SESSION_EXPIRED_KEY, REPLACED.error);
        useAuthStore.setState({user: null});
        render(<MemoryRouter><Login/></MemoryRouter>);
        expect(screen.getByRole('alert').textContent).toContain('vừa đăng nhập ở nơi khác');
    });
});
