import type {ReactNode} from 'react';

import {cx} from '../../components/ui';
import type {Package} from '../../types/payment';
import {formatMoney, groupDigits, pricePerTurn} from '../../lib/format';
import {Tick, TicketSticker, stickerOf, type PackageDeco} from './packageDeco';

/**
 * One package as the student sees it (HS-Goi). Also the Admin "Xem trước — học sinh sẽ thấy"
 * preview (AD-Goi), so the two can never drift apart. Without `deco` (Admin preview) it is
 * the first sticker and shows no comparison with other packages.
 */
export default function PackageCard({pkg, action, note, deco}: {
    pkg: Pick<Package, 'name' | 'turns' | 'price' | 'description' | 'featured'>;
    /** The "Chọn gói" button/link. */
    action?: ReactNode;
    /** Extra muted text after the per-turn price ("không hết hạn" in the Admin preview). */
    note?: ReactNode;
    deco?: PackageDeco;
}) {
    const per = pricePerTurn(pkg.price, pkg.turns);
    const sticker = stickerOf(deco?.rank || 0);
    const ratio = per !== null && deco?.maxPer ? per / deco.maxPer : null;
    const saved = ratio !== null ? Math.round((1 - ratio) * 100) : 0;
    const tape = pkg.featured ? 'Phổ biến' : deco?.cheapest ? 'Tiết kiệm nhất' : null;
    // One line = plain text; several lines = a list with ticks.
    const lines = (pkg.description || '').split('\n').map(s => s.trim()).filter(Boolean);
    return <article className={cx('vt-card pk-card', pkg.featured && 'pk-card--hot')} aria-label={'Gói ' + pkg.name}>
        {tape && <span className={cx('pk-tape', !pkg.featured && 'pk-tape--save')}>{tape}</span>}
        <TicketSticker {...sticker}/>
        <h2 className='pk-name'>{pkg.name}</h2>
        <div className='pk-turns'>{pkg.turns}<small>lượt</small></div>
        <div className='pk-price vt-num'>{formatMoney(pkg.price)}</div>
        {per !== null && <div className='pk-per'>
            <div className='pk-per-row'>
                <span><b className='vt-num'>{groupDigits(per)}đ</b> / lượt{note}</span>
                {ratio !== null && (saved > 0 ? <span className='pk-save'>Tiết kiệm {saved}%</span> : <span>giá gốc</span>)}
            </div>
            {ratio !== null && <div className='pk-bar' role='img' aria-label={`Giá mỗi lượt bằng ${Math.round(ratio * 100)}% gói ${deco!.baseName}`}>
                <i style={{width: Math.round(ratio * 100) + '%'}}/>
            </div>}
        </div>}
        {lines.length > 0 && <ul className='pk-list'>
            {lines.map((l, i) => <li key={i}>{lines.length > 1 && <Tick/>}<span>{l}</span></li>)}
        </ul>}
        {action}
    </article>;
}
