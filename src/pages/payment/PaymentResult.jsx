import React, {useEffect, useRef, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Button, Header, Icon, Loader, Message, Progress, Segment} from 'semantic-ui-react';

import Api from "../../services/api";

// Ngân hàng báo về qua IPN, thường 10–60 giây sau khi quét. Hỏi 90 giây rồi
// mới buông — bản cũ dừng ở 31 giây, đúng lúc phần lớn giao dịch chưa về.
const TONG_GIAY = 90;

export default function PaymentResult() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inv = searchParams.get('inv');

    const [payment, setPayment] = useState(null);
    const [error, setError] = useState(null);
    const [giay, setGiay] = useState(0);      // đã chờ bao lâu
    const [hetGio, setHetGio] = useState(false);
    const batDau = useRef(Date.now());

    useEffect(() => {
        if (!inv) return setError('Thiếu mã đơn hàng');

        // ponytail: cancelled chặn setState sau khi rời trang — vòng lặp await
        // này không dừng lại theo unmount như setInterval, phải tự chặn.
        let cancelled = false;

        // Đồng hồ chạy riêng với vòng hỏi: khách phải thấy số nhích mỗi giây,
        // không thì màn hình trông như treo và họ đóng tab.
        let dongHo = setInterval(() => {
            if (!cancelled) setGiay(Math.round((Date.now() - batDau.current) / 1000));
        }, 1000);

        (async () => {
            // Hỏi đều 2 giây thay vì gấp đôi mỗi lần: khoảng cách giãn dần làm
            // lần chờ cuối dài tới 16 giây, khách tưởng hỏng.
            while (!cancelled && (Date.now() - batDau.current) / 1000 < TONG_GIAY) {
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

                await new Promise(r => setTimeout(r, 2000));
            }
            if (!cancelled) setHetGio(true);
        })();

        return () => { cancelled = true; clearInterval(dongHo); };
    }, [inv]);

    const examUrl = payment && payment.exam_id ? '/do-exam/' + payment.exam_id : '/';
    const isPaid = payment && payment.status === 'PAID';
    // Chưa có phản hồi lần nào cũng là đang chờ — không để trang trắng.
    const dangCho = !error && (!payment || payment.status === 'PENDING');

    return <div className='tk-pay-result'>
        <Segment padded='very' textAlign='center'>
            {error && <Message negative>{error}</Message>}

            {dangCho && !hetGio && <div>
                {/* Loader phải nằm TRONG một khối có kích thước. Bản cũ trả
                    <Loader active> trần giữa trang rỗng: Semantic đặt nó
                    position:absolute, không có gì neo -> màn hình trắng trơn,
                    đúng cái khách thấy sau khi quét QR xong. */}
                <div className='tk-pay-spin'>
                    <Loader active inline='centered' size='large'/>
                </div>

                <Header as='h2'>
                    Đang chờ ngân hàng xác nhận
                    <Header.Subheader>
                        Đã chuyển khoản rồi thì cứ để yên trang này — tiền về là
                        vào bài được ngay.
                    </Header.Subheader>
                </Header>

                {/* Thanh chạy để khách biết máy đang làm việc chứ không treo.
                    Không có nó thì 60 giây im lặng đủ để người ta đóng tab. */}
                <Progress percent={Math.min(100, Math.round(giay / TONG_GIAY * 100))}
                          size='small' color='blue' className='tk-pay-bar'/>
                <div className='text-muted'>Đã chờ {giay} giây</div>

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
                    <Header.Subheader>Đã mở khoá đề, vào làm được ngay.</Header.Subheader>
                </Header>
                <Button primary size='large' onClick={() => navigate(examUrl)}>
                    <Icon name='play'/> Vào làm bài
                </Button>
            </div>}

            {/* Hết 90 giây mà chưa về: KHÔNG kết luận thất bại — tiền có thể đã
                trừ, chỉ là IPN chậm. Nói đúng tình trạng và cho lối tra lại. */}
            {dangCho && hetGio && <div>
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
                <Button primary onClick={() => navigate('/payment/' + payment.exam_id)}>
                    <Icon name='redo'/> Thử lại
                </Button>
                <div className='text-muted tk-pay-inv'>Mã đơn: {inv}</div>
            </div>}
        </Segment>
    </div>
}
