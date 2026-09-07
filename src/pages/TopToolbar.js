import React from 'react';
import {Link} from 'react-router-dom';
import {Menu, Icon, Button} from 'semantic-ui-react';
import {connectGlobalState} from "../stateUtils";
import Api from '../services/api';

class TopToolbar extends React.Component {

    doLogout = async () => {
        await Api.get('session/logout');
        window.location.href = '/';
    };

    render() {
        let {auth} = this.globalState;
        let {user} = auth;

        return <Menu id='topMenu' color='orange' inverted>
            <Menu.Item>
                <Link to='/'>
                    <Icon name='home'/> TekTest
                </Link>
            </Menu.Item>

            {/*<Menu.Item>*/}
                {/*<Link to='/exam/E_bf305f00-536a-f563-3cc7-70e4f6dda523'>*/}
                    {/*<Icon name='list'/> Exam*/}
                {/*</Link>*/}
            {/*</Menu.Item>*/}

            <Menu color='orange' inverted floated='right'>
                <Menu.Item onClick={this.addSection}>
                    <Icon name='user'/>Chào bạn {user.name}
                </Menu.Item>

                <Menu.Item>
                    <Button onClick={this.doLogout}>Logout</Button>
                </Menu.Item>
            </Menu>
         </Menu>
    }
}

export default connectGlobalState(TopToolbar);
