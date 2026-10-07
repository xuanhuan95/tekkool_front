import {Link} from 'react-router-dom';
import {Menu, Icon, Button, Label} from 'semantic-ui-react';
import {useQuery} from '@tanstack/react-query';

import Api from '../services/api';
import {useAuthStore} from '../stores/authStore';
import type {Submission} from '../types/submission';
import StudentNav from './StudentNav';

export default function TopToolbar() {
    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.signOut);
    const isTeacher = user?.group === 'teacher';

    // Count attempts awaiting grading for the bell. Reuse the existing GET exam/pending (the
    // /to-grade screen uses the very same one) rather than adding an endpoint just to return a number —
    // one teacher's list is not big enough to deserve its own API.
    const {data: pending = 0} = useQuery({
        queryKey: ['exam', 'pending'],
        // Every 60s: students can submit at any time, without refresh the teacher
        // would have to F5 to see it. Faster is wasteful, slower makes the bell
        // pointless.
        refetchInterval: 60_000,
        enabled: isTeacher,
        // Network lost / session expired: keep the old number, do not break the navigation bar.
        placeholderData: prev => prev,
        queryFn: async () => {
            const subs = await Api.get<Submission[]>('exam/pending');
            return Array.isArray(subs) ? subs.length : 0;
        },
    });

    // Students / visitors use a separate navigation bar. The teacher screen keeps the
    // old menu as is — changing both at once means two things to verify.
    if (!isTeacher) return <StudentNav user={user}/>;

    return <Menu id='topMenu' color='blue' inverted>
        <Menu.Item>
            <Link to='/'>
                <Icon name='home'/> Thi thử SPT
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
                <Button onClick={logout}>Logout</Button>
            </Menu.Item>
        </Menu>
     </Menu>;
}
