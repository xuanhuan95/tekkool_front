import {useState} from 'react';
import type {FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';

import Api from '../../services/api';
import {SESSION_EXPIRED_KEY, SESSION_EXPIRED_MESSAGE, useAuthStore} from '../../stores/authStore';
import {Button, PasswordField, TextField} from '../../components/ui';
import {IconAlert} from '../../components/ui/icons';
import {homeFor, loginErrorMessage, loginWithRetry, LOCKED_MESSAGE} from './authLogic';
import type {LoginResult} from './authLogic';
import AuthFrame from './AuthFrame';

/** HS-DangNhap (design D). Email + password only — Google/Facebook login is off (BE returns 410). */
export default function Login() {
    const navigate = useNavigate();
    const signIn = useAuthStore(s => s.signIn);
    const init = useAuthStore(s => s.init);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // One-shot notice left by authStore when the session died (read once, then cleared).
    const [err, setErr] = useState<string | null>(() => {
        try {
            const expired = window.sessionStorage.getItem(SESSION_EXPIRED_KEY);
            window.sessionStorage.removeItem(SESSION_EXPIRED_KEY);
            return expired ? SESSION_EXPIRED_MESSAGE : null;
        } catch (e) { return null; }
    });
    const [busy, setBusy] = useState(false);
    const [forgot, setForgot] = useState(false);

    // A real <form>: Enter submits and password managers recognise the fields.
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (!email.trim() || !password) return setErr('Nhập đủ email và mật khẩu.');

        setBusy(true);
        setErr(null);
        try {
            const user = await loginWithRetry(
                () => Api.post<LoginResult>('session/login', {email: email.trim(), password}),
                init);
            // BE rotated the token and deleted the old session: store the new one first.
            signIn(user.token, user);
            navigate(homeFor(user.group), {replace: true});
        } catch (ex) {
            setErr(loginErrorMessage(ex));
            setBusy(false);
        }
    };

    const locked = err === LOCKED_MESSAGE;

    return <AuthFrame tagline='Thi thử SPT – Đánh giá năng lực ĐH Sư phạm Hà Nội'
                      title='Chào bạn quay lại!' subtitle='Đăng nhập để luyện tiếp đề thi.'
                      footer={<><span className='vt-muted'>Chưa có tài khoản?</span>
                          <Link to='/register' className='vt-link'>Đăng ký</Link></>}>
        <form className='vt-auth-form' onSubmit={submit} noValidate>
            {err && <div role='alert' className={'vt-auth-alert' + (locked ? ' vt-auth-alert--locked' : '')}>
                <IconAlert size={18}/>
                <span>{locked && <b>Tài khoản bị khoá. </b>}{err}</span>
            </div>}
            <TextField label='Email' type='email' name='email' autoComplete='email' placeholder='ban@email.com'
                       value={email} autoFocus
                       onChange={e => { setEmail(e.target.value); setErr(null); }}/>
            <div className='vt-auth-pw'>
                <PasswordField label='Mật khẩu' name='password' autoComplete='current-password'
                               placeholder='Nhập mật khẩu' value={password}
                               onChange={e => { setPassword(e.target.value); setErr(null); }}/>
                {/* No reset-password API yet (PM 22/10): point to support instead of a dead flow. */}
                <div className='vt-auth-forgot'>
                    <button type='button' className='vt-link' aria-expanded={forgot}
                            onClick={() => setForgot(v => !v)}>Quên mật khẩu?</button>
                </div>
                {forgot && <p className='vt-auth-note' role='status'>
                    Chưa hỗ trợ tự đặt lại mật khẩu. Vui lòng liên hệ bộ phận hỗ trợ viettestpro để được cấp lại.
                </p>}
            </div>
            <Button type='submit' variant='primary' block loading={busy} loadingText='Đang đăng nhập…'>Đăng nhập</Button>
        </form>
    </AuthFrame>;
}
