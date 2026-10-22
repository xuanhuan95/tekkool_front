import {useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {Link} from 'react-router-dom';

import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import type {User} from '../../types/user';
import AuthArt from './AuthArt';
import './auth.css';

/** The BE returns the user with a token directly, not wrapped in `{auth}`. */
type LoginResult = User & {token: string; error?: string};

export default function Login() {
    const signIn = useAuthStore(s => s.signIn);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // A real form, not a div with a button: Enter submits, the browser suggests saved
    // passwords, and the password manager can tell which field is which.
    const doLogin = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;

        if (!email.trim() || !password)
            return setErr('Nhập đủ email và mật khẩu.');

        setBusy(true);
        setErr(null);
        try {
            const user = await Api.post<LoginResult>('session/login',
                {email: email.trim(), password});

            // A wrong password also comes through here (BE returns {error}), so the button
            // must be unlocked again — otherwise the user is stuck after a single typo.
            if (user.error) { setErr(user.error); setBusy(false); return; }

            // The BE rotates the token on every login (anti session fixation) and has
            // DELETED the old session. Without saving the new token the next request carries
            // a dead token -> 400.
            signIn(user.token, user);
        } catch (ex: any) {
            setErr((ex && (ex.error || ex.message)) || 'Không đăng nhập được.');
            setBusy(false);
        }
    };

    const set = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
        setErr(null);
    };

    const nextUrl = window.location.pathname;

    return <div className='tka'>
        <div className='tka-panel'>
            <form className='tka-form' onSubmit={doLogin}>
                <div className='tka-brand'>Thi thử SPT</div>

                <h1 className='tka-title'>Đăng nhập</h1>
                <p className='tka-sub'>
                    Đăng nhập để bắt đầu luyện đề thi thử ngay.
                </p>

                {err && <div className='tka-err' role='alert'>{err}</div>}

                <div className='tka-field'>
                    <label htmlFor='email'>Email</label>
                    <input id='email' name='email' type='email' autoComplete='username'
                           placeholder='ban@email.com' value={email}
                           onChange={set(setEmail)} autoFocus/>
                </div>

                <div className='tka-field'>
                    <label htmlFor='password'>Mật khẩu</label>
                    <input id='password' name='password' autoComplete='current-password'
                           type={show ? 'text' : 'password'}
                           placeholder='Nhập mật khẩu' value={password}
                           onChange={set(setPassword)}/>
                    <button type='button' className='tka-eye'
                            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            onClick={() => setShow(!show)}>
                        <i className={'icon ' + (show ? 'eye slash' : 'eye')}/>
                    </button>
                </div>

                <button className='tka-btn' type='submit' disabled={busy}>
                    {busy ? 'Đang vào…' : 'Đăng nhập'}
                </button>

                <div className='tka-alt'>
                    Chưa có tài khoản? <Link to={'/register?nextUrl=' + nextUrl}>Đăng ký</Link>
                </div>
            </form>

            <div className='tka-art'><AuthArt/></div>
        </div>
    </div>;
}
