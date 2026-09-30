import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button, Card, Header, Icon, Modal} from 'semantic-ui-react';

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
            <Header icon textAlign='center'>
                <Icon name='hourglass end' color='orange'/>
                Bạn đã hết lượt thi
                <Header.Subheader>
                    Mỗi lần bắt đầu vào thi trừ 1 lượt. Mua thêm gói để làm tiếp đề này.
                </Header.Subheader>
            </Header>

            {/* Gói hiện ngay trong popup: thấy giá rồi mới quyết, không phải
                bấm sang trang khác mới biết mua bao nhiêu tiền. */}
            {goi === null
                ? null
                : !goi.length
                    ? <p className='text-center' style={{color: '#888'}}>
                        Chưa có gói nào đang bán — liên hệ giáo viên của bạn.
                    </p>
                    : <Card.Group itemsPerRow={goi.length >= 3 ? 3 : goi.length} stackable>
                        {goi.map(p =>
                            <Card key={p.id} link onClick={() => navigate('/payment/' + p.id)}>
                                <Card.Content textAlign='center'>
                                    <Card.Header>{p.name}</Card.Header>
                                    <Card.Meta>{p.turns} lượt</Card.Meta>
                                    <div style={{fontSize: '1.3em', marginTop: '.4em'}}>
                                        <b>{tien(p.price)}</b>
                                    </div>
                                    <div style={{color: '#888', fontSize: '.85em'}}>
                                        {tien(Math.round(p.price / p.turns))} mỗi lượt
                                    </div>
                                </Card.Content>
                            </Card>)}
                    </Card.Group>}
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
