import {useEffect, useState} from 'react';
import Loading from '../../components/Loading';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Segment, Icon, Message} from 'semantic-ui-react';

import Api from "../../services/api";
import type {Package, CheckoutForm} from "../../types/payment";

const tien = (n?: number) => (n || 0).toLocaleString('vi-VN') + ' đ';

/**
 * Trang xác nhận mua một GÓI lượt thi.
 *
 * ponytail: trước đây là trang mua từng ĐỀ. Giờ giá nằm ở gói chứ không ở đề,
 * nên cùng một trang chỉ đổi thứ đem bán — không dựng trang mới.
 */
export default function Payment() {
    const {packageId} = useParams();
    const navigate = useNavigate();

    const [goi, setGoi] = useState<Package | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        // Không có endpoint đọc một gói — danh sách gói ngắn, lọc ở FE rẻ hơn
        // một route mới.
        Api.get('package/list')
            .then((ds: Package[]) => {
                const g = (ds || []).find(p => p.id === packageId);
                if (!g) { setError('Không tìm thấy gói này'); return; }
                setGoi(g);
            })
            .catch((e: any) => setError(e.error || e.message || 'Không tải được thông tin gói'));
    }, [packageId]);

    const pay = async () => {
        setRedirecting(true);
        setError(null);

        let res: CheckoutForm;
        try {
            res = await Api.post<CheckoutForm>('payment/checkout', {package_id: packageId});
        } catch (e: any) {
            setRedirecting(false);
            setError(e.error || e.message || 'Không tạo được đơn thanh toán');
            return;
        }

        // ponytail: SePay yeu cau POST form, khong phai redirect GET -> dung
        // form an roi submit(). Khong co cach nao ngan hon ma van dung chuan.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.action_url;

        // ponytail: fields la mang [[key, value]] — thu tu field quyet dinh chu ky,
        // object bi Flask sap xep lai theo alphabet.
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

    // <Loading/> tu co kich thuoc, khong can khoi neo nhu Loader cu cua
    // Semantic (position:absolute -> tra tran giua trang rong la trang tron).
    if (!goi && !error) return <div className='tk-pay-result'>
        <Loading/>
    </div>;

    return <div className='tk-pay-result'>
        <Segment padded='very'>
            <h2 className='text-center tk-het-title'>Xác nhận mua gói</h2>

            {error && <Message negative>
                {error}
                <div className='margin-top'>
                    <Button basic size='small' onClick={() => navigate('/packages')}>
                        Chọn gói khác
                    </Button>
                </div>
            </Message>}

            {goi && <div>
                <div className='tk-pay-sum'>
                    <span className='k'>Gói</span>
                    <span className='v'>{goi.name}</span>
                </div>
                <div className='tk-pay-sum'>
                    <span className='k'>Số lượt thi</span>
                    <span className='v'>{goi.turns} lượt</span>
                </div>
                <div className='tk-pay-sum total'>
                    <span className='k'>Thành tiền</span>
                    <span className='v'>{tien(goi.price)}</span>
                </div>

                {goi.description && <p className='tk-goi-mota'>{goi.description}</p>}

                <Button primary fluid size='large' className='margin-top'
                        loading={redirecting} disabled={redirecting} onClick={pay}>
                    <Icon name='credit card'/> Thanh toán
                </Button>
                {/* Loi ra: vao nham goi thi phai quay lai duoc, khong chi co
                    mot nut tra tien. */}
                <Button basic fluid className='margin-top'
                        disabled={redirecting} onClick={() => navigate('/packages')}>
                    Chọn gói khác
                </Button>
            </div>}
        </Segment>
    </div>
}
