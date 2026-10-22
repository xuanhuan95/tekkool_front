import {Link} from 'react-router-dom';

import {Badge, EmptyState, ErrorState, PageTitle, SkeletonCard, buttonClass, icons} from '../../components/ui';
import {usePaymentHistory} from '../../queries/payment';
import type {Payment} from '../../types/payment';
import {errorText, formatDateTime, formatMoney} from '../../lib/format';
import {orderName, orderStatus, orderTurns} from './order';
import './pay.css';

/** "Đã mua 3 gói · 25 lượt": PAID orders only; turns from the checkout snapshot (OrderItem.turns). */
export function purchaseSummary(orders: Payment[]): {count: number; turns: number; unknown: boolean} {
    const paid = orders.filter(o => o.status === 'PAID');
    let turns = 0, unknown = false;
    for (const o of paid) {
        const t = orderTurns(o);
        if (t === null) unknown = true; else turns += t;
    }
    return {count: paid.length, turns, unknown};
}

/**
 * "Lịch sử mua gói" (HS-LichSuMua). Route /billing (kept: the menu, the result page and old
 * links point there). Shows PENDING and FAILED too — a student who paid while the IPN is late
 * must SEE the order, or they think the money is lost.
 */
export default function PurchaseHistory() {
    const {data: orders, error, refetch, isFetching} = usePaymentHistory();
    const sum = orders ? purchaseSummary(orders) : null;

    return <div className='vt-paper vt-pay'>
        <Link to='/packages' className={buttonClass({variant: 'ghost'}) + ' vt-pay-back'}>
            <icons.IconBack size={16}/> Gói thi
        </Link>
        <div className='vt-pay-head-text'>
            <PageTitle>Lịch sử mua gói</PageTitle>
            {sum && sum.count > 0 && <span className='vt-muted'>
                Đã mua {sum.count} gói · {sum.turns} lượt{sum.unknown ? ' (chưa gồm đơn cũ)' : ''}
            </span>}
        </div>

        {error
            ? <ErrorState title='Không tải được lịch sử' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !orders
                ? <div className='vt-pay-list'><SkeletonCard label='Đang tải lịch sử'/></div>
                : !orders.length
                    ? <EmptyState title='Chưa mua gói nào' description='Mua gói để có lượt làm đề thi thử. Lượt không hết hạn.'
                                  action={<Link to='/packages' className={buttonClass({variant: 'primary'})}>Xem gói thi</Link>}/>
                    : <>
                        <ul className='vt-pay-list' aria-label='Đơn mua gói'>
                            {orders.map(o => {
                                const st = orderStatus(o.status);
                                const t = orderTurns(o);
                                return <li key={o.invoice_number} className='vt-card vt-card--md vt-pay-order'>
                                    <div className='vt-pay-order-top'>
                                        <b>{orderName(o)}</b>
                                        <Badge tone={st.tone}>{st.label}</Badge>
                                    </div>
                                    <div className='vt-pay-order-mid vt-num'>
                                        <span className='vt-muted'>{formatDateTime(o.created_at)}</span>
                                        <b>{formatMoney(o.amount)}</b>
                                    </div>
                                    <div className='vt-pay-order-mid vt-num vt-pay-small vt-muted'>
                                        <span>Mã đơn {o.invoice_number}</span>
                                        {t !== null && <span>{o.status === 'PAID' ? '+' : ''}{t} lượt</span>}
                                    </div>
                                </li>;
                            })}
                        </ul>
                        <span className='vt-muted vt-pay-small vt-pay-center'>Chỉ tính các đơn thành công.</span>
                    </>}
    </div>;
}
