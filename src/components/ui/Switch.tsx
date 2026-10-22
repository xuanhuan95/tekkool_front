import {useId} from 'react';
import type {ReactNode} from 'react';

import {cx} from './cx';

export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Visible text next to the track; also the accessible name. */
    label: ReactNode;
    disabled?: boolean;
    className?: string;
}

/** Toggle: 44×24 track with ink border. On = blue track, ink knob right. */
export default function Switch({checked, onChange, label, disabled, className}: SwitchProps) {
    const id = useId();
    return <span className={cx('vt-switch-row', className)}>
        <button type='button' role='switch' aria-checked={checked} aria-labelledby={id}
                className='vt-switch' disabled={disabled} onClick={() => onChange(!checked)}/>
        <span id={id} onClick={() => !disabled && onChange(!checked)}>{label}</span>
    </span>;
}
