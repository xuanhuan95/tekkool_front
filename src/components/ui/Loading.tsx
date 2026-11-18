import {useEffect, useState} from 'react';

import {cx} from './cx';

/** Data back within this time → no loading at all (no flash). */
export const LOADING_DELAY_MS = 300;
/** Still waiting after this → the sentence changes (the pencil keeps writing). */
export const LOADING_SLOW_MS = 8000;

/** true once `ms` have passed since mount (or since `on` turned true). */
export function useAfter(ms: number, on = true) {
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (!on) { setDone(false); return; }
        const t = setTimeout(() => setDone(true), ms);
        return () => clearTimeout(t);
    }, [ms, on]);
    return done;
}

const PEN = <svg className='ld-pen' width='48' height='60' viewBox='0 0 120 150' aria-hidden='true' focusable='false'>
    <g transform='rotate(14 60 80)' stroke='#1c1917' strokeWidth='3' strokeLinejoin='round' strokeLinecap='round'>
        <rect x='42' y='8' width='36' height='16' rx='5' fill='#f9a8b8'/>
        <rect x='42' y='24' width='36' height='9' fill='#d6d3d1'/>
        <rect x='42' y='33' width='36' height='81' fill='#faad05'/>
        <path d='M42 114 L60 146 L78 114 Z' fill='#f3d9b1'/>
        <path d='M54 134 L60 146 L66 134 Z' fill='#1c1917'/>
        <path d='M51 33 V114 M69 33 V114' strokeWidth='1.5' opacity='.35'/>
        <circle cx='52' cy='62' r='3.4' fill='#1c1917' stroke='none'/>
        <circle cx='68' cy='62' r='3.4' fill='#1c1917' stroke='none'/>
        <path d='M52 74 Q60 83 68 74' fill='none'/>
        <circle cx='46' cy='72' r='3.6' fill='#fb7185' stroke='none' opacity='.75'/>
        <circle cx='74' cy='72' r='3.6' fill='#fb7185' stroke='none' opacity='.75'/>
    </g>
</svg>;

const INK = <svg className='ld-line' width='132' height='10' viewBox='0 0 132 10' aria-hidden='true' focusable='false'>
    <path pathLength='100' d='M2 5 C 14 2, 24 8, 36 5 S 58 2, 70 5 S 92 8, 104 5 S 124 3, 130 5'/>
</svg>;

export interface LoadingProps {
    /** page: the content area inside the app frame. boot: first open, no frame yet — logo + the same block, centred. */
    variant?: 'page' | 'boot';
    className?: string;
}

/**
 * THE loading of the whole app (SPT-139): a pencil writing one stroke + "Đang tải…". Replaces the old
 * per-screen skeletons. Shown only after 300ms; after 8s the sentence changes.
 * prefers-reduced-motion is handled in CSS (still picture).
 */
export default function Loading({variant = 'page', className}: LoadingProps) {
    const shown = useAfter(LOADING_DELAY_MS);
    const slow = useAfter(LOADING_SLOW_MS);
    const block = <div className={cx('ld', variant === 'page' && 'ld--page', className)} role='status' aria-live='polite'>
        {shown && <>
            <div className='ld-art' aria-hidden='true'>{INK}{PEN}</div>
            <p className='ld-text'>{slow ? 'Mạng hơi chậm, chờ thêm chút nhé…' : 'Đang tải…'}</p>
        </>}
    </div>;
    if (variant === 'page') return block;
    return <div className='vt-paper ld-boot'>
        {shown && <span className='vt-logo' aria-hidden='true'>viettestpro</span>}
        {block}
    </div>;
}
