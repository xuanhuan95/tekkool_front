import {useState} from 'react';
import {Link} from 'react-router-dom';

import {Badge, EmptyState, ErrorState, PageTitle, SegmentedControl, SkeletonCard, buttonClass} from '../../components/ui';
import {useMySubmissions} from '../../queries/submissions';
import type {Submission} from '../../types/submission';
import {formatMinutes, formatScore, formatTimeDate, parseServerDate, summarize} from './submissionView';
import './results.css';

type HistoryFilter = 'all' | 'pending';

function HistoryRow({s}: {s: Submission}) {
    const sum = summarize(s);
    return <li>
        <Link to={'/result/' + s.id} className='vt-card vt-card--md vt-hist-row'>
            <span className='vt-hist-info'>
                <span className='vt-hist-name'>{s.exam_name || 'Bài thi'}</span>
                <span className='vt-hist-meta'>
                    {formatTimeDate(parseServerDate(s.submitted_at))} · làm {formatMinutes(s.duration_sec)}
                </span>
                <span>{sum.isProvisional
                    ? <Badge tone='sun-strong'>Chờ chấm tự luận</Badge>
                    : <Badge tone='ok'>Đã chấm</Badge>}</span>
            </span>
            <span className='vt-hist-score'>
                <span className='vt-hist-num'>{formatScore(sum.score10)}</span>
                <span className='vt-hist-of'>{sum.isProvisional ? 'tạm tính' : '/ 10'}</span>
            </span>
        </Link>
    </li>;
}

/**
 * `/history` (HS-LichSu): own submitted attempts, newest first, filter "Chờ chấm".
 * ponytail: no subject filter — `exam/my_submissions` does not return the subject (asked BE).
 */
export default function HistoryPage() {
    const {data, error, isPending, refetch, isFetching} = useMySubmissions();
    const [filter, setFilter] = useState<HistoryFilter>('all');

    const list = data || [];
    const pending = list.filter(s => s.pending_count > 0);
    const shown = filter === 'pending' ? pending : list;

    return <div className='vt-res'>
        <PageTitle>Lịch sử làm bài</PageTitle>
        {isPending ? <><SkeletonCard label='Đang tải lịch sử'/><SkeletonCard/></>
            : error ? <ErrorState title='Chưa tải được lịch sử' description='Kiểm tra mạng rồi thử lại.'
                                  onRetry={() => refetch()} retrying={isFetching}/>
            : list.length === 0
                ? <EmptyState title='Chưa có bài nào' description='Làm một đề thi thử để xem kết quả ở đây.'
                              action={<Link to='/exams' className={buttonClass({variant: 'primary'})}>Xem đề thi</Link>}/>
                : <>
                    <SegmentedControl aria-label='Lọc bài làm' value={filter} onChange={setFilter}
                                      items={[{value: 'all', label: 'Tất cả'},
                                              {value: 'pending', label: `Chờ chấm · ${pending.length}`}]}/>
                    {shown.length === 0
                        ? <EmptyState title='Không có bài chờ chấm' description='Mọi bài của bạn đã có điểm.'/>
                        : <ul className='vt-hist'>{shown.map(s => <HistoryRow key={s.id} s={s}/>)}</ul>}
                </>}
    </div>;
}
