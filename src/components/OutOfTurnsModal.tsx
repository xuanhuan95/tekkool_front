import {useNavigate} from 'react-router-dom';
import '../pages/pay/pay.css';

import {Button, Modal, icons} from './ui';

/**
 * Blocking dialog when a student has no turns left (HS-HetLuot). Shown by any screen that gets
 * 402 from a turn-consuming API — blocks IN PLACE instead of redirecting, so the student does not
 * lose their place. "Để sau" closes (or goes home when the caller gives no onClose);
 * "Xem gói thi" opens /packages with the "hết lượt" banner.
 */
export default function OutOfTurnsModal({open, onClose}: {open?: boolean; onClose?: () => void}) {
    const navigate = useNavigate();
    const later = onClose || (() => navigate('/'));
    return <Modal open={!!open} onClose={later} title='Bạn đã hết lượt thi' className='vt-out'
                  footer={<>
                      <Button variant='secondary' onClick={later}>Để sau</Button>
                      <Button variant='primary' onClick={() => navigate('/packages?het-luot=1')}>Xem gói thi</Button>
                  </>}>
        <div className='vt-out-body'>
            <span className='vt-out-icon' aria-hidden='true'><icons.IconTicket size={28}/></span>
            <p>Mua thêm gói để tiếp tục. Lượt không hết hạn.</p>
        </div>
    </Modal>;
}
