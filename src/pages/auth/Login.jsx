import withRouter from '../../withRouter';
import React, {Component} from 'react';
import {Button, Segment, Input} from 'semantic-ui-react'
import {Link} from 'react-router-dom';
import {connectGlobalState} from "../../stateUtils";
import logo from '../../imgs/logo.jpg';

import {getValueById} from "../../services/tools";
import Api from "../../services/api";

class Login extends Component {

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

    render() {

        let urlPath = window.location.pathname;
        // let arrUrlPath = urlPath.split('/');

        return <div style={{width: '320px', margin: '3em auto'}}>
            <h2 className='text-center'>
                <img style={{verticalAlign: 'middle'}} src={logo} alt="TekTest"/> Login to your account
            </h2>

            <Segment className='text-center'>

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
