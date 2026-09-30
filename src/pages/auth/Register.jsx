import withRouter from '../../withRouter';
import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {connectGlobalState} from "../../stateUtils";
import Api, {setToken} from "../../services/api";
import AuthArt from './AuthArt';
import './auth.css';

const MIN_PASSWORD = 6;   // khớp ràng buộc BE trong apis/me.py

class Register extends Component {
    state = {name: '', email: '', password: '', show: false, err: null, busy: false};

    doRegister = async (e) => {
        e.preventDefault();
        let {name, email, password, busy} = this.state;
        if (busy) return;

        if (!name.trim() || !email.trim() || !password)
            return this.setState({err: 'Nhập đủ họ tên, email và mật khẩu.'});
        if (password.length < MIN_PASSWORD)
            return this.setState({err: 'Mật khẩu cần ít nhất ' + MIN_PASSWORD + ' ký tự.'});

        this.setState({busy: true, err: null});
        try {
            let {auth} = this.globalState;

            // KHÔNG truyền ?type — BE mặc định 'student'. Bản cũ gửi
            // type=teacher khi vào thẳng /register, nghĩa là ai mở link đó
            // cũng tự cấp cho mình quyền giáo viên. Tài khoản giáo viên tạo
            // bằng tay theo quy trình trong CLAUDE.md.
            let user = await Api.post('user/register?token=' + auth.id,
                {email: email.trim(), password, name: name.trim()});

            if (user.error) return this.setState({err: user.error, busy: false});

            // Đăng ký xong đăng nhập luôn: bắt gõ lại đúng thứ vừa gõ là vô ích.
            let logged = await Api.post('session/login', {email: email.trim(), password});
            if (logged.error) {
                // Tài khoản đã tạo được, chỉ bước đăng nhập hỏng — đẩy về màn
                // đăng nhập chứ đừng báo "đăng ký thất bại", sai sự thật.
                return this.props.history.push('/');
            }
            setToken(logged.token);
            auth.id = logged.token;
            auth.user = logged;
            this.setGlobalState({auth});
        } catch (ex) {
            this.setState({err: (ex && (ex.error || ex.message)) || 'Không đăng ký được.', busy: false});
        }
    };

    set = (k) => (e) => this.setState({[k]: e.target.value, err: null});

    render() {
        let {name, email, password, show, err, busy} = this.state;

        return <div className='tka'>
            <div className='tka-panel'>
                <form className='tka-form' onSubmit={this.doRegister}>
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
                               onChange={this.set('name')} autoFocus/>
                    </div>

                    <div className='tka-field'>
                        <label htmlFor='email'>Email</label>
                        <input id='email' name='email' type='email' autoComplete='username'
                               placeholder='ban@email.com' value={email}
                               onChange={this.set('email')}/>
                    </div>

                    <div className='tka-field'>
                        <label htmlFor='password'>Mật khẩu</label>
                        <input id='password' name='password' autoComplete='new-password'
                               type={show ? 'text' : 'password'}
                               placeholder={'Ít nhất ' + MIN_PASSWORD + ' ký tự'} value={password}
                               onChange={this.set('password')}/>
                        <button type='button' className='tka-eye'
                                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                onClick={() => this.setState({show: !show})}>
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
}

export default withRouter(connectGlobalState(Register));
