import {create} from 'zustand';

import Api, {setToken} from '../services/api';
import type {Auth, User} from '../types/user';

type AuthState = {
    /** Token phiên. Rỗng khi chưa khởi tạo xong. */
    token: string;
    user: User | null;
    /** false cho tới khi `session/init` trả về — App chờ cờ này mới vẽ. */
    ready: boolean;

    init: () => Promise<void>;
    signIn: (token: string, user: User) => void;
    setUser: (user: User) => void;
    signOut: () => Promise<void>;
};

/**
 * Phiên đăng nhập. Thay cho `globalState.auth` của `stateUtils`.
 *
 * Chỉ có phiên nằm ở đây. Dữ liệu máy chủ (danh sách đề, bài nộp…) đi qua
 * react-query — nhét vào store nữa là có hai nguồn sự thật phải tự đồng bộ.
 */
export const useAuthStore = create<AuthState>((set) => ({
    token: '',
    user: null,
    ready: false,

    /**
     * Xin phiên lúc mở trang. Không có token thì BE cấp phiên `visitor` mới,
     * nên lần nào cũng gọi được — kể cả khi `localStorage` trống.
     */
    init: async () => {
        const saved = window.localStorage.getItem('sessionToken') || '';
        try {
            const auth = await Api.get<Auth>('session/init?token=' + saved);
            setToken(auth.id);
            set({token: auth.id, user: auth.user, ready: true});
        } catch (e) {
            // Mất mạng hoặc BE chết: vẫn phải cho app vẽ, nếu không màn hình
            // treo ở <Loading/> vĩnh viễn và người dùng không biết chuyện gì.
            setToken(null);
            set({token: '', user: null, ready: true});
        }
    },

    /** BE xoay token mỗi lần đăng nhập (chống session fixation). */
    signIn: (token, user) => {
        setToken(token);
        set({token, user});
    },

    /** Đổi hồ sơ / trừ lượt thi — token giữ nguyên. */
    setUser: (user) => set({user}),

    signOut: async () => {
        try {
            await Api.get('session/logout');
        } catch (e) {
            // Phiên có thể đã hết hạn ở BE; vẫn phải xoá phía FE.
        }
        setToken(null);
        // Nạp lại trang thay vì `set({user: null})`: component nào cũng đang
        // giữ dữ liệu của người cũ, dọn từng chỗ dễ sót hơn là bỏ hết.
        window.location.href = '/';
    },
}));
