import type {ReactNode} from 'react';

import {cx} from './cx';

export interface ProgressBarProps {
    value: number;
    max: number;
    /** Accessible name, e.g. "Số câu đã làm". */
    label: string;
    /** Optional visible line above: left text + "value / max" on the right. */
    caption?: ReactNode;
    showCount?: boolean;
    className?: string;
}

/** 8px track #EFEFEC, sun fill. Value is clamped to [0, max]. */
export default function ProgressBar({value, max, label, caption, showCount, className}: ProgressBarProps) {
    const v = Math.min(Math.max(value, 0), Math.max(max, 0));
    const pct = max > 0 ? (v / max) * 100 : 0;
    return <div className={cx('vt-progress', className)}>
        {(caption || showCount) && <div className='vt-progress-head' aria-hidden='true'>
            <span>{caption}</span>
            {showCount && <span className='vt-num'>{v} / {max}</span>}
        </div>}
        <div className='vt-progress-track' role='progressbar' aria-label={label}
             aria-valuemin={0} aria-valuemax={max} aria-valuenow={v} aria-valuetext={`${v} / ${max}`}>
            <div className='vt-progress-fill' style={{width: pct + '%'}}/>
        </div>
    </div>;
}
