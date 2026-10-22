import {Menu, Icon, Button, Image} from 'semantic-ui-react';
import {Link} from 'react-router-dom';

import {useAuthStore} from '../../stores/authStore';

export default function UserBlock() {
    const user = useAuthStore(s => s.user);
    // The old version assigned the logout result to auth — the BE returns {success}, not a
    // session, so assigning it made auth.id undefined. The store clears the token and
    // reloads the page so App requests a fresh anonymous session.
    const logout = useAuthStore(s => s.signOut);

    return <Menu id='topMenu'>
        <Menu.Item>
            <Image src='https://tekkool.com/static/blog/imgs/teekool/logo_2.png' size='small'/>
        </Menu.Item>

        <Menu.Item>
             <Link to='/'>
                <Button inverted color='green'>List Exam</Button>
             </Link>
        </Menu.Item>

        <Menu.Item position='right'>
            <Icon name='user'/>Chào {user?.name} |
            <Button secondary onClick={logout}>Logout</Button>
        </Menu.Item>
    </Menu>;
}
