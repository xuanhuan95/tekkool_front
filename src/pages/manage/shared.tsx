import {useEffect, useState} from 'react';
import {NavLink} from 'react-router-dom';

import {Badge, Button, ConfirmDialog, Modal, notify} from '../../components/ui';
import type {BadgeTone} from '../../components/ui';
import {useLockUser, useResetPassword} from '../../queries/manage';
import type {AccountStatus, AdminUser, Role, TxStatus} from '../../queries/manage';
import {errorText, groupDigits} from '../../lib/format';

/** The 12 SPT subjects (design-system.md §7). */
export const SUBJECTS = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí',
    'Tin học', 'GD KT&PL', 'Công nghệ (CN)', 'Công nghệ (NN)'];

export const ACCOUNT_STATUS: Record<AccountStatus, {tone: BadgeTone; label: string}> = {
    active: {tone: 'ok', label: 'Hoạt động'},
    locked: {tone: 'err', label: 'Đã khoá'},
    never_logged_in: {tone: 'sun', label: 'Chưa đăng nhập'},
};

export function AccountBadge({status}: {status: AccountStatus}) {
    const s = ACCOUNT_STATUS[status] || {tone: 'draft' as BadgeTone, label: status};
    return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const ROLE_LABEL: Record<Role, string> = {student: 'Học sinh', teacher: 'Giáo viên', admin: 'Admin'};

/** Display statuses of an order on the Admin side (AD-GiaoDich). */
export const TX_STATUS: Record<TxStatus, {tone: BadgeTone; label: string}> = {
    paid: {tone: 'ok', label: 'Thành công'},
    pending: {tone: 'sun-strong', label: 'Đang xử lý'},
    mismatch: {tone: 'err', label: 'Lệch tiền'},
    failed: {tone: 'err', label: 'Thất bại'},
    cancelled: {tone: 'draft', label: 'Đã huỷ'},
};

export function TxBadge({status}: {status: TxStatus}) {
    const s = TX_STATUS[status] || {tone: 'draft' as BadgeTone, label: status};
    return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Temp password rule shared with the BE (apis/admin._check_temp_password): ≥ 8, upper, lower, digit. */
export function isValidTempPassword(pw: string): boolean {
    return pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

/**
 * Random temp password from the browser's CSPRNG. Skips look-alike characters (O0Il1) because
 * Admin often reads it out over the phone; always contains upper + lower + digit.
 */
export function generateTempPassword(length = 10): string {
    const pools = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789'];
    const all = pools.join('');
    const rnd = (n: number) => {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] % n;
    };
    const chars = pools.map(p => p[rnd(p.length)]);
    while (chars.length < length) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

/** Copy to clipboard; falls back to a hidden textarea where the async API is missing (http, old browsers). */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* fall through */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch {
        return false;
    }
}

/** Value that only changes after `ms` without new input (search boxes → one request, not one per key). */
export function useDebounced<T>(value: T, ms = 350): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/**
 * Shows a temp password ONCE (BE never returns it again) with a copy button.
 * Closing needs an explicit click — the overlay does not dismiss it by accident.
 */
export function TempPasswordDialog({open, name, email, password, onClose}: {
    open: boolean; name?: string; email?: string; password: string; onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    useEffect(() => { if (!open) setCopied(false); }, [open]);
    const copy = async () => {
        const ok = await copyText(password);
        setCopied(ok);
        if (!ok) notify.error('Không sao chép được', 'Hãy chọn và sao chép thủ công.');
    };
    return <Modal open={open} title='Mật khẩu tạm' footer={<Button variant='primary' onClick={onClose}>Đã lưu, đóng</Button>}>
        <div className='vt-mg-stack'>
            <p>Gửi cho <b>{name}</b>{email ? <> ({email})</> : null}. Mật khẩu <b>chỉ hiện một lần</b> — đóng hộp này là không xem lại được.
                Người dùng phải đổi mật khẩu ở lần đăng nhập tới.</p>
            <div className='vt-mg-pw'>
                <code aria-label='Mật khẩu tạm'>{password}</code>
                <Button variant='secondary' size='sm' onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button>
            </div>
            <span role='status' className='vt-sr-only'>{copied ? 'Đã sao chép mật khẩu' : ''}</span>
        </div>
    </Modal>;
}

/** "Hiển thị 1–7 / 1.284" + Trước / Sau. */
export function Pager({page, limit, total, unit, onPage}: {
    page: number; limit: number; total: number; unit: string; onPage: (p: number) => void;
}) {
    const from = total ? (page - 1) * limit + 1 : 0;
    const to = Math.min(total, page * limit);
    const last = Math.max(1, Math.ceil(total / limit));
    return <div className='vt-mg-pager'>
        <span className='vt-muted vt-num'>Hiển thị {from}–{to} / {groupDigits(total)} {unit}</span>
        <span className='vt-mg-pager-btns'>
            <Button size='sm' disabled={page <= 1} onClick={() => onPage(page - 1)}>← Trước</Button>
            <Button size='sm' disabled={page >= last} onClick={() => onPage(page + 1)}>Sau →</Button>
        </span>
    </div>;
}

/** Second-level nav on Gói thi / Doanh thu (AD-Goi, AD-DoanhThu). */
export function PackagesSubNav() {
    return <nav aria-label='Gói và doanh thu' className='vt-mg-subnav'>
        <NavLink to='/manage/packages'>Quản lý gói</NavLink>
        <NavLink to='/manage/revenue'>Doanh thu</NavLink>
    </nav>;
}

/** Lock / unlock + reset password, with confirmations. Shared by the table and the side panel. */
export function useAccountActions() {
    const lock = useLockUser();
    const reset = useResetPassword();
    const [confirmLock, setConfirmLock] = useState<AdminUser | null>(null);
    const [confirmReset, setConfirmReset] = useState<AdminUser | null>(null);
    const [shown, setShown] = useState<{name: string; email: string; password: string} | null>(null);

    const dialogs = <>
        <ConfirmDialog open={!!confirmLock} tone={confirmLock?.locked ? 'primary' : 'danger'} loading={lock.isPending}
                       title={confirmLock?.locked ? 'Mở khoá tài khoản?' : 'Khoá tài khoản?'}
                       message={confirmLock?.locked
                           ? `${confirmLock?.name} đăng nhập lại được bằng mật khẩu cũ.`
                           : `${confirmLock?.name} bị đăng xuất ngay và không đăng nhập được. Lượt, đơn và bài làm giữ nguyên.`}
                       confirmLabel={confirmLock?.locked ? 'Mở khoá' : 'Khoá'}
                       onCancel={() => setConfirmLock(null)}
                       onConfirm={() => {
                           const u = confirmLock!;
                           lock.mutate({userId: u.id, lock: !u.locked}, {
                               onSuccess: () => { notify.success(u.locked ? 'Đã mở khoá' : 'Đã khoá tài khoản', u.name); setConfirmLock(null); },
                               onError: e => { notify.error('Không thực hiện được', errorText(e, 'Thử lại sau.')); setConfirmLock(null); },
                           });
                       }}/>
        <ConfirmDialog open={!!confirmReset} loading={reset.isPending} title='Đặt lại mật khẩu?'
                       message={`Hệ thống tạo mật khẩu tạm mới cho ${confirmReset?.name}. Mọi phiên đăng nhập của họ bị đăng xuất; lần đăng nhập tới phải đổi mật khẩu.`}
                       confirmLabel='Đặt lại' onCancel={() => setConfirmReset(null)}
                       onConfirm={() => {
                           const u = confirmReset!;
                           reset.mutate(u.id, {
                               onSuccess: r => { setConfirmReset(null); setShown({name: u.name, email: u.email, password: r.temp_password}); },
                               onError: e => { notify.error('Không đặt lại được mật khẩu', errorText(e, 'Thử lại sau.')); setConfirmReset(null); },
                           });
                       }}/>
        <TempPasswordDialog open={!!shown} name={shown?.name} email={shown?.email} password={shown?.password || ''}
                            onClose={() => setShown(null)}/>
    </>;
    return {askLock: setConfirmLock, askReset: setConfirmReset, dialogs};
}
