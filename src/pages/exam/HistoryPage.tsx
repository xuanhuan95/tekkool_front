import {useState} from 'react';
import {Link} from 'react-router-dom';

import {Badge, EmptyState, ErrorState, FilterChip, PageTitle, SegmentedControl, SkeletonCard, buttonClass} from '../../components/ui';
import {useMySubmissions} from '../../queries/submissions';
import type {Submission} from '../../types/submission';
import {errorText, formatMinutes, formatScore, formatTimeDate, withSubject} from '../../lib/format';
import {summarize} from './submissionView';
import './results.css';

type HistoryFilter = 'all' | 'pending';

/** Subject key of a submission: id when BE has one (folder), else the name (bank subject), '' = unknown. */
export const subjectKey = (s: Submission) => s.subject?.id || s.subject?.name || '';

/** Subjects present in the list, in first-seen order (newest attempt first) — the filter chips. */
export function subjectsOf(list: Submission[]): Array<{key: string; name: string}> {
    const out: Array<{key: string; name: string}> = [];
    for (const s of list) {
        const key = subjectKey(s);
        if (key && !out.some(o => o.key === key)) out.push({key, name: s.subject?.name || key});
    }
    return out;
}

function HistoryRow({s}: {s: Submission}) {
    const sum = summarize(s);
    const title = withSubject(s.subject?.name, s.exam_name, ' — ') || 'Bài thi';
    return <li>
        <Link to={'/result/' + s.id} className='vt-card vt-card--md vt-hist-row'>
            <span className='vt-hist-info'>
                <span className='vt-hist-name'>{title}</span>
                <span className='vt-hist-meta'>{formatTimeDate(s.submitted_at)}
                    {s.duration_sec ? ' · làm ' + formatMinutes(s.duration_sec) : ''}</span>
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

/** `/history` (HS-LichSu): own submitted attempts, newest first; filter "Chờ chấm" and by subject. */
export default function HistoryPage() {
    const {data, error, isPending, refetch, isFetching} = useMySubmissions();
    const [filter, setFilter] = useState<HistoryFilter>('all');
    const [subject, setSubject] = useState('');

    const list = data || [];
    const subjects = subjectsOf(list);
    const bySubject = subject ? list.filter(s => subjectKey(s) === subject) : list;
    const pending = bySubject.filter(s => s.pending_count > 0);
    const shown = filter === 'pending' ? pending : bySubject;

    return <div className='vt-res'>
        <PageTitle>Lịch sử làm bài</PageTitle>
        {isPending ? <><SkeletonCard label='Đang tải lịch sử'/><SkeletonCard/></>
            : error ? <ErrorState title='Chưa tải được lịch sử' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                                  onRetry={() => refetch()} retrying={isFetching}/>
            : list.length === 0
                ? <EmptyState title='Chưa có bài nào' description='Làm một đề thi thử để xem kết quả ở đây.'
                              action={<Link to='/exams' className={buttonClass({variant: 'primary'})}>Xem đề thi</Link>}/>
                : <>
                    <SegmentedControl aria-label='Lọc bài làm' value={filter} onChange={setFilter}
                                      items={[{value: 'all', label: 'Tất cả'},
                                              {value: 'pending', label: `Chờ chấm · ${pending.length}`}]}/>
                    {subjects.length > 1 && <div role='group' aria-label='Lọc theo môn' className='vt-hist-filters'>
                        <FilterChip selected={subject === ''} onChange={() => setSubject('')}>Tất cả môn</FilterChip>
                        {subjects.map(m => <FilterChip key={m.key} selected={subject === m.key}
                                                       onChange={on => setSubject(on ? m.key : '')}>{m.name}</FilterChip>)}
                    </div>}
                    {shown.length === 0
                        ? <EmptyState title={filter === 'pending' ? 'Không có bài chờ chấm' : 'Chưa có bài ở môn này'}
                                      description={filter === 'pending' ? 'Mọi bài của bạn đã có điểm.' : undefined}/>
                        : <ul className='vt-hist'>{shown.map(s => <HistoryRow key={s.id} s={s}/>)}</ul>}
                </>}
    </div>;
}
