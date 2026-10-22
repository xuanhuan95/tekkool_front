import type {User, UserGroup} from '../../types/user';

/** `session/login` returns the user itself plus the NEW token (BE rotates it on every login). */
export type LoginResult = User & {token: string};

/**
 * Where each role lands after signing in (PM 22/10): student → home, teacher → the old teacher
 * screens (still at `/`), admin → `/manage` (not `/admin`: nginx blocks it).
 */
export function homeFor(group: UserGroup | string | null | undefined): string {
    if (group === 'admin') return '/manage';
    return '/';
}

function codeOf(e: unknown): number | undefined {
    const c = (e as {code?: unknown} | null)?.code;
    return typeof c === 'number' ? c : undefined;
}

function textOf(e: unknown): string {
    const t = (e as {error?: unknown; message?: unknown} | null);
    const v = t?.error ?? t?.message;
    return typeof v === 'string' ? v : '';
}

export const LOCKED_MESSAGE = 'Tài khoản của bạn đã bị khoá. Liên hệ Admin hoặc bộ phận hỗ trợ để được mở lại.';

/**
 * Login error → one clear Vietnamese sentence.
 *  404: wrong email or password (BE answers in English — never shown raw).
 *  403: account locked by Admin (SPT-26).
 *  400: BE text when it says "khoá"/"locked", otherwise the session token was dead (see loginWithRetry).
 *  no code: network.
 */
export function loginErrorMessage(e: unknown): string {
    const code = codeOf(e);
    const text = textOf(e);
    if (code === 403 || /khoá|khóa|locked/i.test(text)) return LOCKED_MESSAGE;
    if (code === 404) return 'Email hoặc mật khẩu chưa đúng.';
    if (code === 400) return 'Phiên làm việc đã hết hạn. Tải lại trang rồi đăng nhập lại.';
    if (code === undefined) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    return text || 'Không đăng nhập được. Thử lại sau.';
}

export function isLocked(e: unknown): boolean {
    return loginErrorMessage(e) === LOCKED_MESSAGE;
}

/**
 * Login; on 400 (dead anonymous token — e.g. Admin locked the account, which deletes every session,
 * or the session was logged out in another tab) get a fresh session once and retry.
 * Without the retry the student sees "phiên hết hạn" and has to reload by hand.
 */
export async function loginWithRetry(
    login: () => Promise<LoginResult>,
    renewSession: () => Promise<void>,
): Promise<LoginResult> {
    try {
        return await login();
    } catch (e) {
        if (codeOf(e) !== 400 || isLocked(e)) throw e;
        await renewSession();
        return login();
    }
}

/** Register 400 → message. BE: "Email exists already" (English), others already Vietnamese. */
export function registerErrorMessage(e: unknown): string {
    const code = codeOf(e);
    const text = textOf(e);
    if (/exists/i.test(text)) return 'Email này đã có tài khoản. Đăng nhập hoặc dùng email khác.';
    if (code === undefined) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    return text || 'Không tạo được tài khoản. Thử lại sau.';
}

export const MIN_PASSWORD = 6;   // BE: apis/user.py, apis/me.py

export type RegisterForm = {name: string; email: string; password: string; password2: string; agree: boolean};
export type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

/** Client-side checks before calling BE (BE re-checks; this only saves a round trip). */
export function validateRegister(f: RegisterForm): RegisterErrors {
    const err: RegisterErrors = {};
    if (!f.name.trim()) err.name = 'Nhập họ và tên.';
    if (!f.email.trim()) err.email = 'Nhập email.';
    else if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) err.email = 'Email chưa đúng định dạng.';
    if (f.password.length < MIN_PASSWORD) err.password = 'Mật khẩu cần ít nhất ' + MIN_PASSWORD + ' ký tự.';
    if (f.password2 !== f.password) err.password2 = 'Mật khẩu nhập lại chưa khớp';
    if (!f.agree) err.agree = 'Cần đồng ý điều khoản để tạo tài khoản.';
    return err;
}
