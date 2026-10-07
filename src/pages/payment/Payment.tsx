import {useEffect, useState} from 'react';
import Loading from '../../components/Loading';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Segment, Icon, Message} from 'semantic-ui-react';

import Api from "../../services/api";
import type {Package, CheckoutForm} from "../../types/payment";

const formatVnd = (n?: number) => (n || 0).toLocaleString('vi-VN') + ' đ';

/**
 * Confirmation page for buying a PACKAGE of exam turns.
 *
 * ponytail: this used to be a per-EXAM purchase page. Price now lives on the
 * package, not the exam, so the same page just changes what is sold — no new page.
 */
export default function Payment() {
    const {packageId} = useParams();
    const navigate = useNavigate();

    const [pkg, setPkg] = useState<Package | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        // There is no endpoint to read a single package — the package list is short,
        // so filtering on the FE is cheaper than a new route.
        Api.get('package/list')
            .then((packages: Package[]) => {
                const found = (packages || []).find(p => p.id === packageId);
                if (!found) { setError('Không tìm thấy gói này'); return; }
                setPkg(found);
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

        // ponytail: SePay requires a POST form, not a GET redirect -> use a hidden
        // form and submit() it. No shorter way that still follows the standard.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.action_url;

        // ponytail: fields is an array of [[key, value]] — field order determines the
        // signature; an object would be re-sorted alphabetically by Flask.
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

    // <Loading/> has its own size, no anchor needed like the old Semantic
    // Loader (position:absolute -> returning it centred on an empty page gives a blank page).
    if (!pkg && !error) return <div className='tk-pay-result'>
        <Loading/>
    </div>;

    return <div className='tk-pay-result'>
        <Segment padded='very'>
            <h2 className='text-center tk-out-title'>Xác nhận mua gói</h2>

            {error && <Message negative>
                {error}
                <div className='margin-top'>
                    <Button basic size='small' onClick={() => navigate('/packages')}>
                        Chọn gói khác
                    </Button>
                </div>
            </Message>}

            {pkg && <div>
                <div className='tk-pay-sum'>
                    <span className='k'>Gói</span>
                    <span className='v'>{pkg.name}</span>
                </div>
                <div className='tk-pay-sum'>
                    <span className='k'>Số lượt thi</span>
                    <span className='v'>{pkg.turns} lượt</span>
                </div>
                <div className='tk-pay-sum total'>
                    <span className='k'>Thành tiền</span>
                    <span className='v'>{formatVnd(pkg.price)}</span>
                </div>

                {pkg.description && <p className='tk-pkg-desc'>{pkg.description}</p>}

                <Button primary fluid size='large' className='margin-top'
                        loading={redirecting} disabled={redirecting} onClick={pay}>
                    <Icon name='credit card'/> Thanh toán
                </Button>
                {/* Way out: if the wrong package was opened, the user must be able to go back,
                    not just face a pay button. */}
                <Button basic fluid className='margin-top'
                        disabled={redirecting} onClick={() => navigate('/packages')}>
                    Chọn gói khác
                </Button>
            </div>}
        </Segment>
    </div>
}
