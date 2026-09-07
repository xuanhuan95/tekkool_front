import React, {Component} from 'react';
import { Button, Form, Segment } from 'semantic-ui-react'
import {connectGlobalState} from "../../stateUtils";
import Api from "../../services/api";
import {getValueById} from "../../services/tools";

class Register extends Component {

    doRegister = async () => {
        let email = getValueById('email');
        let password = getValueById('password');
        let name = getValueById('name');

        let {auth} = this.globalState;

        let params = new URLSearchParams(this.props.location.search);
        let userType = params.get('nextUrl') ? 'visitor': 'teacher';

        let user = await Api.post('user/register?token='+auth.id+'&type='+userType, {email, password, name});

        if(user.error)
            return alert(user.error);

        alert('Dang ky thanh cong');
        this.props.history.push("/?nextUrl="+params.get('nextUrl'));
    };

    render() {

        return <div>
            <Segment style={{maxWidth:'400px',  margin:'0 auto'}}>
                <h3 style={{textAlign:'center'}}>TekTest</h3>
                <Form>
                    <Form.Field>
                      <label>Email</label>
                      <input type='email' id="email" placeholder='Email' />
                    </Form.Field>
                    <Form.Field>
                      <label>Họ và tên</label>
                      <input type='text' id="name" placeholder='Họ và tên' />
                    </Form.Field>
                    <Form.Field>
                      <label>Mật khẩu</label>
                      <input type="password" id="password" placeholder='Mật khẩu' />
                    </Form.Field>
                    <Button secondary type='submit' onClick={this.doRegister}>Đăng ký</Button>
                  </Form>
            </Segment>
        </div>
    }
}

export default connectGlobalState(Register);
