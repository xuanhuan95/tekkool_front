import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';

import {Avatar, Card, ErrorState, IconButton, PageTitle, Select, Skeleton, SkeletonCard, Table, TextField, icons} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useUsers} from '../../queries/manage';
import type {AdminUser} from '../../queries/manage';
import {errorText, formatDate, groupDigits} from '../../lib/format';
import {AccountBadge, Pager, useDebounced} from './shared';

const LIMIT = 20;

/**
 * "Học sinh" (AD-NguoiDung, SPT-77). Students only: no role column, no teacher filter. Lock / unlock and reset
 * password moved to the detail screen (/manage/users/:id). Route /manage/users?q=&status=&page=. API admin_users/list?group=student.
 */
export default function Users() {
    const [params, setParams] = useSearchParams();
    const status = params.get('status') || '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [q, setQ] = useState(params.get('q') || '');
    const query = useDebounced(q.trim());
    const {data, error, refetch, isFetching} = useUsers({group: 'student', status, q: query, page, limit: LIMIT});

    const set = (patch: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
        setParams(next, {replace: true});
    };

    const columns: Column<AdminUser>[] = [
        {key: 'name', header: 'Họ tên', emphasis: 'strong', render: u =>
            <span className='vt-mg-person'><Avatar name={u.name} size={36}/>{u.name}</span>},
        {key: 'email', header: 'Email', emphasis: 'muted'},
        {key: 'turns', header: 'Lượt còn', align: 'right', render: u => <span className='vt-num'>{u.turns_remaining ?? '—'}</span>},
        {key: 'created', header: 'Ngày tham gia', emphasis: 'muted', render: u => <span className='vt-num'>{formatDate(u.created_at)}</span>},
        {key: 'status', header: 'Trạng thái', render: u => <AccountBadge status={u.status}/>},
        {key: 'actions', header: 'Thao tác', sticky: true, render: u =>
            <IconButton to={'/manage/users/' + u.id} tipEnd label={'Xem chi tiết ' + u.name} icon={<icons.IconArrowRight/>}/>},
    ];

    const total = data?.counts?.student ?? data?.total;
    return <div className='vt-mg-page'>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Học sinh</PageTitle>
                <p className='vt-muted vt-num'>{total !== undefined ? `Tổng ${groupDigits(total)} học sinh` : <Skeleton width={160} height={14}/>}</p>
            </div>
        </div>
        <Card flush className='vt-table-card'>
            <div className='vt-table-toolbar'><div className='vt-mg-filters'>
                <TextField label='Tìm kiếm' type='search' placeholder='Họ tên hoặc email' value={q}
                           onChange={e => { setQ(e.target.value); set({page: null}); }}/>
                <Select label='Trạng thái' value={status} placeholder='Tất cả' onChange={e => set({status: e.target.value, page: null})}
                        options={[{value: 'active', label: 'Hoạt động'}, {value: 'locked', label: 'Đã khoá'},
                            {value: 'never_logged_in', label: 'Chưa đăng nhập'}]}/>
            </div></div>
            {error && !data
                ? <div className='vt-table-state'><ErrorState title='Không tải được danh sách học sinh' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                              onRetry={() => refetch()} retrying={isFetching}/></div>
                : !data
                    ? <div className='vt-table-state'><SkeletonCard label='Đang tải học sinh'/></div>
                    : <Table bare caption='Danh sách học sinh' columns={columns} rows={data.items} rowKey={u => u.id} minWidth={720}
                             empty='Không có học sinh khớp bộ lọc'/>}
        </Card>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} unit='học sinh' onPage={p => set({page: String(p)})}/>}
    </div>;
}
