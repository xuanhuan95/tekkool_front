import {Link, useNavigate, useSearchParams} from 'react-router-dom';

import {Button, ProgressBar, WaveLine, buttonClass} from '../../components/ui';
import {POLL_TOTAL_SECONDS, usePaymentStatus} from '../../queries/payment';
import {useWallet} from '../../queries/wallet';
import type {Payment} from '../../types/payment';
import {errorText, formatMoney} from '../../lib/format';
import {orderName, orderTurns} from '../pay/order';
import '../pay/pay.css';

const RefreshIcon = () => <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2'
                               strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    <path d='M20 12a8 8 0 1 1-2.3-5.7'/><path d='M20 4v5h-5'/></svg>;

/** Order code + package box shown on the waiting/timed-out states. */
function OrderBox({inv, payment}: {inv: string | null; payment: Payment | null}) {
    return <div className='vt-pay-orderbox'>
        <div><span className='vt-muted'>Mã đơn</span><b className='vt-num'>{inv || '—'}</b></div>
        {payment && <div><span className='vt-muted'>Gói</span>
            <span>{orderName(payment)}{payment.amount ? ' · ' + formatMoney(payment.amount) : ''}</span></div>}
    </div>;
}

/**
 * SePay return page: waiting (HS-ThanhToanCho) → success / failure (HS-ThanhToanXong).
 * Route /payment/result?inv=… is what the BE gives SePay as success/error/cancel URL — DO NOT move it.
 * Polling is the old behaviour (every 2 s, up to 90 s); see usePaymentStatus.
 */
export default function PaymentResult() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const inv = params.get('inv');
    const {payment, error, seconds, timedOut, restart} = usePaymentStatus(inv);
    const paid = payment?.status === 'PAID';
    const {data: wallet} = useWallet(paid);

    const waiting = !error && (!payment || payment.status === 'PENDING');
    const failed = !error && payment && payment.status !== 'PENDING' && !paid;
    const turns = payment ? orderTurns(payment) : null;
    const packageId = payment?.items?.[0]?.target_id;

    let card;
    if (error) {
        // Money may already be gone: never strand the student. Always show the order code + history.
        card = <section role='alert' className='vt-card vt-card--error vt-pay-state'>
            <span className='vt-pay-ring vt-pay-ring--err' aria-hidden='true'>!</span>
            <h1 className='vt-pay-state-title'>Không tra cứu được đơn</h1>
            <p className='vt-muted'>{errorText(error, 'Mất kết nối tới máy chủ.')} Đơn vẫn được ghi nhận — nếu đã trừ tiền,
                lượt sẽ được cộng; xem lại ở Lịch sử mua gói.</p>
            <OrderBox inv={inv} payment={payment}/>
            <div className='vt-pay-2btn'>
                <Button variant='primary' onClick={restart} icon={<RefreshIcon/>}>Thử lại</Button>
                <Link to='/billing' className={buttonClass()}>Lịch sử mua gói</Link>
            </div>
        </section>;
    } else if (paid) {
        card = <section role='status' className='vt-card vt-pay-state'>
            <span className='vt-pay-ring vt-pay-ring--ok' aria-hidden='true'>
                <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6'
                     strokeLinecap='round' strokeLinejoin='round'><path d='M5 12.5l4.5 4.5L19 7'/></svg>
            </span>
            <h1 className='vt-pay-state-title'>{turns !== null ? `Đã cộng ${turns} lượt` : 'Đã cộng lượt'}</h1>
            <span className='vt-muted'>Thanh toán thành công · {orderName(payment!)} · {formatMoney(payment!.amount)}</span>
            {wallet && typeof wallet.remaining === 'number' &&
                <span className='vt-pay-have'>Bạn có {wallet.remaining} lượt</span>}
            <Link to='/exams' className={buttonClass({variant: 'primary', block: true})}>Làm đề ngay</Link>
        </section>;
    } else if (failed) {
        card = <section role='alert' className='vt-card vt-card--error vt-pay-state'>
            <span className='vt-pay-ring vt-pay-ring--err' aria-hidden='true'>
                <svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6'
                     strokeLinecap='round'><path d='M7 7l10 10M17 7L7 17'/></svg>
            </span>
            <h1 className='vt-pay-state-title'>Thanh toán chưa thành công</h1>
            <p className='vt-muted'>Giao dịch chưa hoàn tất trên SePay. Nếu tài khoản đã bị trừ tiền, hãy liên hệ hỗ trợ
                kèm mã đơn <b className='vt-pay-ink vt-num'>{inv}</b>.</p>
            <div className='vt-pay-2btn'>
                <Button variant='primary' onClick={() => navigate(packageId ? '/payment/' + packageId : '/packages')}>Thử lại</Button>
                <Link to='/packages' className={buttonClass()}>Chọn gói khác</Link>
            </div>
        </section>;
    } else if (waiting && timedOut) {
        // 90 s and nothing back: NOT a failure — the money may be charged, the IPN is just slow.
        card = <section role='status' className='vt-card vt-pay-state'>
            <span className='vt-pay-ring vt-pay-ring--sun' aria-hidden='true'>…</span>
            <h1 className='vt-pay-state-title'>Ngân hàng chưa báo về</h1>
            <p className='vt-muted'>Nếu đã trừ tiền thì đơn vẫn đang xử lý, thường xong trong vài phút — lượt sẽ tự cộng.
                Chưa trừ tiền thì bạn có thể thanh toán lại.</p>
            <OrderBox inv={inv} payment={payment}/>
        </section>;
    } else {
        card = <section role='status' aria-live='polite' className='vt-card vt-pay-state'>
            <span className='vt-pay-ring vt-pay-ring--sun' aria-hidden='true'>
                <svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'
                     strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M6 3h12M6 21h12'/>
                    <path d='M7.5 3v2.5c0 2.5 4.5 4.5 4.5 6.5s-4.5 4-4.5 6.5V21M16.5 3v2.5c0 2.5-4.5 4.5-4.5 6.5s4.5 4 4.5 6.5V21'/>
                    <path d='M9.5 19h5' stroke='var(--vt-sun)' strokeWidth='2.4'/>
                </svg>
            </span>
            <h1 className='vt-pay-state-title'>Đang xác nhận thanh toán…</h1>
            <p className='vt-muted'>Hệ thống đang kiểm tra với SePay. Thường mất dưới 1 phút. Đừng đóng trang này.</p>
            <ProgressBar value={Math.min(seconds, POLL_TOTAL_SECONDS)} max={POLL_TOTAL_SECONDS}
                         label={`Đã chờ ${seconds} giây`} className='vt-pay-wide'/>
            <span className='vt-muted vt-pay-small'>Đã chờ {seconds} giây</span>
            <OrderBox inv={inv} payment={payment}/>
        </section>;
    }

    return <div className='vt-paper vt-shell vt-pay-full'>
        <header className='vt-pay-bar'>
            <div className='vt-pay-bar-row'><span className='vt-logo'>viettestpro</span></div>
            <WaveLine variant='mobile'/>
        </header>
        <main className='vt-pay-main vt-pay-main--center'>
            {card}
            {waiting && !error && <>
                <Button variant='secondary' block onClick={restart} icon={<RefreshIcon/>}>Kiểm tra lại</Button>
                <Link to='/billing' className={buttonClass({variant: 'ghost'}) + ' vt-pay-center'}>Xem lịch sử mua gói</Link>
            </>}
        </main>
    </div>;
}
