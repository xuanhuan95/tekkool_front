import {describe, it, expect, vi} from 'vitest';

import {homeFor, loginErrorMessage, loginWithRetry, LOCKED_MESSAGE, registerErrorMessage, validateRegister} from './authLogic';
import type {LoginResult} from './authLogic';

const user = {id: 'u', name: 'Minh Anh', email: 'a@b.vn', group: 'student', token: 't'} as LoginResult;

describe('homeFor', () => {
    it('routes by role', () => {
        expect(homeFor('student')).toBe('/');
        expect(homeFor('teacher')).toBe('/');
        expect(homeFor('admin')).toBe('/manage');
        expect(homeFor(undefined)).toBe('/');
    });
});

describe('loginErrorMessage', () => {
    it('404 wrong credentials in Vietnamese, never the raw English', () => {
        expect(loginErrorMessage({code: 404, error: 'User not found or password is not correct'}))
            .toBe('Email hoặc mật khẩu chưa đúng.');
    });
    it('403 and any "khoá" text → locked', () => {
        expect(loginErrorMessage({code: 403, error: 'Tài khoản đã bị khoá. Liên hệ Admin.'})).toBe(LOCKED_MESSAGE);
        expect(loginErrorMessage({code: 400, error: 'Tài khoản đã bị khóa'})).toBe(LOCKED_MESSAGE);
    });
    it('400 plain = dead session; no code = network', () => {
        expect(loginErrorMessage({code: 400, error: 'Invalid token'})).toMatch(/hết hạn/);
        expect(loginErrorMessage(new TypeError('Failed to fetch'))).toMatch(/kết nối/);
    });
});

describe('loginWithRetry', () => {
    it('renews the session once on 400 and retries', async () => {
        const login = vi.fn().mockRejectedValueOnce({code: 400}).mockResolvedValueOnce(user);
        const renew = vi.fn().mockResolvedValue(undefined);
        await expect(loginWithRetry(login, renew)).resolves.toBe(user);
        expect(renew).toHaveBeenCalledTimes(1);
        expect(login).toHaveBeenCalledTimes(2);
    });
    it('does not retry 403/404', async () => {
        const renew = vi.fn();
        await expect(loginWithRetry(() => Promise.reject({code: 403}), renew)).rejects.toEqual({code: 403});
        await expect(loginWithRetry(() => Promise.reject({code: 404}), renew)).rejects.toEqual({code: 404});
        expect(renew).not.toHaveBeenCalled();
    });
});

describe('register', () => {
    it('validates fields', () => {
        const e = validateRegister({name: ' ', email: 'x', password: '123', password2: '12', agree: false});
        expect(Object.keys(e).sort()).toEqual(['agree', 'email', 'name', 'password', 'password2']);
        expect(e.password2).toBe('Mật khẩu nhập lại chưa khớp');
        expect(validateRegister({name: 'A', email: 'a@b.vn', password: '123456', password2: '123456', agree: true})).toEqual({});
    });
    it('maps duplicate email', () => {
        expect(registerErrorMessage({code: 400, error: 'Email exists already'})).toMatch(/đã có tài khoản/);
        expect(registerErrorMessage({code: 400, error: 'Email không hợp lệ'})).toBe('Email không hợp lệ');
    });
});
