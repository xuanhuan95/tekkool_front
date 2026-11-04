import {useState} from 'react';

import {Avatar, Badge, Card} from '../../components/ui';
import {IconEdit} from '../../components/ui/icons';
import {useAuthStore} from '../../stores/authStore';
import {useMeProfile} from '../../queries/student';
import {PasswordDialog} from '../hs/AccountPage';
import {PageHead} from '../hs/common';

/**
 * Teacher profile (canvas APP-teacher-profile-*): name + email + subjects in charge (read-only, Admin assigns) and change password.
 * Same frame/components as the student account page; sign-out lives in the header.
 */
export default function Profile() {
    const user = useAuthStore(s => s.user);
    const [pw, setPw] = useState(false);
    const subjects = useMeProfile().data?.subjects;

    return <div className='hs-page'>
        <PageHead title='Thông tin cá nhân'/>

        <Card as='section' className='hs-card-pad' aria-label='Thông tin của bạn'>
            <div className='hs-row' style={{justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 14}}>
                <Avatar name={user?.name || ''}/>
                <div className='hs-col2'>
                    <span className='hs-h2' style={{overflowWrap: 'anywhere'}}>{user?.name}</span>
                    <span className='hs-meta' style={{overflowWrap: 'anywhere'}}>{user?.email}</span>
                    <span><Badge tone='title'>Giáo viên</Badge></span>
                </div>
            </div>
            {subjects && <div className='hs-col2'>
                <span className='hs-meta'>Môn phụ trách</span>
                {subjects.length
                    ? <span style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>{subjects.map(s => <Badge key={s} tone='title'>{s}</Badge>)}</span>
                    : <span className='hs-meta'>Chưa được gán môn, liên hệ Admin.</span>}
            </div>}
        </Card>

        <section className='hs-sec' aria-labelledby='hs-settings'>
            <h2 id='hs-settings' className='hs-h2'>Cài đặt</h2>
            <Card flush className='hs-settings'>
                <button type='button' className='hs-setting' onClick={() => setPw(true)}>
                    <span className='hs-setting-main'><span>Đổi mật khẩu</span></span>
                    <IconEdit/>
                </button>
            </Card>
        </section>

        {pw && <PasswordDialog open onClose={() => setPw(false)}/>}
    </div>;
}
