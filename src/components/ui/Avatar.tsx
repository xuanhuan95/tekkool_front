import {Link} from 'react-router-dom';

import {cx} from './cx';

/**
 * Initials from a Vietnamese name: the last two words (middle + given name), since the
 * family name comes first. "Nguyễn Minh Anh" → "MA", "Cô Thu Hà" → "TH", "Bảo" → "B".
 */
export function initialsOf(name?: string | null): string {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    return words.slice(-2).map(w => w.charAt(0).toLocaleUpperCase('vi')).join('');
}

export interface AvatarProps {
    name?: string | null;
    /** Override the computed initials ("QT" for "Quản trị viên"). */
    initials?: string;
    size?: 36 | 40;
    /** Link to the account page; label becomes "Tài khoản của <name>". */
    to?: string;
    className?: string;
}

/** Round avatar, ink border, purple-soft fill, 1–2 letters. Decorative unless it is a link. */
export default function Avatar({name, initials, size = 40, to, className}: AvatarProps) {
    const text = initials || initialsOf(name);
    const cls = cx('vt-avatar', size === 36 && 'vt-avatar--36', className);
    return to
        ? <Link to={to} className={cls} aria-label={'Tài khoản của ' + (name || 'bạn')}>
            <span aria-hidden='true'>{text}</span></Link>
        : <span className={cls} aria-hidden='true' title={name || undefined}>{text}</span>;
}

/** Rank circle 32px: 1 gold, 2 silver, 3 bronze; others plain. */
export function Medal({rank}: {rank: number}) {
    return <span role='img' className={cx('vt-medal', rank >= 1 && rank <= 3 && 'vt-medal--' + rank)}
                 aria-label={'Hạng ' + rank}>{rank}</span>;
}
