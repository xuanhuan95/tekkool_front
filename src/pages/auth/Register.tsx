import {useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';

import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import type {User} from '../../types/user';
import AuthArt from './AuthArt';
import './auth.css';

const MIN_PASSWORD = 6;   // khớp ràng buộc BE trong apis/me.py

type LoginResult = User & {token: string; error?: string};

export default function Register() {
    const navigate = useNavigate();
    const token = useAuthStore(s => s.token);
    const signIn = useAuthStore(s => s.signIn);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const doRegister = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;

        if (!name.trim() || !email.trim() || !password)
            return setErr('Nhập đủ họ tên, email và mật khẩu.');
        if (password.length < MIN_PASSWORD)
            return setErr('Mật khẩu cần ít nhất ' + MIN_PASSWORD + ' ký tự.');

        setBusy(true);
        setErr(null);
        try {
            // KHÔNG truyền ?type — BE mặc định 'student'. Bản cũ gửi
            // type=teacher khi vào thẳng /register, nghĩa là ai mở link đó
            // cũng tự cấp cho mình quyền giáo viên. Tài khoản giáo viên tạo
            // bằng tay theo quy trình trong CLAUDE.md.
            const user = await Api.post<{error?: string}>('user/register?token=' + token,
                {email: email.trim(), password, name: name.trim()});

            if (user.error) { setErr(user.error); setBusy(false); return; }

            // Đăng ký xong đăng nhập luôn: bắt gõ lại đúng thứ vừa gõ là vô ích.
            const logged = await Api.post<LoginResult>('session/login',
                {email: email.trim(), password});
            if (logged.error) {
                // Tài khoản đã tạo được, chỉ bước đăng nhập hỏng — đẩy về màn
                // đăng nhập chứ đừng báo "đăng ký thất bại", sai sự thật.
                navigate('/');
                return;
            }
            signIn(logged.token, logged);
        } catch (ex: any) {
            setErr((ex && (ex.error || ex.message)) || 'Không đăng ký được.');
            setBusy(false);
        }
    };

    const set = (fn: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
        fn(e.target.value);
        setErr(null);
    };

    return <div className='tka'>
        <div className='tka-panel'>
            <form className='tka-form' onSubmit={doRegister}>
                <div className='tka-brand'>Thi thử SPT</div>

                <h1 className='tka-title'>Đăng ký</h1>
                <p className='tka-sub'>
                    Tạo tài khoản để bắt đầu luyện đề thi thử.
                </p>

                {err && <div className='tka-err' role='alert'>{err}</div>}

                <div className='tka-field'>
                    <label htmlFor='name'>Họ và tên</label>
                    <input id='name' name='name' type='text' autoComplete='name'
                           placeholder='Nguyễn Văn A' value={name}
                           onChange={set(setName)} autoFocus/>
                </div>

                <div className='tka-field'>
                    <label htmlFor='email'>Email</label>
                    <input id='email' name='email' type='email' autoComplete='username'
                           placeholder='ban@email.com' value={email}
                           onChange={set(setEmail)}/>
                </div>

                <div className='tka-field'>
                    <label htmlFor='password'>Mật khẩu</label>
                    <input id='password' name='password' autoComplete='new-password'
                           type={show ? 'text' : 'password'}
                           placeholder={'Ít nhất ' + MIN_PASSWORD + ' ký tự'} value={password}
                           onChange={set(setPassword)}/>
                    <button type='button' className='tka-eye'
                            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            onClick={() => setShow(!show)}>
                        <i className={'icon ' + (show ? 'eye slash' : 'eye')}/>
                    </button>
                </div>

                <button className='tka-btn' type='submit' disabled={busy}>
                    {busy ? 'Đang tạo…' : 'Đăng ký'}
                </button>

                <div className='tka-alt'>
                    Đã có tài khoản? <Link to='/'>Đăng nhập</Link>
                </div>
            </form>

            <div className='tka-art'><AuthArt/></div>
        </div>
    </div>;
}
