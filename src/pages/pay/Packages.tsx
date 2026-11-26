import {Link, useSearchParams} from 'react-router-dom';

import {EmptyState, ErrorState, PageTitle, buttonClass, cx, Loading} from '../../components/ui';
import {usePackages} from '../../queries/payment';
import {useWallet} from '../../queries/wallet';
import PackageCard from './PackageCard';
import {Tick, TicketSticker, packageDecos} from './packageDeco';
import {errorText} from '../../lib/format';
import './pay.css';

const PERKS = ['Lượt thi không hết hạn', 'Dùng cho mọi môn thi', 'Cộng dồn khi mua thêm'];

/**
 * Student "Gói thi" (HS-Goi). Route /packages. Picking a package goes to the existing
 * confirmation route /payment/:packageId — the SePay flow itself is unchanged.
 * `?het-luot=1` (sent by the out-of-turns dialog) or 0 turns left turns the turns card red ("hết lượt").
 */
export default function Packages() {
    const [params] = useSearchParams();
    const {data: packages, error, refetch, isFetching} = usePackages();
    const {data: wallet} = useWallet();
    const out = params.get('het-luot') === '1' || wallet?.remaining === 0;

    const {sorted: list, decos} = packageDecos(packages || []);
    // The featured one gets the primary (blue) button; with none featured, the middle one does.
    const primaryId = (list.find(p => p.featured) || list[Math.min(1, list.length - 1)])?.id;

    if (!packages && !error) return <Loading/>; // lần đầu: cả vùng nội dung là khối tải

    return <div className='pk-page'>
        <div className='pk-top'>
            <PageTitle>Gói thi</PageTitle>
            <Link to='/billing' className={buttonClass({variant: 'ghost'})}>Lịch sử mua gói</Link>
        </div>

        {wallet && <section className={cx('vt-card pk-hero', out && 'pk-hero--out')} aria-label='Lượt của em'>
            <div className='pk-hero-art'><TicketSticker count={out ? 1 : 3} fill={out ? '#ffffff' : 'var(--vt-sun)'} width={120} height={98} className='pk-stk-hero'/></div>
            <div className='pk-hero-main'>
                <span className='pk-hero-k'>{out ? 'Em đã hết lượt' : 'Bạn còn'}</span>
                <div className='pk-hero-n'>{wallet.remaining}<small>lượt</small></div>
            </div>
            <ul className='pk-perks' aria-label='Gói nào cũng'>
                {PERKS.map(s => <li key={s}><Tick/>{s}</li>)}
            </ul>
        </section>}

        {error
            ? <ErrorState title='Không tải được danh sách gói' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !list.length
                    ? <EmptyState title='Chưa có gói nào đang bán' description='Quay lại sau nhé — Admin sẽ mở bán gói mới.'/>
                    : <ul className={cx('pk-grid', list.length === 4 && 'pk-grid--4')} aria-label='Các gói'>
                        {list.map(p => <li key={p.id} className={cx(p.featured && 'pk-first')}>
                            <PackageCard pkg={p} deco={decos[p.id]} action={
                                <Link to={'/payment/' + p.id} aria-label={'Chọn gói ' + p.name}
                                      className={buttonClass({variant: p.id === primaryId ? 'primary' : 'secondary', block: true})}>
                                    Chọn gói
                                </Link>}/>
                        </li>)}
                    </ul>}
    </div>;
}
