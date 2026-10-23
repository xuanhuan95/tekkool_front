import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';

import {Avatar, Badge, Button, Card, ConfirmDialog, ErrorState, PageColumns, PageTitle, Select, Skeleton, SkeletonCard,
    Table, Tabs, TextField, buttonClass, notify} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useLockUser, useResetPassword, useUserDetail, useUsers} from '../../queries/manage';
import type {AdminUser} from '../../queries/manage';
import {errorText, formatDate, formatDateTime, formatMoney, groupDigits} from '../../lib/format';
import {orderName, orderStatus} from '../pay/order';
import {AccountBadge, Pager, ROLE_LABEL, TempPasswordDialog, useDebounced} from './shared';

const LIMIT = 20;
const GROUPS = [{value: 'student', label: 'Học sinh'}, {value: 'teacher', label: 'Giáo viên'}, {value: 'all', label: 'Tất cả'}] as const;
type Group = typeof GROUPS[number]['value'];
const UNIT: Record<Group, string> = {student: 'học sinh', teacher: 'giáo viên', all: 'người dùng'};

/** Lock / unlock + reset password, with confirmations. Shared by the table and the side panel. */
function useAccountActions() {
    const lock = useLockUser();
    const reset = useResetPassword();
    const [confirmLock, setConfirmLock] = useState<AdminUser | null>(null);
    const [confirmReset, setConfirmReset] = useState<AdminUser | null>(null);
    const [shown, setShown] = useState<{name: string; email: string; password: string} | null>(null);

    const dialogs = <>
        <ConfirmDialog open={!!confirmLock} tone={confirmLock?.locked ? 'primary' : 'danger'} loading={lock.isPending}
                       title={confirmLock?.locked ? 'Mở khoá tài khoản?' : 'Khoá tài khoản?'}
                       message={confirmLock?.locked
                           ? `${confirmLock?.name} đăng nhập lại được bằng mật khẩu cũ.`
                           : `${confirmLock?.name} bị đăng xuất ngay và không đăng nhập được. Lượt, đơn và bài làm giữ nguyên.`}
                       confirmLabel={confirmLock?.locked ? 'Mở khoá' : 'Khoá'}
                       onCancel={() => setConfirmLock(null)}
                       onConfirm={() => {
                           const u = confirmLock!;
                           lock.mutate({userId: u.id, lock: !u.locked}, {
                               onSuccess: () => { notify.success(u.locked ? 'Đã mở khoá' : 'Đã khoá tài khoản', u.name); setConfirmLock(null); },
                               onError: e => { notify.error('Không thực hiện được', errorText(e, 'Thử lại sau.')); setConfirmLock(null); },
                           });
                       }}/>
        <ConfirmDialog open={!!confirmReset} loading={reset.isPending} title='Đặt lại mật khẩu?'
                       message={`Hệ thống tạo mật khẩu tạm mới cho ${confirmReset?.name}. Mọi phiên đăng nhập của họ bị đăng xuất; lần đăng nhập tới phải đổi mật khẩu.`}
                       confirmLabel='Đặt lại' onCancel={() => setConfirmReset(null)}
                       onConfirm={() => {
                           const u = confirmReset!;
                           reset.mutate(u.id, {
                               onSuccess: r => { setConfirmReset(null); setShown({name: u.name, email: u.email, password: r.temp_password}); },
                               onError: e => { notify.error('Không đặt lại được mật khẩu', errorText(e, 'Thử lại sau.')); setConfirmReset(null); },
                           });
                       }}/>
        <TempPasswordDialog open={!!shown} name={shown?.name} email={shown?.email} password={shown?.password || ''}
                            onClose={() => setShown(null)}/>
    </>;
    return {askLock: setConfirmLock, askReset: setConfirmReset, dialogs};
}

function UserDetail({userId, onLock, onReset}: {userId: string; onLock: (u: AdminUser) => void; onReset: (u: AdminUser) => void}) {
    const {data: u, error, refetch, isFetching} = useUserDetail(userId);
    if (error) return <ErrorState title='Không tải được người dùng' description={errorText(error, 'Thử lại sau.')}
                                  onRetry={() => refetch()} retrying={isFetching}/>;
    if (!u) return <SkeletonCard label='Đang tải chi tiết'/>;

    const student = u.role === 'student';
    return <Card as='aside' aria-label={'Chi tiết ' + ROLE_LABEL[u.role].toLowerCase()} className='vt-mg-stack'>
        <div className='vt-mg-person'>
            <Avatar name={u.name}/>
            <div>
                <div className='vt-mg-section-title'>{u.name}</div>
                <span className='vt-mg-tags'><Badge tone='title'>{ROLE_LABEL[u.role]}</Badge><AccountBadge status={u.status}/></span>
            </div>
        </div>
        <dl className='vt-mg-dl'>
            <dt>Email</dt><dd>{u.email}</dd>
            <dt>Tham gia</dt><dd className='vt-num'>{formatDate(u.created_at)}</dd>
            <dt>Đăng nhập</dt><dd className='vt-num'>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Chưa đăng nhập'}</dd>
            {student && <><dt>Bài đã làm</dt><dd>{u.submissions.count} bài · {u.submissions.exams} đề</dd></>}
            {u.role === 'teacher' && <><dt>Đề đã tạo</dt><dd>{u.exam_count ?? 0} đề</dd></>}
        </dl>

        {student && <>
            <hr className='vt-mg-sep'/>
            <span className='vt-mg-section-title'>Lượt thi</span>
            <div className='vt-mg-stats' style={{gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>
                <span className='vt-mg-stat'><span className='vt-mg-stat-value vt-num'>{u.turns.bought}</span><span className='vt-mg-stat-sub'>đã mua</span></span>
                <span className='vt-mg-stat'><span className='vt-mg-stat-value vt-num'>{u.turns.used}</span><span className='vt-mg-stat-sub'>đã dùng</span></span>
                <span className='vt-mg-stat'><span className='vt-mg-stat-value vt-num'>{u.turns.remaining}</span><span className='vt-mg-stat-sub'>còn lại</span></span>
            </div>
            <span className='vt-muted vt-mg-small'>Lượt không hết hạn.</span>
        </>}

        {(student || u.orders.length > 0) && <>
            <hr className='vt-mg-sep'/>
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
        </>}

        <hr className='vt-mg-sep'/>
        {u.manageable
            ? <>
                <div className='vt-mg-actions'>
                    <Button size='sm' onClick={() => onReset(u)}>Đặt lại mật khẩu</Button>
                    <Button size='sm' variant={u.locked ? 'secondary' : 'danger'} onClick={() => onLock(u)}>
                        {u.locked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}</Button>
                </div>
                <span className='vt-muted vt-mg-small'>Khoá: không đăng nhập được, lượt còn lại được giữ nguyên.</span>
            </>
            : <span className='vt-muted vt-mg-small'>Tài khoản Admin chỉ xem, không khoá hay đặt lại mật khẩu ở đây.</span>}
    </Card>;
}

/** "Người dùng" (AD-NguoiDung). Route /manage/users?group=&q=&status=&page=&id=. API admin_users/*. */
export default function Users() {
    const [params, setParams] = useSearchParams();
    const group = (GROUPS.some(g => g.value === params.get('group')) ? params.get('group') : 'student') as Group;
    const status = params.get('status') || '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const selected = params.get('id');
    const [q, setQ] = useState(params.get('q') || '');
    const query = useDebounced(q.trim());
    const {data, error, refetch, isFetching} = useUsers({group, status, q: query, page, limit: LIMIT});
    const {askLock, askReset, dialogs} = useAccountActions();

    const set = (patch: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
        setParams(next, {replace: true});
    };
    const qChange = (v: string) => { setQ(v); set({page: null}); };

    const columns: Column<AdminUser>[] = [
        {key: 'name', header: 'Họ tên', emphasis: 'strong', render: u =>
            <span className='vt-mg-person'><Avatar name={u.name} size={36}/>{u.name}</span>},
        {key: 'email', header: 'Email', emphasis: 'muted'},
        {key: 'role', header: 'Vai trò', render: u => ROLE_LABEL[u.role] || u.role},
        {key: 'turns', header: 'Lượt còn', align: 'right', render: u => <span className='vt-num'>{u.turns_remaining ?? '—'}</span>},
        {key: 'created', header: 'Ngày tham gia', emphasis: 'muted', render: u => <span className='vt-num'>{formatDate(u.created_at)}</span>},
        {key: 'status', header: 'Trạng thái', render: u => <AccountBadge status={u.status}/>},
        {key: 'actions', header: 'Thao tác', sticky: true, render: u => <span className='vt-mg-actions'>
            {u.id === selected ? <span className='vt-muted'>Đang xem</span>
                : <Button size='sm' variant='ghost' aria-label={'Xem ' + u.name} onClick={() => set({id: u.id})}>Xem</Button>}
            {u.manageable && <Button size='sm' variant='ghost' className={u.locked ? undefined : 'vt-btn-danger-text'} onClick={() => askLock(u)}
                                     aria-label={(u.locked ? 'Mở khoá ' : 'Khoá ') + u.name}>{u.locked ? 'Mở khoá' : 'Khoá'}</Button>}
        </span>},
    ];

    const c = data?.counts;
    const main = <>
        <Card flush className='vt-table-card'>
        <div className='vt-table-toolbar'><div className='vt-mg-filters'>
            <TextField label='Tìm kiếm' type='search' placeholder='Họ tên hoặc email' value={q} onChange={e => qChange(e.target.value)}/>
            <Select label='Trạng thái' value={status} placeholder='Tất cả' onChange={e => set({status: e.target.value, page: null})}
                    options={[{value: 'active', label: 'Hoạt động'}, {value: 'locked', label: 'Đã khoá'},
                        {value: 'never_logged_in', label: 'Chưa đăng nhập'}]}/>
        </div></div>
        {error && !data
            ? <div className='vt-table-state'><ErrorState title='Không tải được người dùng' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/></div>
            : !data
                ? <div className='vt-table-state'><SkeletonCard label='Đang tải người dùng'/></div>
                : <Table bare caption='Danh sách người dùng' columns={columns} rows={data.items} rowKey={u => u.id} minWidth={860}
                         isHighlighted={u => u.id === selected} empty='Không có người dùng khớp bộ lọc'/>}
        </Card>
        {data && <>
                    <Pager page={data.page} limit={data.limit} total={data.total} unit={UNIT[group]} onPage={p => set({page: String(p)})}/>
                </>}
    </>;

    return <div className='vt-mg-page'>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Người dùng</PageTitle>
                <p className='vt-muted vt-num'>{c ? `${groupDigits(c.student)} học sinh · ${groupDigits(c.teacher)} giáo viên · ${groupDigits(c.admin)} admin` : <Skeleton width={220} height={14}/>}</p>
            </div>
            <Tabs aria-label='Vai trò' items={GROUPS.map(g => ({...g}))} value={group}
                  onChange={g => set({group: g === 'student' ? null : g, page: null, id: null})}/>
        </div>
        <PageColumns main={main}
                     side={selected ? <UserDetail userId={selected} onLock={askLock} onReset={askReset}/>
                         : <Card className='vt-mg-stack'><span className='vt-mg-section-title'>Chi tiết</span>
                             <p className='vt-muted'>Bấm “Xem” ở một dòng để xem lượt, đơn gần đây và thao tác tài khoản.</p></Card>}/>
        {dialogs}
    </div>;
}
