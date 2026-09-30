import React, {useEffect, useRef, useState} from 'react';
import {Icon} from 'semantic-ui-react';
import {Link, useLocation, useNavigate} from 'react-router-dom';

import Api, {setToken} from '../services/api';

/**
 * Thanh điều hướng của học sinh.
 *
 * ponytail: dựng bằng thẻ thường + CSS chứ không dùng Dropdown của
 * semantic-ui — Dropdown ở đây phải nhồi link router, nút, và dải phân cách
 * vào `options`, cuối cùng dài hơn 30 dòng JSX tự viết mà vẫn phải đè CSS.
 */
export default function StudentNav({user}) {
    const [open, setOpen] = useState(false);
    const [vi, setVi] = useState(null);
    const box = useRef(null);
    const {pathname} = useLocation();
    const navigate = useNavigate();

    // Bấm ra ngoài / bấm Esc thì đóng menu. Không có thì menu dính lại
    // trên màn, người dùng phải bấm đúng nút mới tắt được.
    useEffect(() => {
        if (!open) return;
        const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        const esc = e => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    // Đổi trang thì đóng menu, khỏi che nội dung trang mới.
    useEffect(() => setOpen(false), [pathname]);

    // Số lượt còn lại, tải lại mỗi lần đổi trang: vào thi xong quay ra là con
    // số đã trừ. ponytail: không polling — lượt chỉ đổi khi chính học sinh này
    // vào thi hoặc mua gói, cả hai đều kết thúc bằng một lần đổi trang.
    useEffect(() => {
        if (!user) return;
        Api.get('payment/wallet').then(setVi).catch(() => {});
    }, [pathname, user]);

    const logout = async () => {
        // BE xoa han phien. Bo token o FE truoc khi chuyen trang, neu khong
        // lan mo sau van gui token da chet -> session/init tra 400.
        try { await Api.get('session/logout'); } catch (e) { /* phien co the da het han */ }
        setToken(null);
        window.location.href = '/';
    };

    const go = (to) => { setOpen(false); navigate(to); };

    const name = (user && user.name) || 'Bạn';
    const initial = name.trim().charAt(0) || '?';

    return <nav className='tk-nav'>
        <div className='tk-nav-inner'>
            <Link to='/' className='tk-brand'>
                <Icon name='graduation cap'/> Thi thử SPT
            </Link>


            <div className='tk-nav-right'>
                {/* Ví lượt kiêm lối vào trang mua gói — hết lượt thì đây là chỗ
                    duy nhất học sinh tự mua thêm được. */}
                {vi && <Link to='/packages' className='tk-wallet'
                             title='Mua thêm lượt thi'>
                    <Icon name='ticket'/>
                    <b>{vi.remaining}</b> lượt
                </Link>}

                <div className='tk-user' ref={box}>
                    <button type='button' className='tk-user-btn'
                            aria-haspopup='menu' aria-expanded={open}
                            aria-label={'Tài khoản của ' + name}
                            onClick={() => setOpen(o => !o)}>
                        <span className='tk-avatar' aria-hidden='true'>{initial}</span>
                        <span className='tk-user-name'>{name}</span>
                        <Icon name={open ? 'chevron up' : 'chevron down'} size='small'
                              style={{margin: 0, color: '#667085'}}/>
                    </button>

                    {open &&
                    <div className='tk-menu' role='menu'>
                        <div className='tk-menu-head'>
                            <div className='n'>{name}</div>
                            <div className='e'>{user && user.email}</div>
                        </div>

                        <button type='button' role='menuitem' className='tk-menu-item'
                                onClick={() => go('/profile')}>
                            <Icon name='user outline'/> Thông tin cá nhân
                        </button>
                        <button type='button' role='menuitem' className='tk-menu-item'
                                onClick={() => go('/my-exams')}>
                            <Icon name='clipboard list'/> Lịch sử làm bài
                        </button>
                        <button type='button' role='menuitem' className='tk-menu-item'
                                onClick={() => go('/packages')}>
                            <Icon name='cube'/> Mua lượt thi
                        </button>
                        <button type='button' role='menuitem' className='tk-menu-item'
                                onClick={() => go('/billing')}>
                            <Icon name='credit card outline'/> Lịch sử thanh toán
                        </button>

                        <div className='tk-menu-sep'/>

                        <button type='button' role='menuitem' className='tk-menu-item danger'
                                onClick={logout}>
                            <Icon name='sign out'/> Đăng xuất
                        </button>
                    </div>}
                </div>

                {/* Nút đăng xuất rời, cạnh khối user — yêu cầu (4).
                    Vẫn giữ mục trong menu cho ai quen tìm ở đó. */}
                <button type='button' className='tk-icon-btn'
                        onClick={logout} title='Đăng xuất' aria-label='Đăng xuất'>
                    <Icon name='sign out'/>
                </button>
            </div>
        </div>
    </nav>;
}
