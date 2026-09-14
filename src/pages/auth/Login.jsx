import withRouter from '../../withRouter';
import React, {Component} from 'react';
import {Button, Segment, Icon, Input} from 'semantic-ui-react'
import {Link} from 'react-router-dom';
import {connectGlobalState} from "../../stateUtils";
import logo from '../../imgs/logo.jpg';

import {getValueById} from "../../services/tools";
import Api from "../../services/api";
import {loadFbSDK, loadGoogleSDK} from "../../services/auth";

class Login extends Component {

    async componentDidMount() {
        this.googleSDK = await loadGoogleSDK();
    }

    doLogin = async () => {
        let email = getValueById('email');
        let password = getValueById('password');

        let {auth} = this.globalState;

        let user = await Api.post('session/login', {email, password});

        if (user.error)
            return alert(user.error);

        auth.user = user;
        this.setGlobalState({auth});
    };

    setLoginState = () => {
        this.fbSDK.api('/me?fields=id,name,email', async (userFB) => {
            let payload = {
                'id': userFB.id,
                'name': userFB.name,
                'email': userFB.email
            };

            let {auth} = this.globalState;

            let userType = this.getUserType();
            auth.user = await Api.post('session/login_platform/fb?token=' + auth.id+'&type='+userType, payload);

            if (auth.user.error) {
                alert('Email này đã được đăng ký. Nếu đó là bạn vui lòng đăng nhập trước khi kết nối vào các tài khoản mạng xã hội khác.');

                return;
            }

            this.setGlobalState({auth});
        });
    };

    doLoginFacebook = async () => {
        this.fbSDK = await loadFbSDK();

        this.fbSDK.getLoginStatus(response => {
            if (response.status !== 'connected') {
                this.fbSDK.login(this.setLoginState, {scope: 'public_profile,email'});
            } else {
                this.setLoginState();
            }

        });
    };

    async setGoogleLoginState() {
        let profile = this.googleAuth2.currentUser.get().getBasicProfile();
        let payload = {
            'id': profile.getId(),
            'name': profile.getName(),
            'email': profile.getEmail()
        };
        let {auth} = this.globalState;

        let userType = this.getUserType();
        auth.user = await Api.post('session/login_platform/google?token=' + auth.id+'&type='+userType, payload);

        if (auth.user.error) {
            alert('Email này đã được đăng ký. Nếu đó là bạn vui lòng đăng nhập trước khi kết nối vào các tài khoản mạng xã hội khác.');

            return;
        }

        this.setGlobalState({auth});
    }

    doLoginGoogle = async () => {
        this.googleAuth2 = this.googleSDK.init({
            client_id: '686082258855-l8t2p6f7guqkcqo71kc0kfins6fbm442.apps.googleusercontent.com',
            fetch_basic_profile: true,
            scope: 'profile email'
        });
        await this.googleAuth2.signIn();
        this.setGoogleLoginState();
    };

    getUserType = () => {
        let params = new URLSearchParams(this.props.location.search);
        let userType = params.get('nextUrl') ? 'visitor': 'teacher';

        let urlPath = window.location.pathname.split('');

        if(urlPath === 'do-exam'){
            userType = 'visitor';
        }

        return userType;
    };

    render() {

        let urlPath = window.location.pathname;
        // let arrUrlPath = urlPath.split('/');

        return <div style={{width: '320px', margin: '3em auto'}}>
            <h2 className='text-center'>
                <img style={{verticalAlign: 'middle'}} src={logo} alt="TekTest"/> Login to your account
            </h2>

            <Segment className='text-center'>

                <Button fluid className='margin-top' type='button' color='blue' onClick={this.doLoginFacebook}>
                    <Icon name='facebook'/> Login with Facebook
                </Button>

                <Button fluid className='margin-top' color='red' type='button' onClick={this.doLoginGoogle}>
                    <Icon name='google'/> Login with Google +
                </Button>

                <hr className='margin-top' />

                <h3>Login with account</h3>
                <Input id='email' fluid icon='user' iconPosition='left' placeholder='Email' />
                <Input id='password' className='margin-top' fluid icon='lock' iconPosition='left' placeholder='Email' type='password' />


                <div className='actions margin-top'>
                    <Button primary type='submit' onClick={this.doLogin}>Đăng nhập</Button>
                    <Link to={`/register?nextUrl=${urlPath}`}>
                        <Button secondary type='submit'>Đăng ký</Button>
                    </Link>
                </div>
            </Segment>
        </div>
    }
}

export default withRouter(connectGlobalState(Login));
