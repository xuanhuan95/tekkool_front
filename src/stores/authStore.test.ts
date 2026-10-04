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

    it('gửi token đã lưu và nhận phiên về', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue({id: 'tok-moi', user: STUDENT});
        window.localStorage.setItem('sessionToken', 'tok-cu');

        await useAuthStore.getState().init();

        expect(get).toHaveBeenCalledWith('session/init?token=tok-cu');
        const s = useAuthStore.getState();
        expect(s.token).toBe('tok-moi');
        expect(s.user).toEqual(STUDENT);
        expect(s.ready).toBe(true);
        // Token mới phải được ghi lại, nếu không lần F5 sau gửi token cũ.
        expect(window.localStorage.getItem('sessionToken')).toBe('tok-moi');
        expect(window.token).toBe('tok-moi');
    });

    it('chưa từng đăng nhập: gửi token rỗng, không nổ', async () => {
        const get = vi.spyOn(Api, 'get').mockResolvedValue({id: 'khach', user: null});

        await useAuthStore.getState().init();

        expect(get).toHaveBeenCalledWith('session/init?token=');
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().ready).toBe(true);
    });

    it('BE chết thì vẫn bật ready — không treo ở màn Loading', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 500});
        window.localStorage.setItem('sessionToken', 'tok-chet');

        await useAuthStore.getState().init();

        const s = useAuthStore.getState();
        expect(s.ready).toBe(true);
        expect(s.user).toBeNull();
        // Token chết phải bị xoá, không thì lần sau lại gửi đúng nó.
        expect(window.localStorage.getItem('sessionToken')).toBeNull();
    });
});

describe('authStore.signIn', () => {
    beforeEach(reset);

    it('lưu token mới vào cả store lẫn localStorage', () => {
        useAuthStore.getState().signIn('tok-login', STUDENT);

        expect(useAuthStore.getState().token).toBe('tok-login');
        expect(useAuthStore.getState().user).toEqual(STUDENT);
        expect(window.localStorage.getItem('sessionToken')).toBe('tok-login');
    });
});

describe('authStore.setUser', () => {
    beforeEach(reset);

    it('đổi hồ sơ nhưng GIỮ token — đổi tên không phải đăng nhập lại', () => {
        useAuthStore.getState().signIn('tok-login', STUDENT);
        useAuthStore.getState().setUser({...STUDENT, name: 'An B'});

        expect(useAuthStore.getState().user?.name).toBe('An B');
        expect(useAuthStore.getState().token).toBe('tok-login');
        expect(window.localStorage.getItem('sessionToken')).toBe('tok-login');
    });
});
