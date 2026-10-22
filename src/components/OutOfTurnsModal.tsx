import {useEffect, useState} from 'react';
import Loading from './Loading';
import {useNavigate} from 'react-router-dom';
import {Button, Icon, Modal} from 'semantic-ui-react';

import Api from '../services/api';
import type {Package} from '../types/payment';

const formatPrice = (n?: number) => (n || 0).toLocaleString('vi-VN') + ' đ';

/**
 * Blocking popup when a student enters an exam with no turns left.
 *
 * ponytail: built as a shared component because anywhere that calls a
 * turn-consuming API needs exactly this — catch 402 then `<OutOfTurnsModal open .../>`,
 * instead of every screen rolling its own blocker. Blocks IN PLACE rather than
 * redirecting: a student who clicks an exam wants to take that exam, and kicking
 * them to the package page and back loses their place.
 */
export default function OutOfTurnsModal({open, onClose}: {open?: boolean; onClose?: () => void}) {
    const [packages, setPackages] = useState<Package[] | null>(null);
    const navigate = useNavigate();

    // Load packages when the popup opens, not on mount: most exam entries still
    // have turns left, so if the popup never shows we save a network round trip.
    useEffect(() => {
        if (!open || packages) return;
        Api.get('package/list').then(setPackages).catch(() => setPackages([]));
    }, [open, packages]);

    return <Modal open={!!open} size='tiny' onClose={onClose} closeIcon={!!onClose}>
        <Modal.Content>
            <div className='text-center'>
                <div className='tk-out-icon'>
                    <Icon name='ticket' size='big'/>
                </div>
                <h2 className='tk-out-title'>Bạn đã hết lượt thi</h2>
            </div>

            {/* Packages show right in the popup: see the price before deciding,
                no need to open another page to learn how much it costs. */}
            {packages === null
                ? <Loading/>
                : !packages.length
                    ? <p className='text-center text-muted'>
                        Chưa có gói nào đang bán — liên hệ giáo viên của bạn.
                    </p>
                    : <div className='tk-pkg-list'>
                        {packages.map(p =>
                            <button key={p.id} type='button' className='tk-pkg'
                                    onClick={() => navigate('/payment/' + p.id)}>
                                <div className='tk-pkg-name'>{p.name}</div>
                                <div className='tk-pkg-turns'>{p.turns} lượt</div>
                                <div className='tk-pkg-price'>{formatPrice(p.price)}</div>
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
