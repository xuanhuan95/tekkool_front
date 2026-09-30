import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Segment, Icon, Loader, Message} from 'semantic-ui-react';

import Api from "../../services/api";

const tien = (n) => (n || 0).toLocaleString('vi-VN') + ' đ';

/**
 * Trang xác nhận mua một GÓI lượt thi.
 *
 * ponytail: trước đây là trang mua từng ĐỀ. Giờ giá nằm ở gói chứ không ở đề,
 * nên cùng một trang chỉ đổi thứ đem bán — không dựng trang mới.
 */
export default function Payment() {
    const {packageId} = useParams();
    const navigate = useNavigate();

    const [goi, setGoi] = useState(null);
    const [error, setError] = useState(null);
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        // Không có endpoint đọc một gói — danh sách gói ngắn, lọc ở FE rẻ hơn
        // một route mới.
        Api.get('package/list')
            .then(ds => {
                let g = (ds || []).find(p => p.id === packageId);
                if (!g) return setError('Không tìm thấy gói này');
                setGoi(g);
            })
            .catch(e => setError(e.error || e.message || 'Không tải được thông tin gói'));
    }, [packageId]);

    const pay = async () => {
        setRedirecting(true);
        setError(null);

        let res;
        try {
            res = await Api.post('payment/checkout', {package_id: packageId});
        } catch (e) {
            setRedirecting(false);
            return setError(e.error || e.message || 'Không tạo được đơn thanh toán');
        }

        // ponytail: SePay yeu cau POST form, khong phai redirect GET -> dung
        // form an roi submit(). Khong co cach nao ngan hon ma van dung chuan.
        let form = document.createElement('form');
        form.method = 'POST';
        form.action = res.action_url;

        // ponytail: fields la mang [[key, value]] — thu tu field quyet dinh chu ky,
        // object bi Flask sap xep lai theo alphabet.
        res.fields.forEach(([key, value]) => {
            let input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    };

    if (!goi && !error) return <Loader active/>;

    return <div style={{width: '480px', margin: '3em auto'}}>
        <h2 className='text-center'>Mua gói thi thử</h2>

        <Segment className='text-center'>
            {error && <Message negative>
                {error}
                <div className='margin-top'>
                    <Button basic size='small' onClick={() => navigate('/packages')}>
                        Chọn gói khác
                    </Button>
                </div>
            </Message>}

            {goi && <div>
                <h3>{goi.name}</h3>
                {goi.description && <p style={{color: '#666'}}>{goi.description}</p>}

                <p style={{fontSize: '1.3em', margin: '0.6em 0'}}>
                    <b>{goi.turns}</b> lượt thi thử
                </p>
                <p style={{fontSize: '1.6em', margin: '0.4em 0 1em'}}>
                    <b>{tien(goi.price)}</b>
                    <span style={{fontSize: '0.5em', color: '#888', display: 'block'}}>
                        {tien(Math.round(goi.price / goi.turns))} mỗi lượt
                    </span>
                </p>

                <Button primary fluid loading={redirecting} disabled={redirecting} onClick={pay}>
                    <Icon name='credit card'/> Thanh toán
                </Button>
            </div>}
        </Segment>
    </div>
}
