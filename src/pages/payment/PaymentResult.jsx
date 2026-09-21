import React, {useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Button, Segment, Icon, Loader, Message} from 'semantic-ui-react';

import Api from "../../services/api";


export default function PaymentResult() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inv = searchParams.get('inv');

    const [payment, setPayment] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!inv) return setError('Thiếu mã đơn hàng');

        // ponytail: cancelled chan setState sau khi roi trang — vong lap await
        // nay khong dung lai theo unmount nhu setInterval, phai tu chan.
        let cancelled = false;

        // ponytail: doi soat chay bat dong bo, luc khach quay ve co the chua xong.
        // Doi tu 1s, gap doi moi lan, toi da 5 lan (~31s) roi bao khach tu refresh.
        // Day la cach re nhat; muon realtime thi phai websocket, chua can.
        (async () => {
            let delay = 1000;
            for (let i = 0; i < 5; i++) {
                let res;
                try {
                    res = await Api.get('payment/status/' + inv);
                } catch (e) {
                    if (!cancelled) setError(e.error || e.message || 'Không tra cứu được đơn hàng');
                    return;
                }

                if (cancelled) return;
                setPayment(res);
                if (res.status !== 'PENDING') return;

                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
            }
        })();

        return () => { cancelled = true };
    }, [inv]);

    if (!payment && !error) return <Loader active>Đang xác nhận thanh toán...</Loader>;

    const examUrl = payment ? '/do-exam/' + payment.exam_id : '/';

    const isPaid = payment && payment.status === 'PAID';
    const isPending = payment && payment.status === 'PENDING';

    return <div style={{width: '480px', margin: '3em auto'}}>
        <Segment className='text-center'>
            {error && <Message negative>{error}</Message>}

            {isPaid && <div>
                <Icon name='check circle' color='green' size='huge'/>
                <h2>Thanh toán thành công</h2>
                <Button primary onClick={() => navigate(examUrl)}>
                    Vào làm bài
                </Button>
            </div>}

            {isPending && <div>
                <Icon name='clock outline' color='yellow' size='huge'/>
                <h2>Đang chờ xác nhận</h2>
                <p>Ngân hàng chưa báo về. Tải lại trang sau ít phút.</p>
                <Button onClick={() => window.location.reload()}>Tải lại</Button>
            </div>}

            {payment && !isPaid && !isPending && <div>
                <Icon name='times circle' color='red' size='huge'/>
                <h2>Thanh toán không thành công</h2>
                <Button onClick={() => navigate('/payment/' + payment.exam_id)}>
                    Thử lại
                </Button>
            </div>}
        </Segment>
    </div>
}
