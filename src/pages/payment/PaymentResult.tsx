import {useEffect, useRef, useState} from 'react';
import Loading from '../../components/Loading';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Button, Header, Icon, Message, Progress, Segment} from 'semantic-ui-react';

import Api from "../../services/api";
import type {Payment} from "../../types/payment";

// The bank reports back via IPN, usually 10–60 seconds after the scan. Poll for 90
// seconds before giving up — the old version stopped at 31, just when most
// transactions had not arrived yet.
const TOTAL_SECONDS = 90;

export default function PaymentResult() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inv = searchParams.get('inv');

    const [payment, setPayment] = useState<Payment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [seconds, setSeconds] = useState(0);      // how long we have waited
    const [timedOut, setTimedOut] = useState(false);
    const startedAt = useRef(Date.now());

    useEffect(() => {
        if (!inv) { setError('Thiếu mã đơn hàng'); return; }

        // ponytail: cancelled blocks setState after leaving the page — this await loop
        // does not stop on unmount like setInterval does, so we must guard it ourselves.
        let cancelled = false;

        // The clock runs separately from the polling loop: the customer must see the number
        // tick every second, otherwise the screen looks frozen and they close the tab.
        let clock = setInterval(() => {
            if (!cancelled) setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
        }, 1000);

        (async () => {
            // Poll every 2 seconds instead of doubling each time: a growing interval makes
            // the last wait up to 16 seconds and the customer thinks it is broken.
            while (!cancelled && (Date.now() - startedAt.current) / 1000 < TOTAL_SECONDS) {
                let res;
                try {
                    res = await Api.get('payment/status/' + inv);
                } catch (e: any) {
                    if (!cancelled) setError(e.error || e.message || 'Không tra cứu được đơn hàng');
                    return;
                }

                if (cancelled) return;
                setPayment(res);
                if (res.status !== 'PENDING') return;

                await new Promise(r => setTimeout(r, 2000));
            }
            if (!cancelled) setTimedOut(true);
        })();

        return () => { cancelled = true; clearInterval(clock); };
    }, [inv]);

    const isPaid = payment && payment.status === 'PAID';
    // No response yet also counts as waiting — never leave a blank page.
    const waiting = !error && (!payment || payment.status === 'PENDING');

    return <div className='tk-pay-result'>
        <Segment padded='very' textAlign='center'>
            {/* A lookup error with no way out strands the customer here — money already
                sent and nowhere to go. Always include the order code + a link
                to the payment history. */}
            {error && <div>
                <Icon name='exclamation triangle' color='red' size='huge'/>
                <Header as='h2'>
                    Không tra cứu được đơn
                    <Header.Subheader>
                        Đơn vẫn được ghi nhận. Nếu đã trừ tiền thì lượt sẽ về,
                        xem lại ở Thanh toán của tôi.
                    </Header.Subheader>
                </Header>
                <Message negative className='tk-pay-warn'>{error}</Message>
                <Button primary onClick={() => window.location.reload()}>
                    <Icon name='refresh'/> Thử lại
                </Button>
                <Button basic onClick={() => navigate('/billing')}>
                    Thanh toán của tôi
                </Button>
                <div className='text-muted tk-pay-inv'>Mã đơn: {inv}</div>
            </div>}

            {waiting && !timedOut && <div>
                {/* <Loading/> has its own size. The old `.tk-pay-spin` anchor block
                    (height:60px) was for the position:absolute Semantic Loader —
                    keeping it would CLIP the bottom of the 72px image + the text. */}
                <Loading size={72}/>

                <Header as='h2'>
                    Đang chờ ngân hàng xác nhận
                    <Header.Subheader>
                        Đã chuyển khoản rồi thì cứ để yên trang này — tiền về là
                        vào bài được ngay.
                    </Header.Subheader>
                </Header>

                {/* Progress bar so the customer knows the system is working, not frozen.
                    Without it 60 seconds of silence is enough to make people close the tab. */}
                <Progress percent={Math.min(100, Math.round(seconds / TOTAL_SECONDS * 100))}
                          size='small' color='blue' className='tk-pay-bar'/>
                <div className='text-muted'>Đã chờ {seconds} giây</div>

                <Message warning className='tk-pay-warn'>
                    <Icon name='warning sign'/>
                    Đừng đóng trang này. Đóng rồi thì vào lại{' '}
                    <b>Thanh toán của tôi</b> để xem đơn.
                </Message>
            </div>}

            {isPaid && <div>
                <Icon name='check circle' color='green' size='huge'/>
                <Header as='h2'>
                    Thanh toán thành công
                    <Header.Subheader>
                        Lượt thi đã được cộng vào tài khoản, chọn đề là làm được ngay.
                    </Header.Subheader>
                </Header>
                {/* After buying a package there is no EXAM to jump straight into — a package
                    works for every exam. Go to the exam picker instead of guessing one. */}
                <Button primary size='large' onClick={() => navigate('/')}>
                    <Icon name='play'/> Chọn đề để làm
                </Button>
            </div>}

            {/* 90 seconds up and nothing back: do NOT conclude failure — the money may
                already be charged, IPN is just slow. State the real situation and offer a way to re-check. */}
            {waiting && timedOut && <div>
                <Icon name='clock outline' color='yellow' size='huge'/>
                <Header as='h2'>
                    Ngân hàng chưa báo về
                    <Header.Subheader>
                        Nếu đã trừ tiền thì đơn vẫn đang chạy, thường về trong vài
                        phút. Chưa trừ tiền thì quét lại mã là được.
                    </Header.Subheader>
                </Header>
                <Button primary onClick={() => window.location.reload()}>
                    <Icon name='refresh'/> Kiểm tra lại
                </Button>
                <Button basic onClick={() => navigate('/billing')}>
                    Xem đơn của tôi
                </Button>
                <div className='text-muted tk-pay-inv'>Mã đơn: {inv}</div>
            </div>}

            {payment && !isPaid && payment.status !== 'PENDING' && <div>
                <Icon name='times circle' color='red' size='huge'/>
                <Header as='h2'>
                    Thanh toán không thành công
                    <Header.Subheader>Chưa trừ tiền. Thử lại được.</Header.Subheader>
                </Header>
                <Button primary onClick={() => navigate('/packages')}>
                    <Icon name='redo'/> Chọn gói và thử lại
                </Button>
                <div className='text-muted tk-pay-inv'>Mã đơn: {inv}</div>
            </div>}
        </Segment>
    </div>
}
