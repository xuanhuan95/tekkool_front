import type {ReactNode} from 'react';
import toast from 'react-hot-toast';
import {Link} from 'react-router-dom';

import {buttonClass} from './Button';
import {IconAlert, IconOk} from './icons';
import {cx} from './cx';

export interface ToastCardProps {
    tone?: 'success' | 'error';
    title: ReactNode;
    description?: ReactNode;
    /** Link button on the right ("Xem đề"). The Toaster sits under the router, so a Link works here. */
    action?: {label: string; to: string};
    /** react-hot-toast's t.visible — fades out on dismiss. */
    visible?: boolean;
}

/** Small ink-bordered card, icon left; error = red border + red title. */
export function ToastCard({tone = 'success', title, description, action, visible = true}: ToastCardProps) {
    return <div role={tone === 'error' ? 'alert' : 'status'}
                className={cx('vt-toast', tone === 'error' && 'vt-toast--error', action && 'vt-toast--action', !visible && 'vt-toast--leave')}>
        {tone === 'error' ? <IconAlert/> : <IconOk/>}
        <span>
            <span className='vt-toast-title'>{title}</span>
            {description && <span className='vt-toast-desc'>{description}</span>}
        </span>
        {action && <Link to={action.to} className={buttonClass({variant: 'secondary', size: 'sm'})}>{action.label}</Link>}
    </div>;
}

/**
 * Design-D toasts on top of the existing react-hot-toast <Toaster/> (App.tsx).
 *   notify.success('Đã lưu đề', 'Học sinh thấy ngay.')
 *   notify.error('Không lưu được', 'Kiểm tra mạng rồi thử lại.')
 * Errors stay longer (6s): they usually need reading.
 */
export const notify = {
    success: (title: ReactNode, description?: ReactNode, action?: ToastCardProps['action']) =>
        toast.custom(t => <ToastCard tone='success' title={title} description={description} action={action} visible={t.visible}/>,
            {duration: action ? 8000 : 3500}),
    error: (title: ReactNode, description?: ReactNode) =>
        toast.custom(t => <ToastCard tone='error' title={title} description={description} visible={t.visible}/>,
            {duration: 6000}),
    dismiss: (id?: string) => toast.dismiss(id),
};
