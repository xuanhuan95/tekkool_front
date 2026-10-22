import {forwardRef, useId, useState} from 'react';
import type {InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes} from 'react';

import {IconChevronDown, IconEye, IconEyeOff} from './icons';
import {cx} from './cx';

interface FieldBits {
    label: ReactNode;
    /** Muted 13px line under the control. Hidden while there is an error. */
    hint?: ReactNode;
    /** Red border + red 13px line; sets aria-invalid. */
    error?: ReactNode;
    className?: string;
}

/** Ids + aria wiring shared by all three fields. */
function useFieldIds(id: string | undefined, hint: ReactNode, error: ReactNode, describedBy?: string) {
    const auto = useId();
    const fieldId = id || 'f' + auto;
    const hintId = hint && !error ? fieldId + '-hint' : undefined;
    const errorId = error ? fieldId + '-err' : undefined;
    return {
        fieldId, hintId, errorId,
        aria: {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': [describedBy, errorId, hintId].filter(Boolean).join(' ') || undefined,
        },
    };
}

function FieldShell({fieldId, label, hintId, hint, errorId, error, disabled, className, children}: {
    fieldId: string; label: ReactNode; hintId?: string; hint?: ReactNode; errorId?: string; error?: ReactNode;
    disabled?: boolean; className?: string; children: ReactNode;
}) {
    return <div className={cx('vt-field', disabled && 'vt-field--disabled', className)}>
        <label htmlFor={fieldId} className='vt-field-label'>{label}</label>
        {children}
        {error && <span id={errorId} className='vt-field-error'>{error}</span>}
        {hintId && <span id={hintId} className='vt-field-hint'>{hint}</span>}
    </div>;
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldBits {
    /** lg: 18px, 52px tall — short-answer box on the exam screen. */
    size?: 'md' | 'lg';
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
    {label, hint, error, className, size = 'md', id, disabled, 'aria-describedby': db, ...rest}, ref) {
    const f = useFieldIds(id, hint, error, db);
    return <FieldShell {...f} label={label} hint={hint} error={error} disabled={disabled} className={className}>
        <input ref={ref} id={f.fieldId} disabled={disabled} {...rest} {...f.aria}
               className={cx('vt-input', size === 'lg' && 'vt-input--lg')}/>
    </FieldShell>;
});

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'size'>;

/**
 * Password input with the eye button (HS-DangNhap / HS-DangKy): 44×44 button inside the right edge,
 * aria-pressed + label switch "Hiện mật khẩu" / "Ẩn mật khẩu". The button is type=button so it never
 * submits the form.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
    {label, hint, error, className, id, disabled, 'aria-describedby': db, ...rest}, ref) {
    const f = useFieldIds(id, hint, error, db);
    const [shown, setShown] = useState(false);
    return <FieldShell {...f} label={label} hint={hint} error={error} disabled={disabled} className={className}>
        <span className='vt-password-wrap'>
            <input ref={ref} id={f.fieldId} disabled={disabled} {...rest} {...f.aria}
                   type={shown ? 'text' : 'password'} className='vt-input'/>
            <button type='button' className='vt-password-eye' disabled={disabled}
                    aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={shown}
                    onClick={() => setShown(v => !v)}>
                {shown ? <IconEyeOff/> : <IconEye/>}
            </button>
        </span>
    </FieldShell>;
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldBits {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
    {label, hint, error, className, id, disabled, rows = 3, 'aria-describedby': db, ...rest}, ref) {
    const f = useFieldIds(id, hint, error, db);
    return <FieldShell {...f} label={label} hint={hint} error={error} disabled={disabled} className={className}>
        <textarea ref={ref} id={f.fieldId} rows={rows} disabled={disabled} {...rest} {...f.aria} className='vt-input'/>
    </FieldShell>;
});

export interface SelectOption { value: string; label: ReactNode; disabled?: boolean }
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldBits {
    options?: SelectOption[];
    /** First, empty option ("Chọn môn"). */
    placeholder?: string;
}

/** Native <select> (keyboard + mobile pickers for free), restyled with the ink border and a chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    {label, hint, error, className, id, disabled, options, placeholder, children, 'aria-describedby': db, ...rest}, ref) {
    const f = useFieldIds(id, hint, error, db);
    return <FieldShell {...f} label={label} hint={hint} error={error} disabled={disabled} className={className}>
        <span className='vt-select-wrap'>
            <select ref={ref} id={f.fieldId} disabled={disabled} {...rest} {...f.aria} className='vt-input'>
                {placeholder !== undefined && <option value=''>{placeholder}</option>}
                {options?.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                {children}
            </select>
            <IconChevronDown/>
        </span>
    </FieldShell>;
});
