import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';

import {Button, Card, CardTitle, DateField, ErrorState, FilterChip, PageColumns, PageTitle, Select, SkeletonCard, Table, Tabs,
    TextField, buttonClass, icons} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useReconcile, useTransaction, useTransactions} from '../../queries/manage';
import type {Anomaly, AnomalyType, TimelineEvent, Transaction, TxStatus} from '../../queries/manage';
import {errorText, formatDateTime, formatMoney, formatShortDateTime, formatTime, groupDigits} from '../../lib/format';
import {Pager, TX_STATUS, TxBadge, useDebounced} from './shared';

const LIMIT = 20;

export const ANOMALY_LABEL: Record<AnomalyType, string> = {
    paid_not_credited: 'Đã nhận tiền, chưa cộng lượt',
    amount_mismatch: 'Lệch số tiền',
    paid_no_turns: 'Đã thanh toán, không cộng được lượt',
    duplicate_transaction: 'Trùng mã giao dịch SePay',
    paid_without_ipn: 'Thành công nhưng thiếu dữ liệu SePay',
    pending_stale: 'Chờ webhook quá lâu',
};

/** One line of the order timeline (AD-GiaoDich aside). */
export function timelineText(e: TimelineEvent, amount: number): {title: string; note: string} {
    switch (e.event) {
        case 'created': return {title: 'Tạo đơn', note: 'học sinh xác nhận mua gói, chuyển sang SePay'};
        case 'reconciled': return {title: 'Hệ thống hỏi SePay', note: 'đối soát tự động lần gần nhất'};
        case 'sepay': return {title: 'SePay báo về',
            note: e.received === null ? 'chưa có bằng chứng đã nhận tiền'
                : `${formatMoney(e.received)}${e.received === amount ? ', khớp số tiền đơn'
                    : e.received < amount ? `, thiếu ${formatMoney(amount - e.received)}` : `, thừa ${formatMoney(e.received - amount)}`}`};
        case 'credited': return {title: `Cộng ${e.turns} lượt`, note: 'đơn chuyển sang thành công'};
    }
}

function TxDetail({inv}: {inv: string}) {
    const {data: t, error, refetch, isFetching} = useTransaction(inv);
    if (error) return <ErrorState title='Không tải được đơn' description={errorText(error, 'Thử lại sau.')}
                                  onRetry={() => refetch()} retrying={isFetching}/>;
    if (!t) return <SkeletonCard label='Đang tải đơn'/>;

    return <Card as='aside' aria-label='Chi tiết đơn' className='vt-mg-stack'>
        <span className='vt-mg-stat-label'>Chi tiết đơn</span>
        <div className='vt-mg-row'><span className='vt-mg-section-title vt-num'>{t.invoice_number}</span><TxBadge status={t.status}/></div>
        <span className='vt-muted'>{t.user?.name || 'Không rõ người mua'} · {t.packages.join(', ') || '—'} · {formatMoney(t.amount)}</span>
        <dl className='vt-mg-dl'>
            <dt>Mã SePay</dt><dd className='vt-num'>{t.sepay_order_id || '—'}</dd>
            <dt>Mã giao dịch</dt><dd className='vt-num'>{t.sepay_transaction_id || '—'}</dd>
            <dt>Tiền nhận</dt><dd className='vt-num'>{t.received === null ? '—' : formatMoney(t.received)}</dd>
            <dt>Tạo lúc</dt><dd className='vt-num'>{formatDateTime(t.created_at)}</dd>
        </dl>
        <hr className='vt-mg-sep'/>
        <ol className='vt-mg-timeline' aria-label='Dòng thời gian'>
            {t.timeline.map((e, i) => {
                const x = timelineText(e, t.amount);
                return <li key={i}>
                    <span className={'vt-mg-dot' + (e.event === 'credited' ? ' vt-mg-dot--ok' : '')} aria-hidden='true'/>
                    <span><b>{x.title}</b><small className='vt-num'>{formatTime(e.at)} · {x.note}</small></span>
                </li>;
            })}
        </ol>
        {t.anomalies.map((a, i) => <div key={i} role='alert' className='vt-mg-alert'>
            <icons.IconWarn/><span><b>{ANOMALY_LABEL[a.type] || a.type}</b><br/>{a.message}
                {a.related?.length ? <> · cùng mã với {a.related.join(', ')}</> : null}</span>
        </div>)}
        <details className='vt-mg-raw'>
            <summary>Dữ liệu SePay lưu trên đơn</summary>
            <pre>{t.raw_ipn ? JSON.stringify(t.raw_ipn, null, 2) : 'Chưa có dữ liệu SePay.'}</pre>
        </details>
        <div className='vt-mg-actions'>
            <Button size='sm' disabled aria-describedby='soon-reconcile'>Đối soát lại</Button>
            <span id='soon-reconcile' className='vt-mg-soon'>Sắp có — hỏi lại SePay cho đơn này</span>
        </div>
        {t.user && <Link to={'/manage/users?group=all&id=' + encodeURIComponent(t.user.id)} className={buttonClass({variant: 'ghost'})}>Xem học sinh</Link>}
    </Card>;
}

function ReconcileTab({onOpen}: {onOpen: (inv: string) => void}) {
    const [type, setType] = useState<AnomalyType | ''>('');
    const {data, error, refetch, isFetching} = useReconcile(type || undefined);
    // Counts come from the unfiltered list, so the chips keep their numbers while one is selected.
    const all = useReconcile();
    const counts = all.data?.counts || {};

    const columns: Column<Anomaly>[] = [
        {key: 'type', header: 'Loại lệch', emphasis: 'strong', render: a => ANOMALY_LABEL[a.type] || a.type},
        {key: 'inv', header: 'Mã đơn', render: a => <button type='button' className='vt-mg-link vt-num'
                                                            onClick={() => onOpen(a.invoice_number)}>{a.invoice_number}</button>},
        {key: 'user', header: 'Học sinh', render: a => a.user?.name || '—'},
        {key: 'amount', header: 'Tiền đơn', align: 'right', render: a => <span className='vt-num'>{formatMoney(a.amount)}</span>},
        {key: 'received', header: 'Tiền nhận', align: 'right', render: a => <span className='vt-num'>{a.received === null ? '—' : formatMoney(a.received)}</span>},
        {key: 'status', header: 'Trạng thái', render: a => <TxBadge status={a.status}/>},
        {key: 'at', header: 'Thời gian', emphasis: 'muted', render: a => <span className='vt-num'>{formatShortDateTime(a.created_at)}</span>},
        {key: 'msg', header: 'Mô tả', render: a => <span className='vt-mg-msg'>{a.message}</span>},
    ];

    return <div className='vt-mg-stack'>
        <p className='vt-muted'>Đơn cần xử lý tay. Chỉ đọc dữ liệu đã lưu, không đổi trạng thái đơn.</p>
        <div className='vt-chip-row' role='group' aria-label='Loại lệch'>
            <FilterChip selected={!type} onChange={() => setType('')}>Tất cả ({groupDigits(all.data?.total ?? 0)})</FilterChip>
            {(Object.keys(ANOMALY_LABEL) as AnomalyType[]).map(k =>
                <FilterChip key={k} selected={type === k} onChange={on => setType(on ? k : '')}>{ANOMALY_LABEL[k]} ({counts[k] || 0})</FilterChip>)}
        </div>
        {error && !data
            ? <ErrorState title='Không tải được danh sách đối soát' description={errorText(error, 'Thử lại sau.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !data ? <SkeletonCard label='Đang tải đối soát'/>
                : <Table caption='Đơn lệch cần đối soát' columns={columns} rows={data.items} minWidth={1000}
                         rowKey={(a, i) => a.type + a.invoice_number + i} empty='Không có đơn lệch nào. Mọi thứ khớp.'/>}
    </div>;
}

/** "Giao dịch & đối soát" (AD-GiaoDich). Route /manage/transactions?tab=&status=&from=&to=&q=&page=&inv=. */
export default function Transactions() {
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'reconcile' ? 'reconcile' : 'list';
    const status = params.get('status') || '';
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const inv = params.get('inv');
    const [q, setQ] = useState(params.get('q') || '');
    const query = useDebounced(q.trim());
    const {data, error, refetch, isFetching} = useTransactions({status, from, to, q: query, page, limit: LIMIT}, tab === 'list');

    const set = (patch: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
        setParams(next, {replace: true});
    };

    const columns: Column<Transaction>[] = [
        {key: 'inv', header: 'Mã đơn', render: t => <button type='button' className='vt-mg-link vt-num'
                                                            aria-label={'Xem đơn ' + t.invoice_number}
                                                            onClick={() => set({inv: t.invoice_number})}>{t.invoice_number}</button>},
        {key: 'sepay', header: 'Mã SePay', emphasis: 'muted', render: t => <span className='vt-num'>{t.sepay_order_id || '—'}</span>},
        {key: 'user', header: 'Học sinh', emphasis: 'strong', render: t => t.user?.name || '—'},
        {key: 'pkg', header: 'Gói', render: t => t.packages.join(', ') || '—'},
        {key: 'amount', header: 'Tiền đơn', align: 'right', render: t => <span className='vt-num'>{formatMoney(t.amount)}</span>},
        {key: 'received', header: 'Tiền nhận', align: 'right', render: t => <span className='vt-num'>{t.received === null ? '—' : formatMoney(t.received)}</span>},
        {key: 'status', header: 'Trạng thái', render: t => <TxBadge status={t.status}/>},
        {key: 'at', header: 'Thời gian', emphasis: 'muted', render: t => <span className='vt-num'>{formatShortDateTime(t.created_at)}</span>},
    ];

    const st = data?.stats;
    const stat = (s: TxStatus) => st?.[s] || {count: 0, amount: 0};

    const listTab = <div className='vt-mg-stack'>
        {st && <div className='vt-mg-stats'>
            <Card size='md' className='vt-mg-stat'><span className='vt-mg-stat-label'>Thành công</span>
                <span className='vt-mg-stat-value vt-num'>{groupDigits(stat('paid').count)} đơn</span>
                <span className='vt-mg-stat-sub vt-num'>{formatMoney(stat('paid').amount)} đã nhận</span></Card>
            <Card size='md' className='vt-mg-stat'><span className='vt-mg-stat-label'>Đang xử lý</span>
                <span className='vt-mg-stat-value vt-num'>{groupDigits(stat('pending').count)} đơn</span>
                <span className='vt-mg-stat-sub'>chờ webhook SePay</span></Card>
            <Card size='md' className='vt-mg-stat'><span className='vt-mg-stat-label'>Lệch tiền / Thất bại</span>
                <span className='vt-mg-stat-value vt-num'>{stat('mismatch').count} / {stat('failed').count}</span>
                <span className='vt-mg-stat-sub'>{stat('mismatch').count} đơn lệch tiền cần xử lý tay</span></Card>
        </div>}
        <Card flush className='vt-table-card'>
        <div className='vt-table-toolbar'>
        <div className='vt-mg-filters'>
            <DateField label='Từ ngày' value={from} max={to || undefined} onChange={v => set({from: v || null, page: null})}/>
            <DateField label='Đến ngày' value={to} min={from || undefined} onChange={v => set({to: v || null, page: null})}/>
            <Select label='Trạng thái' value={status} placeholder='Tất cả' onChange={e => set({status: e.target.value, page: null})}
                    options={(Object.keys(TX_STATUS) as TxStatus[]).map(s => ({value: s, label: TX_STATUS[s].label}))}/>
            <TextField label='Tìm' type='search' placeholder='Mã đơn, email hoặc tên' value={q}
                       onChange={e => { setQ(e.target.value); set({q: e.target.value || null, page: null}); }}/>
        </div>
        </div>
        {error && !data
            ? <div className='vt-table-state'><ErrorState title='Không tải được giao dịch' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/></div>
            : !data ? <div className='vt-table-state'><SkeletonCard label='Đang tải giao dịch'/></div>
                : <Table bare caption='Danh sách giao dịch' columns={columns} rows={data.items} rowKey={t => t.invoice_number}
                         minWidth={980} isHighlighted={t => t.invoice_number === inv} empty='Không có giao dịch khớp bộ lọc'/>}
        </Card>
        {data && <>
                    <Pager page={data.page} limit={data.limit} total={data.total} unit='đơn' onPage={p => set({page: String(p)})}/>
                </>}
    </div>;

    return <div className='vt-mg-page'>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Giao dịch &amp; đối soát</PageTitle>
                <p className='vt-muted'>Đơn mua gói thanh toán qua SePay. Hệ thống cộng lượt khi webhook báo nhận đủ tiền.</p>
            </div>
            <Tabs aria-label='Giao dịch hoặc đối soát' idPrefix='tx' value={tab}
                  items={[{value: 'list', label: 'Giao dịch'}, {value: 'reconcile', label: 'Đối soát'}]}
                  onChange={v => set({tab: v === 'list' ? null : v})}/>
        </div>
        <PageColumns
            main={<div role='tabpanel' id={'tx-panel-' + tab} aria-labelledby={'tx-tab-' + tab}>
                {tab === 'list' ? listTab : <ReconcileTab onOpen={i => set({tab: null, inv: i})}/>}
            </div>}
            side={inv ? <TxDetail inv={inv}/>
                : <Card className='vt-mg-stack'><CardTitle>Chi tiết đơn</CardTitle>
                    <p className='vt-muted'>Bấm mã đơn để xem dòng thời gian, dữ liệu SePay và cảnh báo lệch.</p></Card>}/>
    </div>;
}
