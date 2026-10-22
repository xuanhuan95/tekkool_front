import {MIN_PASSWORD} from '../auth/authLogic';

export type PasswordForm = {old: string; next: string; confirm: string};
export type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

export function validatePassword(f: PasswordForm): PasswordErrors {
    const e: PasswordErrors = {};
    if (!f.old) e.old = 'Nhập mật khẩu hiện tại.';
    if (f.next.length < MIN_PASSWORD) e.next = 'Mật khẩu mới cần ít nhất ' + MIN_PASSWORD + ' ký tự.';
    else if (f.next === f.old) e.next = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    if (f.confirm !== f.next) e.confirm = 'Mật khẩu nhập lại chưa khớp';
    return e;
}

/**
 * me/change_password answers 400 in unaccented Vietnamese ("Mat khau hien tai khong dung").
 * Map to accented text and to the field it belongs to.
 */
export function passwordApiError(e: unknown): {field?: keyof PasswordForm; message: string} {
    const code = (e as {code?: unknown} | null)?.code;
    const text = String((e as {error?: unknown} | null)?.error || '');
    if (typeof code !== 'number') return {message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'};
    if (/hien tai/i.test(text)) return {field: 'old', message: 'Mật khẩu hiện tại chưa đúng.'};
    if (/phai khac/i.test(text)) return {field: 'next', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.'};
    if (/ky tu/i.test(text)) return {field: 'next', message: 'Mật khẩu mới cần ít nhất ' + MIN_PASSWORD + ' ký tự.'};
    return {message: 'Không đổi được mật khẩu. Thử lại sau.'};
}

export function validateName(name: string): string | undefined {
    const n = name.trim();
    if (!n) return 'Tên không được để trống.';
    if (n.length > 60) return 'Tên tối đa 60 ký tự.';
    return undefined;
}
