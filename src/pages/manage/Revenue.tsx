import {useState} from 'react';
import {Link} from 'react-router-dom';

import {Avatar, Button, Card, CardTitle, ErrorState, PageColumns, PageTitle, Skeleton, SkeletonCard, Table, Tabs,
    buttonClass} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useRevenueSummary, useTransactions} from '../../queries/manage';
import type {Period, RevenueSummary, Transaction} from '../../queries/manage';
import {errorText, formatIsoDay, formatMoney, formatShortDateTime, groupDigits, todayVn, vnClock} from '../../lib/format';
import {bucketLabel, changeText, currentKey, niceScale, shiftAnchor, thousands} from './chart';
import {PackagesSubNav, TxBadge} from './shared';

const PERIODS: {value: Period; label: string}[] = [
    {value: 'day', label: 'Ngày'}, {value: 'week', label: 'Tuần'}, {value: 'month', label: 'Tháng'}, {value: 'all', label: 'Tất cả'},
];
const UNIT: Record<Period, string> = {day: 'giờ', week: 'ngày', month: 'ngày', all: 'tháng'};

export function periodTitle(s: Pick<RevenueSummary, 'period' | 'date_from' | 'date_to'>, today: string): string {
    if (s.period === 'all' || !s.date_from) return 'Toàn bộ thời gian';
    const from = formatIsoDay(s.date_from), to = formatIsoDay(s.date_to);
    const current = !!s.date_to && s.date_from <= today && today <= s.date_to;
    if (s.period === 'day') return (current ? 'Hôm nay · ' : '') + from;
    const name = s.period === 'week' ? 'Tuần' : 'Tháng';
    return `${name}${current ? ' này' : ''} · ${from.slice(0, 5)} – ${to}`;
}

/** Bar chart in CSS (no chart library): blue bars, sun = highest, dashed = bucket still running. */
function RevenueChart({s, today}: {s: RevenueSummary; today: string}) {
    const values = s.series.map(b => b.revenue / 1000);
    const max = Math.max(0, ...values);
    const {top, ticks} = niceScale(max);
    const nowKey = currentKey(s.period, today, (vnClock(new Date().toISOString())?.getUTCHours()) ?? 0);
    const many = s.series.length > 12;
    const best = s.series.find(b => b.revenue / 1000 === max && max > 0);
    const summary = best
        ? `Biểu đồ cột doanh thu theo ${UNIT[s.period]}, ${s.series.length} cột; cao nhất ${bucketLabel(s.period, best.key, today)} với ${formatMoney(best.revenue)}`
        : 'Biểu đồ doanh thu: chưa có doanh thu trong kỳ';

    return <div className='vt-mg-chart' role='img' aria-label={summary}>
        <div className='vt-mg-chart-axis' aria-hidden='true'>{ticks.map(t => <span key={t}>{groupDigits(t)}</span>)}</div>
        <div className='vt-mg-chart-body' aria-hidden='true' style={{['--gap' as string]: many ? '1%' : '4%'}}>
            <div className='vt-mg-chart-plot'>
                {[0, 25, 50, 75].map(t => <div key={t} className='vt-mg-chart-grid' style={{top: t + '%'}}/>)}
                <div className='vt-mg-chart-base'/>
                <div className='vt-mg-chart-bars'>
                    {s.series.map(b => {
                        const v = b.revenue / 1000;
                        const isMax = v === max && max > 0;
                        const cls = ['vt-mg-bar', !v && 'vt-mg-bar--zero', isMax && 'vt-mg-bar--max',
                            b.key === nowKey && 'vt-mg-bar--now'].filter(Boolean).join(' ');
                        return <div key={b.key} className={cls} style={{height: (v / top * 100) + '%'}}
                                    title={`${bucketLabel(s.period, b.key, today)}: ${formatMoney(b.revenue)}`}>
                            {v > 0 && (!many || isMax) && <span className='vt-num'>{thousands(b.revenue)}</span>}
                        </div>;
                    })}
                </div>
            </div>
            <div className='vt-mg-chart-labels'>
                {s.series.map((b, i) => <span key={b.key} className={b.key === nowKey ? 'now' : undefined}>
                    {!many || i % 3 === 0 || b.key === nowKey ? bucketLabel(s.period, b.key, today) : ''}
                </span>)}
            </div>
        </div>
    </div>;
}

/** "Người mua & doanh thu" (AD-DoanhThu). Route /manage/revenue. API admin_revenue/summary + transactions. */
export default function Revenue() {
    const today = todayVn();
    const [period, setPeriod] = useState<Period>('week');
    const [anchor, setAnchor] = useState(today);
    const {data: s, error, refetch, isFetching} = useRevenueSummary(period, anchor);
    const range = s && s.period === period ? {from: s.date_from || undefined, to: s.date_to || undefined} : undefined;
    const recent = useTransactions({...range, limit: 6}, !!range);
    const buyers = useTransactions({...range, status: 'paid', limit: 30}, !!range);

    const change = s ? changeText(s.change_pct, s.period) : null;
    const pickPeriod = (p: Period) => { setPeriod(p); setAnchor(today); };
    const canNext = period !== 'all' && shiftAnchor(period, anchor, 1) <= today;

    // "Người mua gần đây": newest PAID orders in the period, one line per student.
    const recentBuyers: Transaction[] = [];
    for (const t of buyers.data?.items || []) {
        if (t.user && !recentBuyers.some(x => x.user?.id === t.user!.id)) recentBuyers.push(t);
        if (recentBuyers.length === 5) break;
    }

    const txColumns: Column<Transaction>[] = [
        {key: 'inv', header: 'Mã đơn', render: t => <Link to={'/manage/transactions?inv=' + encodeURIComponent(t.invoice_number)}
                                                       className='vt-mg-link vt-num'>{t.invoice_number}</Link>},
        {key: 'user', header: 'Học sinh', emphasis: 'strong', render: t => t.user?.name || '—'},
        {key: 'pkg', header: 'Gói', render: t => t.packages.join(', ') || '—'},
        {key: 'amount', header: 'Số tiền', align: 'right', render: t => <span className='vt-num'>{formatMoney(t.amount)}</span>},
        {key: 'at', header: 'Thời gian', emphasis: 'muted', render: t => <span className='vt-num'>{formatShortDateTime(t.created_at)}</span>},
        {key: 'status', header: 'Trạng thái', render: t => <TxBadge status={t.status}/>},
    ];

    const maxPkg = Math.max(1, ...(s?.by_package || []).map(p => p.orders));

    let main;
    if (error && !s) {
        main = <ErrorState title='Không tải được doanh thu' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                           onRetry={() => refetch()} retrying={isFetching}/>;
    } else if (!s) {
        main = <><div className='vt-mg-stats'><SkeletonCard/><SkeletonCard/><SkeletonCard/></div><SkeletonCard/></>;
    } else {
        main = <>
            <div className='vt-mg-stats'>
                <Card size='md' className='vt-mg-stat'>
                    <span className='vt-mg-stat-label'>Doanh thu</span>
                    <span className='vt-mg-stat-value vt-num'>{formatMoney(s.revenue)}</span>
                    <span className='vt-mg-stat-sub'>{change
                        ? <span className={change.dir === 'up' ? 'vt-mg-up' : change.dir === 'down' ? 'vt-mg-down' : undefined}>{change.text}</span>
                        : 'Chỉ tính đơn thành công'}</span>
                </Card>
                <Card size='md' className='vt-mg-stat'>
                    <span className='vt-mg-stat-label'>Số đơn thành công</span>
                    <span className='vt-mg-stat-value vt-num'>{groupDigits(s.orders.paid)}</span>
                    <span className='vt-mg-stat-sub'>{s.orders.pending} đang xử lý · {s.orders.mismatch} lệch tiền · {s.orders.failed} thất bại</span>
                </Card>
                <Card size='md' className='vt-mg-stat'>
                    <span className='vt-mg-stat-label'>Lượt đã bán</span>
                    <span className='vt-mg-stat-value vt-num'>{groupDigits(s.turns_sold)} lượt</span>
                    <span className='vt-mg-stat-sub'>{groupDigits(s.buyers)} học sinh mua</span>
                </Card>
            </div>

            <Card as='section' className='vt-mg-stack'>
                <div className='vt-mg-row'>
                    <CardTitle as='h2'>Doanh thu theo {UNIT[s.period]}</CardTitle>
                    <span className='vt-muted vt-mg-small'>đơn vị: nghìn đồng</span>
                </div>
                {s.series.length ? <RevenueChart s={s} today={today}/> : <p className='vt-muted'>Chưa có doanh thu trong kỳ.</p>}
                <span className='vt-muted vt-mg-small'>Cột vàng: cao nhất. Cột viền đứt: {UNIT[s.period]} hiện tại, chưa kết thúc. Giờ Việt Nam.</span>
            </Card>

            <section className='vt-mg-stack' aria-label='Đơn hàng gần đây'>
                <div className='vt-mg-row'>
                    <CardTitle as='h2'>Đơn hàng gần đây</CardTitle>
                    <span className='vt-muted vt-mg-small'>Thanh toán qua SePay</span>
                </div>
                {recent.error && !recent.data
                    ? <ErrorState title='Không tải được đơn hàng' onRetry={() => recent.refetch()} retrying={recent.isFetching}/>
                    : !recent.data
                        ? <SkeletonCard label='Đang tải đơn hàng'/>
                        : <Table caption='Đơn hàng gần đây' columns={txColumns} rows={recent.data.items} rowKey={t => t.invoice_number}
                                 minWidth={680} empty='Chưa có đơn nào trong kỳ'/>}
                {recent.data && <div className='vt-mg-row'>
                    <span className='vt-muted vt-num'>{recent.data.items.length} / {groupDigits(recent.data.total)} đơn trong kỳ</span>
                    <Link to='/manage/transactions' className={buttonClass({variant: 'ghost'})}>Xem tất cả trong Giao dịch</Link>
                </div>}
            </section>
        </>;
    }

    const side = <>
        <Card as='section' className='vt-mg-stack'>
            <CardTitle as='h2'>Đơn theo gói</CardTitle>
            {!s ? <Skeleton height={60}/> : !s.by_package.length ? <p className='vt-muted'>Chưa có đơn thành công.</p>
                : s.by_package.map(p => <div key={p.package_id || p.name || ''} className='vt-mg-stack' style={{gap: 6}}>
                    <div className='vt-mg-row'><b>{p.name || '—'}</b><span className='vt-num'>{p.orders} đơn · {formatMoney(p.revenue)}</span></div>
                    <div className='vt-mg-hbar' aria-hidden='true'><span style={{width: (p.orders / maxPkg * 100) + '%'}}/></div>
                </div>)}
            <span className='vt-muted vt-mg-small'>Chỉ tính đơn thành công.</span>
        </Card>
        <Card as='section' className='vt-mg-stack'>
            <CardTitle as='h2'>Người mua gần đây</CardTitle>
            {!buyers.data ? <Skeleton height={60}/> : !recentBuyers.length ? <p className='vt-muted'>Chưa có người mua trong kỳ.</p>
                : recentBuyers.map(t => <div key={t.user!.id} className='vt-mg-row'>
                    <span className='vt-mg-person'><Avatar name={t.user!.name} size={36}/>
                        <Link to={'/manage/users?id=' + encodeURIComponent(t.user!.id)} className='vt-mg-link'>{t.user!.name}</Link></span>
                    <span className='vt-muted vt-num'>{formatShortDateTime(t.created_at).split(' · ')[1]}</span>
                </div>)}
        </Card>
    </>;

    return <div className='vt-mg-page'>
        <PackagesSubNav/>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Người mua &amp; doanh thu</PageTitle>
                <p className='vt-muted'>{s ? periodTitle(s, today) : ' '}</p>
            </div>
            <div className='vt-mg-actions'>
                {period !== 'all' && <>
                    <Button size='sm' aria-label='Kỳ trước' onClick={() => setAnchor(a => shiftAnchor(period, a, -1))}>‹</Button>
                    <Button size='sm' aria-label='Kỳ sau' disabled={!canNext} onClick={() => setAnchor(a => shiftAnchor(period, a, 1))}>›</Button>
                </>}
                <Tabs aria-label='Khoảng thời gian' items={PERIODS} value={period} onChange={pickPeriod}/>
            </div>
        </div>
        <PageColumns main={main} side={<div className='vt-mg-side'>{side}</div>}/>
    </div>;
}
