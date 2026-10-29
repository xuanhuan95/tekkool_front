import {Link} from 'react-router-dom';
import {Menu, Icon, Button, Label} from 'semantic-ui-react';

import {useAuthStore} from '../stores/authStore';
import {usePendingCount} from '../queries/submissions';

export default function TopToolbar() {
    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.signOut);
    const isTeacher = user?.group === 'teacher';

    const {data: pending = 0} = usePendingCount(isTeacher);

    // Only teachers still reach this old menu; students have StudentShell, admins ManageApp.
    if (!isTeacher) return null;

    return <Menu id='topMenu' color='blue' inverted>
        <Menu.Item>
            <Link to='/'>
                <Icon name='home'/> viettestpro
            </Link>
        </Menu.Item>

        <Menu color='blue' inverted floated='right'>
            {/* Bell = entry to the grading screen, doubling as a "new attempts" alert. It used to
                be a text item "Needs grading" — text cannot say HOW MANY ATTEMPTS, the
                teacher still had to click in to know whether there was work. */}
            <Menu.Item as={Link} to='/to-grade' className='tk-bell'
                       title={pending ? pending + ' bài chờ chấm' : 'Không có bài chờ chấm'}>
                <Icon name='bell outline' size='large' style={{margin: 0}}/>
                {/* Do NOT use semantic's `floating`: it pushes the label above the
                    item edge, but this item is flush with the top of the bar -> the number gets its top
                    half clipped. Positioned by hand in .tk-bell. */}
                {pending > 0 &&
                <Label color='red' circular size='mini'>{pending}</Label>}
            </Menu.Item>

            <Menu.Item>
                <Icon name='user'/>Chào bạn {user?.name}
            </Menu.Item>

            <Menu.Item>
                <Button onClick={logout}>Đăng xuất</Button>
            </Menu.Item>
        </Menu>
     </Menu>;
}
