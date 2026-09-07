import React from 'react';
import {Menu, Icon, Button, Image, Input} from 'semantic-ui-react';
import {connectGlobalState} from "../../stateUtils";
import {Link} from 'react-router-dom';
import Api from '../../services/api';

class UserBlock extends React.Component {

    doLogout = async () => {
        let {auth} = this.globalState;
        auth = await Api.get('session/logout?token=' + auth.id);
        this.setGlobalState({auth});
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
