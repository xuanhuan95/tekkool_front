import type {ReactNode} from 'react';

import {StatusBadge} from '../../components/ui';
import type {Package} from '../../types/payment';
import {formatMoney, groupDigits, pricePerTurn} from './format';

/**
 * One package as the student sees it (HS-Goi). Also the Admin "Xem trước — học sinh sẽ thấy"
 * preview (AD-Goi), so the two can never drift apart.
 */
export default function PackageCard({pkg, action, note}: {
    pkg: Pick<Package, 'name' | 'turns' | 'price' | 'description' | 'featured'>;
    /** The "Chọn gói" button/link. */
    action?: ReactNode;
    /** Extra muted line under the price ("không hết hạn" in the Admin preview). */
    note?: ReactNode;
}) {
    const per = pricePerTurn(pkg.price, pkg.turns);
    return <article className='vt-card vt-pay-pkg'>
        {pkg.featured && <div><StatusBadge status='popular'/></div>}
        <div className='vt-pay-pkg-top'>
            <span className='vt-pay-pkg-turns'>{pkg.turns} lượt</span>
            <span className='vt-pay-pkg-price'>{formatMoney(pkg.price)}</span>
        </div>
        <div className='vt-pay-pkg-sub'>
            <span>{pkg.name}</span>
            {per !== null && <span className='vt-num'>≈ {groupDigits(per)}đ / lượt{note}</span>}
        </div>
        {pkg.description && <p className='vt-pay-pkg-desc'>{pkg.description}</p>}
        {action}
    </article>;
}
