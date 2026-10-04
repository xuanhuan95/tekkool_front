import {useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {Link} from 'react-router-dom';

import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import type {User} from '../../types/user';
import AuthArt from './AuthArt';
import './auth.css';

/** BE trả thẳng user kèm token, không bọc trong `{auth}`. */
type LoginResult = User & {token: string; error?: string};

export default function Login() {
    const signIn = useAuthStore(s => s.signIn);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Form thật, không phải div có nút: Enter để gửi, trình duyệt gợi ý mật
    // khẩu đã lưu, và trình quản lý mật khẩu nhận diện được ô nào là ô nào.
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

            // Sai mật khẩu cũng đi qua đây (BE trả {error}), nên phải mở khoá
            // nút lại — không thì người dùng kẹt luôn sau một lần gõ nhầm.
            if (user.error) { setErr(user.error); setBusy(false); return; }

            // BE xoay token mỗi lần đăng nhập (chống session fixation) và đã
            // XOÁ phiên cũ. Không lưu token mới thì request kế tiếp mang token
            // đã chết -> 400.
            signIn(user.token, user);
        } catch (ex: any) {
            setErr((ex && (ex.error || ex.message)) || 'Không đăng nhập được.');
            setBusy(false);
        }
    };

    const set = (fn: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
        fn(e.target.value);
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
