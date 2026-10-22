import type {ReactNode} from 'react';
import toast from 'react-hot-toast';

import {IconAlert, IconOk} from './icons';
import {cx} from './cx';

export interface ToastCardProps {
    tone?: 'success' | 'error';
    title: ReactNode;
    description?: ReactNode;
    /** react-hot-toast's t.visible — fades out on dismiss. */
    visible?: boolean;
}

/** Small ink-bordered card, icon left; error = red border + red title. */
export function ToastCard({tone = 'success', title, description, visible = true}: ToastCardProps) {
    return <div role={tone === 'error' ? 'alert' : 'status'}
                className={cx('vt-toast', tone === 'error' && 'vt-toast--error', !visible && 'vt-toast--leave')}>
        {tone === 'error' ? <IconAlert/> : <IconOk/>}
        <span>
            <span className='vt-toast-title'>{title}</span>
            {description && <span className='vt-toast-desc'>{description}</span>}
        </span>
    </div>;
}

/**
 * Design-D toasts on top of the existing react-hot-toast <Toaster/> (App.tsx).
 *   notify.success('Đã lưu đề', 'Học sinh thấy ngay.')
 *   notify.error('Không lưu được', 'Kiểm tra mạng rồi thử lại.')
 * Errors stay longer (6s): they usually need reading.
 */
export const notify = {
    success: (title: ReactNode, description?: ReactNode) =>
        toast.custom(t => <ToastCard tone='success' title={title} description={description} visible={t.visible}/>,
            {duration: 3500}),
    error: (title: ReactNode, description?: ReactNode) =>
        toast.custom(t => <ToastCard tone='error' title={title} description={description} visible={t.visible}/>,
            {duration: 6000}),
    dismiss: (id?: string) => toast.dismiss(id),
};
