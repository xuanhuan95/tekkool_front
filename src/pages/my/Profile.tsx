import {useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {Icon} from 'semantic-ui-react';

import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';

/** Thông báo một ô form: hoặc báo xong, hoặc báo lỗi. */
type Msg = {ok?: string; err?: string} | null;

/**
 * Hồ sơ cá nhân: đổi tên hiển thị, đổi mật khẩu.
 *
 * Email không sửa được — nó là khoá đăng nhập, đổi ở đây là mất tài khoản.
 */
export default function Profile() {
    const user = useAuthStore(s => s.user);
    const setUser = useAuthStore(s => s.setUser);

    // Giá trị khởi tạo lấy thẳng từ store: store có dữ liệu ngay lần vẽ đầu
    // (App chờ `ready` mới vẽ), nên không cần useEffect nạp sau như bản cũ.
    const [name, setName] = useState(user?.name || '');
    const [nameMsg, setNameMsg] = useState<Msg>(null);
    const [savingName, setSavingName] = useState(false);

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [pwMsg, setPwMsg] = useState<Msg>(null);
    const [savingPw, setSavingPw] = useState(false);

    const saveName = async (e: FormEvent) => {
        e.preventDefault();
        const value = name.trim();
        if (!value) return setNameMsg({err: 'Tên không được để trống'});

        setSavingName(true);
        setNameMsg(null);
        try {
            const r = await Api.post<{name: string}>('me/update', {name: value});
            // Cập nhật store -> tên trên thanh điều hướng đổi ngay, không
            // phải tải lại trang mới thấy.
            if (user) setUser({...user, name: r.name});
            setNameMsg({ok: 'Đã lưu tên mới.'});
        } catch (err: any) {
            setNameMsg({err: (err && (err.error || err.message)) || 'Lưu thất bại'});
        }
        setSavingName(false);
    };

    const savePw = async (e: FormEvent) => {
        e.preventDefault();

        // Kiểm khớp ở FE cho phản hồi nhanh; BE vẫn kiểm mật khẩu cũ và độ dài
        // — đây chỉ để đỡ một vòng gọi mạng, không phải chốt chặn.
        if (newPassword !== confirm) {
            return setPwMsg({err: 'Hai ô mật khẩu mới không giống nhau'});
        }

        setSavingPw(true);
        setPwMsg(null);
        try {
            await Api.post('me/change_password',
                {old_password: oldPassword, new_password: newPassword});
            setOldPassword('');
            setNewPassword('');
            setConfirm('');
            setPwMsg({ok: 'Đã đổi mật khẩu.'});
        } catch (err: any) {
            setPwMsg({err: (err && (err.error || err.message)) || 'Đổi mật khẩu thất bại'});
        }
        setSavingPw(false);
    };

    const set = (fn: (v: string) => void) =>
        (e: ChangeEvent<HTMLInputElement>) => fn(e.target.value);

    return <div className='tk'><div className='tk-wrap tk-narrow'>
        <h1 className='tk-title'>Thông tin cá nhân</h1>
        <p className='tk-sub'>Cập nhật tên hiển thị và mật khẩu đăng nhập.</p>

        <form className='tk-card' onSubmit={saveName}>
            <h3>Thông tin chung</h3>
            <div className='tk-card-hint'>Tên này hiện trên bài làm gửi cho giáo viên.</div>

            {nameMsg?.ok &&
            <div className='tk-note ok'><Icon name='check circle'/> {nameMsg.ok}</div>}

            <div className='tk-field'>
                <label htmlFor='pf-email'>Email</label>
                <input id='pf-email' type='email' value={user?.email || ''} disabled/>
                <div className='tk-field-hint'>Email là tên đăng nhập, không đổi được.</div>
            </div>

            <div className='tk-field'>
                <label htmlFor='pf-name'>Tên hiển thị</label>
                <input id='pf-name' type='text' value={name} maxLength={80}
                       onChange={set(setName)}/>
                {nameMsg?.err && <div className='tk-field-error'>{nameMsg.err}</div>}
            </div>

            <button type='submit' className='tk-btn' disabled={savingName}>
                {savingName ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
        </form>

        <form className='tk-card' onSubmit={savePw}>
            <h3>Đổi mật khẩu</h3>
            <div className='tk-card-hint'>Cần nhập mật khẩu hiện tại để xác nhận là bạn.</div>

            {pwMsg?.ok &&
            <div className='tk-note ok'><Icon name='check circle'/> {pwMsg.ok}</div>}

            <div className='tk-field'>
                <label htmlFor='pf-old'>Mật khẩu hiện tại</label>
                <input id='pf-old' type='password' autoComplete='current-password'
                       value={oldPassword} onChange={set(setOldPassword)}/>
            </div>

            <div className='tk-field'>
                <label htmlFor='pf-new'>Mật khẩu mới</label>
                <input id='pf-new' type='password' autoComplete='new-password'
                       value={newPassword} onChange={set(setNewPassword)}/>
                <div className='tk-field-hint'>Tối thiểu 6 ký tự.</div>
            </div>

            <div className='tk-field'>
                <label htmlFor='pf-confirm'>Nhập lại mật khẩu mới</label>
                <input id='pf-confirm' type='password' autoComplete='new-password'
                       value={confirm} onChange={set(setConfirm)}/>
                {pwMsg?.err && <div className='tk-field-error'>{pwMsg.err}</div>}
            </div>

            <button type='submit' className='tk-btn'
                    disabled={savingPw || !oldPassword || !newPassword}>
                {savingPw ? 'Đang đổi…' : 'Đổi mật khẩu'}
            </button>
        </form>
    </div></div>;
}
