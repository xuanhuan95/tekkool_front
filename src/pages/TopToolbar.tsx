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

    // Đếm bài chờ chấm cho cái chuông. Dùng lại GET exam/pending có sẵn (màn
    // /to-grade vẫn dùng chính nó) thay vì thêm endpoint chỉ để trả một số —
    // danh sách của một giáo viên không đủ lớn để đáng một API riêng.
    const {data: pending = 0} = useQuery({
        queryKey: ['exam', 'pending'],
        // 60s/lần: học sinh nộp bài lúc nào cũng được, không refresh thì giáo
        // viên phải F5 mới thấy. Nhanh hơn nữa là gọi phí, chậm hơn thì chuông
        // vô nghĩa.
        refetchInterval: 60_000,
        enabled: isTeacher,
        // Mất mạng / hết phiên: giữ số cũ, không làm vỡ thanh điều hướng.
        placeholderData: prev => prev,
        queryFn: async () => {
            const subs = await Api.get<Submission[]>('exam/pending');
            return Array.isArray(subs) ? subs.length : 0;
        },
    });

    // Học sinh / khách dùng thanh điều hướng riêng. Màn giáo viên giữ
    // nguyên menu cũ — đổi cả hai một lúc là hai thứ phải kiểm tra.
    if (!isTeacher) return <StudentNav user={user}/>;

    return <Menu id='topMenu' color='blue' inverted>
        <Menu.Item>
            <Link to='/'>
                <Icon name='home'/> Thi thử SPT
            </Link>
        </Menu.Item>

        <Menu color='blue' inverted floated='right'>
            {/* Chuông = lối vào màn chấm bài, kiêm báo "có bài mới". Trước
                đây là mục chữ "Cần chấm" — chữ thì không nói được CÓ MẤY
                BÀI, giáo viên vẫn phải bấm vào mới biết có việc hay không. */}
            <Menu.Item as={Link} to='/to-grade' className='tk-bell'
                       title={pending ? pending + ' bài chờ chấm' : 'Không có bài chờ chấm'}>
                <Icon name='bell outline' size='large' style={{margin: 0}}/>
                {/* KHÔNG dùng `floating` của semantic: nó đẩy label lên trên
                    mép mục, mà mục này sát đỉnh thanh -> số bị cắt mất nửa
                    trên. Định vị tay trong .tk-bell. */}
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
