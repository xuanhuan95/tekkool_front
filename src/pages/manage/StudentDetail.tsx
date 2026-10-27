import {Link, useParams} from 'react-router-dom';

import {Avatar, Badge, Button, Card, ErrorState, PageTitle, SkeletonCard, buttonClass} from '../../components/ui';
import {useUserDetail} from '../../queries/manage';
import {errorText, formatDate, formatDateTime, formatMoney} from '../../lib/format';
import {orderName, orderStatus} from '../pay/order';
import {AccountBadge, useAccountActions} from './shared';

/**
 * "Chi tiết học sinh" (AD-HocSinhChiTiet, SPT-77). Route /manage/users/:id. Lock / unlock + reset password live here.
 * ponytail: the design's title chip ("Học sinh chăm") and star count are not in `admin_users/detail` — not shown until BE sends them.
 */
export default function StudentDetail() {
    const {id = ''} = useParams();
    const {data: u, error, refetch, isFetching} = useUserDetail(id);
    const {askLock, askReset, dialogs} = useAccountActions();

    return <div className='vt-mg-page'>
        <Link to='/manage/users' className={buttonClass({variant: 'ghost'}) + ' vt-mg-back'}>← Học sinh</Link>
        <PageTitle>Chi tiết học sinh</PageTitle>
        {error && !u
            ? <ErrorState title='Không tải được học sinh' description={errorText(error, 'Thử lại sau.')} onRetry={() => refetch()} retrying={isFetching}/>
            : !u ? <SkeletonCard label='Đang tải chi tiết'/>
            : <Card as='aside' aria-label='Chi tiết học sinh' className='vt-mg-stack vt-mg-detail'>
                <div className='vt-mg-person'>
                    <Avatar name={u.name} size={40}/>
                    <div>
                        <div className='vt-mg-section-title'>{u.name}</div>
                        <AccountBadge status={u.status}/>
                    </div>
                </div>
                <dl className='vt-mg-dl'>
                    <dt>Email</dt><dd>{u.email}</dd>
                    <dt>Tham gia</dt><dd className='vt-num'>{formatDate(u.created_at)}</dd>
                    <dt>Đăng nhập</dt><dd className='vt-num'>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Chưa đăng nhập'}</dd>
                    <dt>Bài đã làm</dt><dd>{u.submissions.count} bài · {u.submissions.exams} đề</dd>
                </dl>

                <span className='vt-mg-section-title'>Lượt thi</span>
                <div className='vt-mg-stats' style={{gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>
                    <span className='vt-mg-stat'><span className='vt-mg-stat-value vt-num'>{u.turns.bought}</span><span className='vt-mg-stat-sub'>đã mua</span></span>
                    <span className='vt-mg-stat'><span className='vt-mg-stat-value vt-num'>{u.turns.used}</span><span className='vt-mg-stat-sub'>đã dùng</span></span>
                    <span className='vt-mg-stat'><span className='vt-mg-stat-value vt-num'>{u.turns.remaining}</span><span className='vt-mg-stat-sub'>còn lại</span></span>
                </div>
                <span className='vt-muted vt-mg-small'>Lượt không hết hạn.</span>

                <span className='vt-mg-section-title'>Đơn gần đây</span>
                <span className='vt-muted vt-mg-small vt-num'>{u.order_counts.paid} thành công · {u.order_counts.pending} đang xử lý · {u.order_counts.failed} thất bại · {u.order_counts.cancelled ?? 0} đã huỷ</span>
                {!u.orders.length ? <span className='vt-muted'>Chưa có đơn nào.</span>
                    : u.orders.slice(0, 5).map(o => {
                        const st = orderStatus(o.status);
                        return <div key={o.invoice_number} className='vt-mg-row'>
                            <span>{orderName(o)} · {formatMoney(o.amount)}<small className='vt-num'>{o.invoice_number} · {formatDate(o.created_at)}</small></span>
                            <Badge tone={st.tone}>{st.label}</Badge>
                        </div>;
                    })}
                <Link to={'/manage/transactions?q=' + encodeURIComponent(u.email)} className={buttonClass({variant: 'ghost'})}>Xem trong Giao dịch</Link>

                <hr className='vt-mg-sep'/>
                {u.manageable
                    ? <>
                        <div className='vt-mg-actions'>
                            <Button onClick={() => askReset(u)}>Đặt lại mật khẩu</Button>
                            <Button variant={u.locked ? 'secondary' : 'danger'} onClick={() => askLock(u)}>
                                {u.locked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}</Button>
                        </div>
                        <span className='vt-muted vt-mg-small'>Khoá: học sinh không đăng nhập được, lượt còn lại được giữ nguyên.</span>
                    </>
                    : <span className='vt-muted vt-mg-small'>Tài khoản Admin chỉ xem, không khoá hay đặt lại mật khẩu ở đây.</span>}
            </Card>}
        {dialogs}
    </div>;
}
