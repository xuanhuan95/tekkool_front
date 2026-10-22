import {useState} from 'react';
import type {FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';

import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import {Button, PasswordField, TextField} from '../../components/ui';
import {IconAlert} from '../../components/ui/icons';
import {homeFor, loginWithRetry, MIN_PASSWORD, registerErrorMessage, validateRegister} from './authLogic';
import type {LoginResult, RegisterErrors, RegisterForm} from './authLogic';
import AuthFrame from './AuthFrame';

const EMPTY: RegisterForm = {name: '', email: '', password: '', password2: '', agree: false};

/** HS-DangKy (design D). Public sign-up is always a student (BE ignores ?type). */
export default function Register() {
    const navigate = useNavigate();
    const signIn = useAuthStore(s => s.signIn);
    const init = useAuthStore(s => s.init);

    const [form, setForm] = useState<RegisterForm>(EMPTY);
    const [errors, setErrors] = useState<RegisterErrors>({});
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const set = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) => {
        setForm(f => ({...f, [k]: v}));
        setErrors(e => ({...e, [k]: undefined}));
        setErr(null);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;
        const v = validateRegister(form);
        setErrors(v);
        if (Object.values(v).some(Boolean)) return;

        setBusy(true);
        setErr(null);
        const email = form.email.trim();
        try {
            await Api.post('user/register', {email, password: form.password, name: form.name.trim()});
        } catch (ex) {
            setErr(registerErrorMessage(ex));
            setBusy(false);
            return;
        }
        // Signed up: log in right away instead of making them type it again.
        try {
            const user = await loginWithRetry(
                () => Api.post<LoginResult>('session/login', {email, password: form.password}), init);
            signIn(user.token, user);
            navigate(homeFor(user.group), {replace: true});
        } catch {
            // The account exists; only the auto-login failed — send them to the login screen, not "sign-up failed".
            navigate('/', {replace: true});
        }
    };

    return <AuthFrame title='Tạo tài khoản' subtitle='Chỉ mất một phút để bắt đầu luyện đề.'
                      footer={<><span className='vt-muted'>Đã có tài khoản?</span>
                          <Link to='/' className='vt-link'>Đăng nhập</Link></>}>
        <form className='vt-auth-form' onSubmit={submit} noValidate>
            {err && <div role='alert' className='vt-auth-alert'><IconAlert size={18}/><span>{err}</span></div>}
            <TextField label='Họ và tên' name='name' autoComplete='name' value={form.name} autoFocus
                       placeholder='Nguyễn Minh Anh' error={errors.name} onChange={e => set('name', e.target.value)}/>
            <TextField label='Email' type='email' name='email' autoComplete='email' value={form.email}
                       placeholder='ban@email.com' error={errors.email} onChange={e => set('email', e.target.value)}/>
            <PasswordField label='Mật khẩu' name='password' autoComplete='new-password' value={form.password}
                           hint={'Ít nhất ' + MIN_PASSWORD + ' ký tự.'} error={errors.password}
                           onChange={e => set('password', e.target.value)}/>
            <PasswordField label='Nhập lại mật khẩu' name='password2' autoComplete='new-password' value={form.password2}
                           error={errors.password2} onChange={e => set('password2', e.target.value)}/>
            <label className='vt-auth-check'>
                <input type='checkbox' name='agree' checked={form.agree} aria-invalid={errors.agree ? true : undefined}
                       onChange={e => set('agree', e.target.checked)}/>
                {/* ponytail: no terms/privacy pages exist yet — plain text until they do (see report). */}
                <span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật.</span>
            </label>
            {errors.agree && <span className='vt-auth-check-err' role='alert'>{errors.agree}</span>}
            <Button type='submit' variant='primary' block loading={busy} loadingText='Đang tạo…'>Tạo tài khoản</Button>
        </form>
    </AuthFrame>;
}
