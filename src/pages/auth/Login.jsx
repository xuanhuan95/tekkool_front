import withRouter from '../../withRouter';
import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {connectGlobalState} from "../../stateUtils";
import Api, {setToken} from "../../services/api";
import AuthArt from './AuthArt';
import './auth.css';

class Login extends Component {
    state = {email: '', password: '', show: false, err: null, busy: false};

    // Form thật, không phải div có nút: Enter để gửi, trình duyệt gợi ý mật
    // khẩu đã lưu, và trình quản lý mật khẩu nhận diện được ô nào là ô nào.
    doLogin = async (e) => {
        e.preventDefault();
        let {email, password, busy} = this.state;
        if (busy) return;

        if (!email.trim() || !password)
            return this.setState({err: 'Nhập đủ email và mật khẩu.'});

        this.setState({busy: true, err: null});
        try {
            let {auth} = this.globalState;
            let user = await Api.post('session/login', {email: email.trim(), password});

            // Sai mật khẩu cũng đi qua đây (BE trả {error}), nên phải mở khoá
            // nút lại — không thì người dùng kẹt luôn sau một lần gõ nhầm.
            if (user.error) return this.setState({err: user.error, busy: false});

            // BE xoay token moi lan dang nhap (chong session fixation) va da
            // XOA phien cu. Khong luu token moi thi request ke tiep mang token
            // da chet -> 400.
            setToken(user.token);
            auth.id = user.token;
            auth.user = user;
            this.setGlobalState({auth});
        } catch (ex) {
            this.setState({err: (ex && (ex.error || ex.message)) || 'Không đăng nhập được.', busy: false});
        }
    };

    set = (k) => (e) => this.setState({[k]: e.target.value, err: null});

    render() {
        let {email, password, show, err, busy} = this.state;
        let nextUrl = window.location.pathname;

        return <div className='tka'>
            <div className='tka-panel'>
                <form className='tka-form' onSubmit={this.doLogin}>
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
                               onChange={this.set('email')} autoFocus/>
                    </div>

                    <div className='tka-field'>
                        <label htmlFor='password'>Mật khẩu</label>
                        <input id='password' name='password' autoComplete='current-password'
                               type={show ? 'text' : 'password'}
                               placeholder='Nhập mật khẩu' value={password}
                               onChange={this.set('password')}/>
                        <button type='button' className='tka-eye'
                                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                onClick={() => this.setState({show: !show})}>
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
}

export default withRouter(connectGlobalState(Login));
