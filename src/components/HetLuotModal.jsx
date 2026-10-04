import React, {useEffect, useState} from 'react';
import Loading from './Loading';
import {useNavigate} from 'react-router-dom';
import {Button, Icon, Modal} from 'semantic-ui-react';

import Api from '../services/api';

const tien = (n) => (n || 0).toLocaleString('vi-VN') + ' đ';

/**
 * Popup chặn khi học sinh vào thi mà hết lượt.
 *
 * ponytail: dựng thành component chung vì chỗ nào gọi API tốn lượt cũng cần
 * đúng cái này — bắt 402 rồi `<HetLuotModal open .../>`, không mỗi màn tự chế
 * một kiểu chặn. Chặn TẠI CHỖ thay vì đẩy sang trang khác: học sinh bấm vào đề
 * là đang muốn làm đề đó, đá ra trang mua gói rồi quay lại là mất dấu.
 */
export default function HetLuotModal({open, onClose}) {
    const [goi, setGoi] = useState(null);
    const navigate = useNavigate();

    // Tải gói khi popup mở, không phải lúc mount: phần lớn lần vào thi là còn
    // lượt, popup không bật thì khỏi tốn một vòng mạng.
    useEffect(() => {
        if (!open || goi) return;
        Api.get('package/list').then(setGoi).catch(() => setGoi([]));
    }, [open, goi]);

    return <Modal open={!!open} size='tiny' onClose={onClose} closeIcon={!!onClose}>
        <Modal.Content>
            <div className='text-center'>
                <div className='tk-het-icon'>
                    <Icon name='ticket' size='big'/>
                </div>
                <h2 className='tk-het-title'>Bạn đã hết lượt thi</h2>
            </div>

            {/* Gói hiện ngay trong popup: thấy giá rồi mới quyết, không phải
                bấm sang trang khác mới biết mua bao nhiêu tiền. */}
            {goi === null
                ? <Loading/>
                : !goi.length
                    ? <p className='text-center text-muted'>
                        Chưa có gói nào đang bán — liên hệ giáo viên của bạn.
                    </p>
                    : <div className='tk-goi-list'>
                        {goi.map(p =>
                            <button key={p.id} type='button' className='tk-goi'
                                    onClick={() => navigate('/payment/' + p.id)}>
                                <div className='tk-goi-ten'>{p.name}</div>
                                <div className='tk-goi-luot'>{p.turns} lượt</div>
                                <div className='tk-goi-gia'>{tien(p.price)}</div>
                            </button>)}
                    </div>}
        </Modal.Content>
        <Modal.Actions>
            <Button basic onClick={() => navigate('/')}>
                <Icon name='arrow left'/> Về trang đề
            </Button>
            <Button primary onClick={() => navigate('/packages')}>
                <Icon name='cube'/> Xem tất cả gói
            </Button>
        </Modal.Actions>
    </Modal>;
}
