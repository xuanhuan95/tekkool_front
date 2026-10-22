import {useEffect, useId, useRef} from 'react';
import type {ReactNode, RefObject} from 'react';
import {createPortal} from 'react-dom';

import Button from './Button';
import {IconClose} from './icons';
import {cx} from './cx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
    open: boolean;
    /** Esc, overlay click and the close button call this. Omit to make the dialog non-dismissable. */
    onClose?: () => void;
    title: ReactNode;
    children?: ReactNode;
    /** Buttons, right-aligned at the bottom. */
    footer?: ReactNode;
    size?: 'sm' | 'md';
    /** sheet: slides up from the bottom (mobile "Đi tới câu"). */
    placement?: 'center' | 'sheet';
    /** Show the × in the corner (sheets). */
    showClose?: boolean;
    /** Element focused on open; defaults to the first focusable thing in the dialog. */
    initialFocus?: RefObject<HTMLElement | null>;
    className?: string;
}

/**
 * Dialog of design D: overlay rgba(28,25,23,.45), white box with ink border and big radius,
 * Patrick Hand 26px title, buttons bottom-right.
 * Accessibility: role=dialog + aria-modal, labelled by the title, focus moved in and trapped,
 * restored to the opener on close, Esc closes, page behind does not scroll.
 */
export default function Modal({open, onClose, title, children, footer, size = 'sm', placement = 'center',
                               showClose, initialFocus, className}: ModalProps) {
    const titleId = useId();
    const box = useRef<HTMLDivElement>(null);
    // Latest onClose without re-running the open effect (which would steal focus on every render).
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        const target = initialFocus?.current || box.current?.querySelector<HTMLElement>(FOCUSABLE) || box.current;
        target?.focus();

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); closeRef.current(); return; }
            if (e.key !== 'Tab' || !box.current) return;
            const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (items.length === 0) { e.preventDefault(); return; }
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = prevOverflow;
            opener?.focus?.();
        };
    }, [open, initialFocus]);

    if (!open) return null;

    return createPortal(
        <div className={cx('vt-overlay', placement === 'sheet' && 'vt-overlay--sheet')}
             onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div ref={box} role='dialog' aria-modal='true' aria-labelledby={titleId} tabIndex={-1}
                 className={cx('vt-modal', size === 'md' && 'vt-modal--md', className)}>
                <div className='vt-modal-head'>
                    <h2 id={titleId} className='vt-modal-title'>{title}</h2>
                    {showClose && onClose &&
                        <Button variant='secondary' iconOnly aria-label='Đóng' onClick={onClose}><IconClose/></Button>}
                </div>
                {children !== undefined && <div className='vt-modal-body'>{children}</div>}
                {footer && <div className='vt-modal-footer'>{footer}</div>}
            </div>
        </div>,
        document.body);
}

export interface ConfirmDialogProps {
    open: boolean;
    title: ReactNode;
    message?: ReactNode;
    confirmLabel?: ReactNode;
    cancelLabel?: ReactNode;
    /** danger: red confirm button (delete). */
    tone?: 'primary' | 'danger';
    /** While true: confirm shows a spinner and ignores clicks; Esc/overlay/cancel do nothing. */
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * "Nộp bài?"-style confirmation. Focus starts on the SAFE button (cancel), so a stray Enter
 * never submits or deletes.
 */
export function ConfirmDialog({open, title, message, confirmLabel = 'Đồng ý', cancelLabel = 'Huỷ', tone = 'primary',
                               loading = false, onConfirm, onCancel}: ConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const cancel = loading ? undefined : onCancel;
    return <Modal open={open} onClose={cancel} title={title} initialFocus={cancelRef}
                  footer={<>
                      <Button ref={cancelRef} variant='secondary' onClick={cancel} disabled={loading}>{cancelLabel}</Button>
                      <Button variant={tone} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
                  </>}>
        {typeof message === 'string' ? <p>{message}</p> : message}
    </Modal>;
}
