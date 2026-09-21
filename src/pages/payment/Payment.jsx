import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Segment, Icon, Loader, Message} from 'semantic-ui-react';

import Api from "../../services/api";
import renderHTML from '../../components/SafeHtml';


export default function Payment() {
    const {examId} = useParams();
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [error, setError] = useState(null);
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        // exam/fetch chi tra metadata (ten, gia), khong kem cau hoi/dap an
        Api.get('exam/fetch/' + examId)
            .then(setExam)
            .catch(e => setError(e.error || e.message || 'Không tải được thông tin đề'));
    }, [examId]);

    const pay = async () => {
        setRedirecting(true);
        setError(null);

        let res;
        try {
            res = await Api.post('payment/checkout', {exam_id: examId});
        } catch (e) {
            setRedirecting(false);
            return setError(e.error || e.message || 'Không tạo được đơn thanh toán');
        }

        if (res.already_paid) {
            return navigate('/do-exam/' + examId);
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

    if (!exam && !error) return <Loader active/>;

    return <div style={{width: '480px', margin: '3em auto'}}>
        <h2 className='text-center'>Thanh toán đề thi</h2>

        <Segment className='text-center'>
            {error && <Message negative>{error}</Message>}

            {exam && <div>
                <h3>{renderHTML(exam.name || 'Đề thi')}</h3>
                <p style={{fontSize: '1.6em', margin: '1em 0'}}>
                    <b>{(exam.price || 0).toLocaleString('vi-VN')} đ</b>
                </p>

                <Button primary fluid loading={redirecting} disabled={redirecting} onClick={pay}>
                    <Icon name='credit card'/> Thanh toán
                </Button>
            </div>}
        </Segment>
    </div>
}
