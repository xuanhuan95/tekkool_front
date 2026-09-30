import React from 'react';
import {Menu, Icon, Button, Image, Input} from 'semantic-ui-react';
import {connectGlobalState} from "../../stateUtils";
import {Link} from 'react-router-dom';
import Api, {setToken} from '../../services/api';

class UserBlock extends React.Component {

    doLogout = async () => {
        // Ban cu gan ket qua logout vao auth — gio BE tra {success} chu khong
        // phai session, gan vao la auth.id thanh undefined. Xoa token roi nap
        // lai trang cho App.jsx xin phien an danh moi.
        try { await Api.get('session/logout'); } catch (e) { /* phien co the da het han */ }
        setToken(null);
        window.location.href = '/';
    };

    render() {
        let {auth} = this.globalState;
        let {user} = auth;

        return <Menu id='topMenu'>
            <Menu.Item>
                <Image src='https://tekkool.com/static/blog/imgs/teekool/logo_2.png' size='small'/>
            </Menu.Item>

            <Menu.Item>
                 <Link to='/'>
                    <Button inverted color="green" >List Exam</Button>
                 </Link>
            </Menu.Item>

            <Menu.Item position='right'>
                <Icon name='user'/>Chào {user.name} |
                <Button secondary onClick={this.doLogout}>Logout</Button>
            </Menu.Item>
        </Menu>
    }
}

export default connectGlobalState(UserBlock);
