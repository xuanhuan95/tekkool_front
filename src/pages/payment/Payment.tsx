import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';

import {Button, ErrorState, IconButton, Skeleton, StatusBadge, WaveLine, icons} from '../../components/ui';
import Api from '../../services/api';
import {usePackages} from '../../queries/payment';
import {useWallet} from '../../queries/wallet';
import type {CheckoutForm} from '../../types/payment';
import {errorText, formatMoney} from '../../lib/format';
import '../pay/pay.css';

/**
 * "Xác nhận thanh toán" (HS-ThanhToan). Route /payment/:packageId — unchanged.
 *
 * The checkout flow is the old one, untouched: POST payment/checkout {package_id} (the BE sets
 * the price), then POST a hidden form to SePay with the fields IN THE ORDER the BE returned
 * (order = signature). SePay sends the student back to /payment/result?inv=… (BE config).
 */
export default function Payment() {
    const {packageId} = useParams();
    const navigate = useNavigate();
    const {data: packages, error: loadError, refetch, isFetching} = usePackages();
    const {data: wallet} = useWallet();
    const [error, setError] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);

    const pkg = (packages || []).find(p => p.id === packageId);

    const pay = async () => {
        if (redirecting) return;
        setRedirecting(true);
        setError(null);

        let res: CheckoutForm;
        try {
            res = await Api.post<CheckoutForm>('payment/checkout', {package_id: packageId});
        } catch (e) {
            setRedirecting(false);
            setError(errorText(e, 'Không tạo được đơn thanh toán'));
            return;
        }

        // SePay requires a POST form, not a GET redirect -> hidden form + submit().
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.action_url;
        // fields is [[key, value]]: field order determines the signature — never sort it.
        res.fields.forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    };

    // Wallet may not be a valid object (still loading / failed) — then just skip the "after" line.
    const after = pkg && wallet && typeof wallet.remaining === 'number' ? wallet.remaining + pkg.turns : null;

    let body;
    if (loadError) {
        body = <ErrorState title='Không tải được thông tin gói' description={errorText(loadError, 'Kiểm tra mạng rồi thử lại.')}
                           onRetry={() => refetch()} retrying={isFetching}/>;
    } else if (!packages) {
        body = <div className='vt-card vt-pay-stack' aria-busy='true' role='status' aria-label='Đang tải gói'>
            <Skeleton width='60%' height={26}/><Skeleton height={14}/><Skeleton height={14}/><Skeleton width='40%' height={30}/>
        </div>;
    } else if (!pkg) {
        body = <ErrorState title='Không tìm thấy gói này' description='Gói có thể đã ngừng bán. Chọn một gói khác nhé.'/>;
    } else {
        body = <>
            <section className='vt-card vt-pay-sum' aria-label='Đơn hàng'>
                <div className='vt-pay-sum-head'>
                    <span className='vt-pay-sum-name'>{pkg.name}</span>
                    {pkg.featured && <StatusBadge status='popular'/>}
                </div>
                <div className='vt-pay-row'><span>Số lượt</span><b className='vt-num'>+{pkg.turns} lượt</b></div>
                <div className='vt-pay-row'><span>Giá gói</span><b className='vt-num'>{formatMoney(pkg.price)}</b></div>
                <div className='vt-pay-total'><span>Tổng cộng</span><b>{formatMoney(pkg.price)}</b></div>
            </section>

            <section className='vt-card vt-card--md vt-pay-method'>
                <span className='vt-pay-method-ic' aria-hidden='true'>
                    <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z'/><path d='M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3'/>
                    </svg>
                </span>
                <div>
                    <b>Chuyển khoản hoặc quét mã QR</b>
                    <p className='vt-muted'>Mở ứng dụng ngân hàng, quét mã QR hoặc chuyển khoản theo nội dung hiển thị.</p>
                </div>
            </section>

            <p role='note' className='vt-muted vt-pay-note'>
                Lượt được cộng tự động sau khi thanh toán thành công.
                {after !== null && <> Sau thanh toán bạn sẽ có <b className='vt-pay-ink'>{after} lượt</b>.</>}
            </p>

            {error && <ErrorState title='Chưa tạo được đơn' description={error}/>}
        </>;
    }

    return <div className='vt-paper vt-shell vt-pay-full'>
        <header className='vt-pay-bar'>
            <div className='vt-pay-bar-row'>
                <IconButton variant='outline' tipBelow to='/packages' label='Quay lại chọn gói' icon={<icons.IconBack/>}/>
                <span className='vt-pay-bar-title'>Thanh toán</span>
            </div>
            <WaveLine variant='mobile'/>
        </header>
        <main className='vt-pay-main'>
            <h1 className='vt-page-title'>Xác nhận thanh toán</h1>
            {body}
        </main>
        {pkg && <footer className='vt-pay-foot'>
            <Button variant='primary' block loading={redirecting} loadingText='Đang chuyển sang trang thanh toán…' onClick={pay}>
                Thanh toán {formatMoney(pkg.price)}
            </Button>
            <Button variant='secondary' block disabled={redirecting} onClick={() => navigate('/packages')}>Huỷ</Button>
        </footer>}
    </div>;
}
