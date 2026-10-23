import {IconCrown} from './icons';
import {cx} from './cx';

/** Same keys as BE core_title.py; unknown keys fall back to the newbie look. */
export type TitleTier = 'newbie' | 'diligent' | 'warrior' | 'conqueror';

/**
 * One light colour per tier, all from the palette (SPT-64, PM 23/10):
 * newbie track/draft · diligent action blue · warrior sun soft · conqueror title purple.
 */
export const TITLE_TONE: Record<TitleTier, string> = {
    newbie: 'vt-titlechip--newbie',
    diligent: 'vt-titlechip--diligent',
    warrior: 'vt-titlechip--warrior',
    conqueror: 'vt-titlechip--conqueror',
};

export interface TitleChipProps {
    title: {key: string; name: string};
    /** Crown icon before the name (default on). */
    icon?: boolean;
    className?: string;
}

/** Student title chip ("Học sinh chăm"): small-chip radius, 12px 600, tier colour. */
export default function TitleChip({title, icon = true, className}: TitleChipProps) {
    const tone = TITLE_TONE[title.key as TitleTier] || TITLE_TONE.newbie;
    return <span className={cx('vt-badge', 'vt-titlechip', tone, className)} data-tier={title.key}>
        {icon && <IconCrown size={12} color='currentColor'/>}{title.name}
    </span>;
}
