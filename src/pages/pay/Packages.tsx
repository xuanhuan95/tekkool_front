import {Link, useSearchParams} from 'react-router-dom';

import {EmptyState, ErrorState, MetaChips, PageTitle, SkeletonCard, buttonClass, icons} from '../../components/ui';
import {usePackages} from '../../queries/payment';
import {useWallet} from '../../queries/wallet';
import PackageCard from './PackageCard';
import {errorText} from '../../lib/format';
import './pay.css';

/**
 * Student "Gói thi" (HS-Goi). Route /packages. Picking a package goes to the existing
 * confirmation route /payment/:packageId — the SePay flow itself is unchanged.
 * `?het-luot=1` (sent by the out-of-turns dialog) adds the "hết lượt" banner.
 */
export default function Packages() {
    const [params] = useSearchParams();
    const outOfTurns = params.get('het-luot') === '1';
    const {data: packages, error, refetch, isFetching} = usePackages();
    const {data: wallet} = useWallet();

    // The featured one gets the primary (blue) button; with none featured, the middle one does.
    const list = packages || [];
    const primaryId = (list.find(p => p.featured) || list[Math.min(1, list.length - 1)])?.id;

    return <div className='vt-paper vt-pay'>
        <div className='vt-pay-head'>
            <div className='vt-pay-head-text'>
                <PageTitle>Gói thi</PageTitle>
                {wallet && <MetaChips items={[<>Bạn còn <b className='vt-pay-ink'>{wallet.remaining} lượt</b></>]}/>}
            </div>
            <Link to='/billing' className={buttonClass({variant: 'ghost'})}>Lịch sử mua gói</Link>
        </div>

        {outOfTurns && <div role='alert' className='vt-card vt-card--md vt-pay-warn'>
            <icons.IconTicket size={20}/>
            <span>Bạn đã hết lượt thi — chọn một gói bên dưới để tiếp tục làm bài.</span>
        </div>}

        {error
            ? <ErrorState title='Không tải được danh sách gói' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !packages
                ? <div className='vt-pay-grid' aria-busy='true'>
                    <SkeletonCard label='Đang tải gói'/><SkeletonCard label='Đang tải gói'/><SkeletonCard label='Đang tải gói'/>
                </div>
                : !list.length
                    ? <EmptyState title='Chưa có gói nào đang bán' description='Quay lại sau nhé — Admin sẽ mở bán gói mới.'/>
                    : <div className='vt-pay-grid'>
                        {list.map(p => <PackageCard key={p.id} pkg={p} action={
                            <Link to={'/payment/' + p.id} aria-label={'Chọn ' + p.name}
                                  className={buttonClass({variant: p.id === primaryId ? 'primary' : 'secondary', block: true})}>
                                Chọn gói
                            </Link>}/>)}
                    </div>}
    </div>;
}
