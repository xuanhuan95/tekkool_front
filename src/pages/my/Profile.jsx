import React, {Component} from 'react';
import {Icon} from 'semantic-ui-react';

import Api from '../../services/api';
import {connectGlobalState} from '../../stateUtils';

/**
 * Hồ sơ cá nhân: đổi tên hiển thị, đổi mật khẩu.
 *
 * Email không sửa được — nó là khoá đăng nhập, đổi ở đây là mất tài khoản.
 *
 * ponytail: BẮT BUỘC là class. connectGlobalState dùng `extends
 * WrappedComponent`, function component không extends được -> lỗi runtime.
 */
class Profile extends Component {
    state = {
        name: '',
        nameMsg: null,
        savingName: false,
        old_password: '',
        new_password: '',
        confirm: '',
        pwMsg: null,
        savingPw: false,
    };

    // globalState chỉ đăng ký watcher khi ĐỌC trong render, nên lấy tên ban
    // đầu ở componentDidMount là an toàn và đủ sớm cho ô input.
    componentDidMount() {
        let user = this.user();
        this.setState({name: (user && user.name) || ''});
    }

    user = () => {
        let {auth} = this.globalState;
        return (auth && auth.user) || {};
    };

    saveName = async (e) => {
        e.preventDefault();
        let name = this.state.name.trim();
        if (!name) return this.setState({nameMsg: {err: 'Tên không được để trống'}});

        this.setState({savingName: true, nameMsg: null});
        try {
            let r = await Api.post('me/update', {name});
            // Cập nhật globalState -> tên trên thanh điều hướng đổi ngay,
            // không phải tải lại trang mới thấy.
            let {auth} = this.globalState;
            this.setGlobalState({auth: {...auth, user: {...auth.user, name: r.name}}});
            this.setState({nameMsg: {ok: 'Đã lưu tên mới.'}, savingName: false});
        } catch (err) {
            this.setState({
                nameMsg: {err: (err && (err.error || err.message)) || 'Lưu thất bại'},
                savingName: false,
            });
        }
    };

    savePw = async (e) => {
        e.preventDefault();
        let {old_password, new_password, confirm} = this.state;

        // Kiểm khớp ở FE cho phản hồi nhanh; BE vẫn kiểm mật khẩu cũ và độ dài
        // — đây chỉ để đỡ một vòng gọi mạng, không phải chốt chặn.
        if (new_password !== confirm) {
            return this.setState({pwMsg: {err: 'Hai ô mật khẩu mới không giống nhau'}});
        }

        this.setState({savingPw: true, pwMsg: null});
        try {
            await Api.post('me/change_password', {old_password, new_password});
            this.setState({
                old_password: '', new_password: '', confirm: '',
                pwMsg: {ok: 'Đã đổi mật khẩu.'}, savingPw: false,
            });
        } catch (err) {
            this.setState({
                pwMsg: {err: (err && (err.error || err.message)) || 'Đổi mật khẩu thất bại'},
                savingPw: false,
            });
        }
    };

    set = (k) => (e) => this.setState({[k]: e.target.value});

    render() {
        let user = this.user();
        let {name, nameMsg, savingName, old_password, new_password, confirm, pwMsg, savingPw} = this.state;

        return <div className='tk'><div className='tk-wrap tk-narrow'>
            <h1 className='tk-title'>Thông tin cá nhân</h1>
            <p className='tk-sub'>Cập nhật tên hiển thị và mật khẩu đăng nhập.</p>

            <form className='tk-card' onSubmit={this.saveName}>
                <h3>Thông tin chung</h3>
                <div className='tk-card-hint'>Tên này hiện trên bài làm gửi cho giáo viên.</div>

                {nameMsg && nameMsg.ok &&
                <div className='tk-note ok'><Icon name='check circle'/> {nameMsg.ok}</div>}

                <div className='tk-field'>
                    <label htmlFor='pf-email'>Email</label>
                    <input id='pf-email' type='email' value={user.email || ''} disabled/>
                    <div className='tk-field-hint'>Email là tên đăng nhập, không đổi được.</div>
                </div>

                <div className='tk-field'>
                    <label htmlFor='pf-name'>Tên hiển thị</label>
                    <input id='pf-name' type='text' value={name} maxLength={80}
                           onChange={this.set('name')}/>
                    {nameMsg && nameMsg.err && <div className='tk-field-error'>{nameMsg.err}</div>}
                </div>

                <button type='submit' className='tk-btn' disabled={savingName}>
                    {savingName ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
            </form>

            <form className='tk-card' onSubmit={this.savePw}>
                <h3>Đổi mật khẩu</h3>
                <div className='tk-card-hint'>Cần nhập mật khẩu hiện tại để xác nhận là bạn.</div>

                {pwMsg && pwMsg.ok &&
                <div className='tk-note ok'><Icon name='check circle'/> {pwMsg.ok}</div>}

                <div className='tk-field'>
                    <label htmlFor='pf-old'>Mật khẩu hiện tại</label>
                    <input id='pf-old' type='password' autoComplete='current-password'
                           value={old_password} onChange={this.set('old_password')}/>
                </div>

                <div className='tk-field'>
                    <label htmlFor='pf-new'>Mật khẩu mới</label>
                    <input id='pf-new' type='password' autoComplete='new-password'
                           value={new_password} onChange={this.set('new_password')}/>
                    <div className='tk-field-hint'>Tối thiểu 6 ký tự.</div>
                </div>

                <div className='tk-field'>
                    <label htmlFor='pf-confirm'>Nhập lại mật khẩu mới</label>
                    <input id='pf-confirm' type='password' autoComplete='new-password'
                           value={confirm} onChange={this.set('confirm')}/>
                    {pwMsg && pwMsg.err && <div className='tk-field-error'>{pwMsg.err}</div>}
                </div>

                <button type='submit' className='tk-btn'
                        disabled={savingPw || !old_password || !new_password}>
                    {savingPw ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </button>
            </form>
        </div></div>;
    }
}

export default connectGlobalState(Profile);
