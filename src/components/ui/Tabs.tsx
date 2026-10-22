import {useRef} from 'react';
import type {KeyboardEvent, ReactNode} from 'react';

import {cx} from './cx';

export interface PillItem<V extends string> { value: V; label: ReactNode; disabled?: boolean }

interface PillGroupProps<V extends string> {
    items: PillItem<V>[];
    value: V;
    onChange: (value: V) => void;
    'aria-label': string;
    /** Stretch to full width, items share it equally. */
    block?: boolean;
    className?: string;
}

/** Arrow keys / Home / End move AND select (automatic activation), as WAI-ARIA tabs and radio groups expect. */
function usePillKeys<V extends string>(items: PillItem<V>[], value: V, onChange: (v: V) => void) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const onKeyDown = (e: KeyboardEvent) => {
        const enabled = items.map((it, i) => it.disabled ? -1 : i).filter(i => i >= 0);
        const pos = enabled.indexOf(items.findIndex(it => it.value === value));
        let next: number | undefined;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(pos + 1) % enabled.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(pos - 1 + enabled.length) % enabled.length];
        else if (e.key === 'Home') next = enabled[0];
        else if (e.key === 'End') next = enabled[enabled.length - 1];
        if (next === undefined) return;
        e.preventDefault();
        onChange(items[next].value);
        refs.current[next]?.focus();
    };
    return {refs, onKeyDown};
}

export interface TabsProps<V extends string> extends PillGroupProps<V> {
    /** When set, tab i gets id `${idPrefix}-tab-${value}` and aria-controls `${idPrefix}-panel-${value}`. */
    idPrefix?: string;
}

/** Pill tabs ("Bảng tuần · Thành tích"). The caller renders the panel with role="tabpanel". */
export function Tabs<V extends string>({items, value, onChange, block, className, idPrefix, ...aria}: TabsProps<V>) {
    const {refs, onKeyDown} = usePillKeys(items, value, onChange);
    return <div role='tablist' aria-label={aria['aria-label']} onKeyDown={onKeyDown}
                className={cx('vt-pills', block && 'vt-pills--block', className)}>
        {items.map((it, i) => {
            const sel = it.value === value;
            return <button key={it.value} ref={el => { refs.current[i] = el; }} type='button' role='tab'
                           id={idPrefix ? `${idPrefix}-tab-${it.value}` : undefined}
                           aria-controls={idPrefix ? `${idPrefix}-panel-${it.value}` : undefined}
                           aria-selected={sel} tabIndex={sel ? 0 : -1} disabled={it.disabled}
                           className='vt-pill vt-hit' onClick={() => onChange(it.value)}>{it.label}</button>;
        })}
    </div>;
}

/** Same look as Tabs, but a single choice that filters/sets a value (no panels): role radiogroup. */
export function SegmentedControl<V extends string>({items, value, onChange, block, className, ...aria}: PillGroupProps<V>) {
    const {refs, onKeyDown} = usePillKeys(items, value, onChange);
    return <div role='radiogroup' aria-label={aria['aria-label']} onKeyDown={onKeyDown}
                className={cx('vt-pills', block && 'vt-pills--block', className)}>
        {items.map((it, i) => {
            const sel = it.value === value;
            return <button key={it.value} ref={el => { refs.current[i] = el; }} type='button' role='radio'
                           aria-checked={sel} tabIndex={sel ? 0 : -1} disabled={it.disabled}
                           className='vt-pill vt-hit' onClick={() => onChange(it.value)}>{it.label}</button>;
        })}
    </div>;
}
