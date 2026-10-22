import {Navigate, Route, Routes} from 'react-router-dom';

import {AdminLayout, ErrorState, WebLayout, buttonClass} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import AdminPackages from './AdminPackages';
import Revenue from './Revenue';
import Teachers from './Teachers';
import './manage.css';

/**
 * Admin area, all under /manage/* (nginx blocks /admin). Only users whose profile group is
 * 'admin' get in; everyone else sees a 403 card. This is UX only — every /api/admin* endpoint
 * is admin_required on the BE.
 */
export default function ManageApp() {
    const user = useAuthStore(s => s.user);

    if (user?.group !== 'admin') {
        return <WebLayout nav={[]} navLabel='Menu'>
            <ErrorState title='Bạn không có quyền vào trang quản trị'
                        description={<>Trang này chỉ dành cho Admin. <a className={buttonClass({variant: 'ghost'})} href='/'>Về trang chủ</a></>}/>
        </WebLayout>;
    }

    return <AdminLayout name={user.name || 'Quản trị viên'}>
        <Routes>
            <Route path='/manage/teachers' element={<Teachers/>}/>
            <Route path='/manage/packages' element={<AdminPackages/>}/>
            <Route path='/manage/revenue' element={<Revenue/>}/>
            <Route path='*' element={<Navigate to='/manage/teachers' replace/>}/>
        </Routes>
    </AdminLayout>;
}
