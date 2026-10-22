import {useEffect, useRef, useState} from 'react';
import {Icon} from 'semantic-ui-react';
import {Link, useLocation, useNavigate} from 'react-router-dom';

import Api from '../services/api';
import {useAuthStore} from '../stores/authStore';
import type {Wallet} from '../types/payment';

/**
 * Student navigation bar.
 *
 * ponytail: built with plain tags + CSS rather than semantic-ui's Dropdown —
 * here the Dropdown would need router links, buttons and separators stuffed
 * into `options`, ending up longer than 30 lines of hand-written JSX and still needing CSS overrides.
 */
export default function StudentNav({user}: {user?: {name?: string; email?: string} | null}) {
    const [open, setOpen] = useState(false);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const box = useRef<HTMLDivElement>(null);
    const {pathname} = useLocation();
    const navigate = useNavigate();
    // The BE deletes the session outright then the page reloads — shared with TopToolbar/UserBlock.
    const logout = useAuthStore(s => s.signOut);

    // Clicking outside / pressing Esc closes the menu. Without it the menu sticks
    // on screen and the user must hit the exact button to dismiss it.
    useEffect(() => {
        if (!open) return;
        const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    // Close the menu on page change so it does not cover the new page's content.
    useEffect(() => setOpen(false), [pathname]);

    // Remaining turns, reloaded on every page change: after entering an exam and coming back the
    // number is already deducted. ponytail: no polling — turns only change when this very student
    // enters an exam or buys a package, both of which end with a page change.
    useEffect(() => {
        if (!user) return;
        Api.get('payment/wallet').then(setWallet).catch(() => {});
    }, [pathname, user]);


    const go = (to: string) => { setOpen(false); navigate(to); };

    const name = (user && user.name) || 'Bạn';
    const initial = name.trim().charAt(0) || '?';

    return <nav className='tk-nav'>
        <div className='tk-nav-inner'>
            <Link to='/' className='tk-brand'>
                <Icon name='graduation cap'/> Thi thử SPT
            </Link>


            <div className='tk-nav-right'>
                {/* Turn wallet doubling as the entry to the package page — when turns run out this is the only
                    place the student can buy more on their own. */}
                {wallet && <Link to='/packages' className='tk-wallet'
                             title='Mua thêm lượt thi'>
                    <Icon name='ticket'/>
                    <b>{wallet.remaining}</b> lượt
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
                                onClick={() => go('/history')}>
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

                {/* Standalone logout button, next to the user block — requirement (4).
                    The menu entry is kept for anyone used to looking there. */}
                <button type='button' className='tk-icon-btn'
                        onClick={logout} title='Đăng xuất' aria-label='Đăng xuất'>
                    <Icon name='sign out'/>
                </button>
            </div>
        </div>
    </nav>;
}
