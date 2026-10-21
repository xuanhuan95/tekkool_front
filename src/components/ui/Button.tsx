import {forwardRef} from 'react';
import type {ButtonHTMLAttributes, MouseEvent, ReactNode} from 'react';

import {Spinner} from './icons';
import {cx} from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonClassOptions {
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    iconOnly?: boolean;
}

/** Class string of a button — for a react-router <Link> that must look like a button. */
export function buttonClass({variant = 'secondary', size = 'md', block, iconOnly}: ButtonClassOptions = {}) {
    return cx('vt-btn', 'vt-btn--' + variant, size !== 'md' && 'vt-btn--' + size,
        block && 'vt-btn--block', iconOnly && 'vt-btn--icon');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonClassOptions {
    /** Shows a spinner and swallows clicks (stops double submit) while keeping the button's colours. */
    loading?: boolean;
    /** Text while loading, e.g. "Đang lưu…". Defaults to the normal label. */
    loadingText?: ReactNode;
    icon?: ReactNode;
}

/**
 * Button of design D. Variants: primary (blue + ink shadow), secondary (white), ghost (underlined text),
 * danger (red outline). Sizes: sm 44px, md 46px (default), lg 52px.
 *
 * `loading` is NOT `disabled`: the button keeps focus and colour (canvas "đang tải" row), exposes
 * aria-busy/aria-disabled and ignores clicks — so a slow submit cannot be sent twice.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {variant = 'secondary', size = 'md', block, iconOnly, loading = false, loadingText, icon,
     className, children, onClick, disabled, type = 'button', ...rest}, ref) {

    const click = (e: MouseEvent<HTMLButtonElement>) => {
        if (loading) { e.preventDefault(); return; }
        onClick?.(e);
    };

    return <button ref={ref} type={type} {...rest}
                   className={cx(buttonClass({variant, size, block, iconOnly}), loading && 'vt-btn--loading', className)}
                   disabled={disabled}
                   aria-busy={loading || undefined}
                   aria-disabled={loading || disabled || undefined}
                   onClick={click}>
        {loading ? <Spinner/> : icon}
        {loading && loadingText !== undefined ? loadingText : children}
    </button>;
});

export default Button;
