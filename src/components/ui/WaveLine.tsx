import {cx} from './cx';

export interface WaveLineProps {
    /** mobile: fixed 350×8 path. web: full width 10px, stroke kept 1.8px when stretched. */
    variant?: 'mobile' | 'web';
    className?: string;
}

/** The hand-drawn wavy rule under headers. Paths copied from design-system.md §3 (not a repeating pattern). */
export default function WaveLine({variant = 'web', className}: WaveLineProps) {
    if (variant === 'mobile') {
        return <svg className={cx('vt-wave', className)} width='350' height='8' viewBox='0 0 350 8'
                    preserveAspectRatio='none' aria-hidden='true' focusable='false' style={{width: '100%'}}>
            <path d='M1 4 C 30 2, 58 6, 98 4 S 162 2, 204 5 S 272 6, 312 3 S 340 4, 349 4' fill='none'
                  stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' vectorEffect='non-scaling-stroke'/>
        </svg>;
    }
    return <svg className={cx('vt-wave', className)} width='100%' height='10' viewBox='0 0 1280 10'
                preserveAspectRatio='none' aria-hidden='true' focusable='false'>
        <path d='M1 5 C 60 3, 120 7, 200 5 S 330 3, 410 6 S 540 7, 620 4 S 760 3, 840 6 S 980 7, 1060 4 S 1200 5, 1279 5'
              fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' vectorEffect='non-scaling-stroke'/>
    </svg>;
}
