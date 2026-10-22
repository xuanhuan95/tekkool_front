import {useMemo, useState} from 'react';
import {Link, useParams} from 'react-router-dom';

import {Badge, Card, EmptyState, ErrorState, PageTitle, SkeletonCard, Tabs, buttonClass} from '../../components/ui';
import type {BadgeTone} from '../../components/ui';
import renderHTML from '../../components/SafeHtml';
import {useSubmission} from '../../queries/submissions';
import {formatDecimal} from './paper';
import {loadError} from './ResultPage';
import {buildReview, filterReview, formatScore, reviewBadge, summarize} from './submissionView';
import type {ReviewFilter, ReviewItem} from './submissionView';
import './results.css';

const FILTERS: Array<{value: ReviewFilter; label: string}> = [
    {value: 'all', label: 'Tất cả'}, {value: 'wrong', label: 'Sai'}, {value: 'correct', label: 'Đúng'},
    {value: 'essay', label: 'Tự luận'},
];

const TONE: Record<ReviewItem['status'], BadgeTone> = {
    correct: 'ok', wrong: 'err', partial: 'sun', pending: 'sun-strong', graded: 'ok',
};

const tf = (v: boolean | null) => v === null ? '—' : v ? 'Đ' : 'S';

function ChoiceBody({item}: {item: ReviewItem}) {
    return <div className='vt-rv-opts'>
        {item.options.map(o => {
            const cls = o.correct ? 'vt-rv-opt vt-rv-opt--right' : o.chosen ? 'vt-rv-opt vt-rv-opt--wrong' : 'vt-rv-opt';
            return <div key={o.key} className={cls}>
                <span className='vt-rv-letter' aria-hidden='true'>{o.key}</span>
                <span className='vt-rv-optbody'><span className='vt-sr-only'>{o.key}. </span>{renderHTML(o.html)}</span>
                {o.chosen && <span className='vt-rv-tag'>Bạn chọn</span>}
                {o.correct && <span className='vt-rv-tag'>{o.chosen ? ' · ' : ''}Đáp án đúng</span>}
            </div>;
        })}
        {!item.options.some(o => o.chosen) && <span className='vt-rv-hint'>Bạn chưa chọn đáp án.</span>}
    </div>;
}

function TrueFalseBody({item}: {item: ReviewItem}) {
    return <div className='vt-rv-tf'>
        {item.statements.map(s => <div key={s.key} className='vt-rv-tfrow'>
            <span className={'vt-rv-mark ' + (s.ok ? 'vt-rv-ok' : 'vt-rv-bad')} aria-label={s.ok ? 'Đúng' : 'Sai'}>
                {s.ok ? '✓' : '✗'}</span>
            <span className='vt-rv-tftext'><b>{s.key})</b> {renderHTML(s.html)}</span>
            <span className='vt-rv-tfmine'>Bạn: {tf(s.answer)}
                {!s.ok && s.correct !== null && <> · <b className='vt-rv-ok' aria-label={'Đáp án đúng ' + tf(s.correct)}>
                    {tf(s.correct)}</b></>}
            </span>
        </div>)}
    </div>;
}

function TextBody({item}: {item: ReviewItem}) {
    const empty = !item.answer.replace(/<[^>]*>/g, '').trim();
    return <>
        <span className='vt-rv-label'>Bài làm của bạn</span>
        {empty ? <span className='vt-rv-hint'>(bỏ trống)</span>
            : <div className='vt-rv-answer'>{item.kind === 'essay' ? renderHTML(item.answer) : item.answer}</div>}
        {item.kind === 'short' && item.correctText && item.status !== 'correct' &&
            <span className='vt-rv-label'>Đáp án đúng: <b className='vt-rv-ok'>{item.correctText.split('|').join(' hoặc ')}</b></span>}
        {item.kind === 'essay' && item.status === 'pending' &&
            <span className='vt-rv-hint'>Bạn sẽ nhận thông báo khi có điểm và nhận xét.</span>}
    </>;
}

function ReviewCard({item}: {item: ReviewItem}) {
    const title = item.kind === 'essay' ? `Câu ${item.number} · ${formatDecimal(item.maxScore)}đ` : `Câu ${item.number}`;
    return <>
        {item.passage && <div className='vt-rv-passage'>{renderHTML(item.passage)}</div>}
        <Card as='article' className='vt-rv' aria-label={title}>
            <div className='vt-rv-head'>
                <span className='vt-rv-num'>{title}</span>
                <Badge tone={TONE[item.status]}>{reviewBadge(item)}</Badge>
            </div>
            {item.prompt && <div className='vt-rv-prompt'>{renderHTML(item.prompt)}</div>}
            {item.kind === 'choice' && <ChoiceBody item={item}/>}
            {item.kind === 'truefalse' && <TrueFalseBody item={item}/>}
            {(item.kind === 'short' || item.kind === 'essay') && <TextBody item={item}/>}
            {item.comment && <div className='vt-rv-comment'><b>Giáo viên:</b> {item.comment}</div>}
        </Card>
    </>;
}

/**
 * `/review/:id` (HS-XemLai): every question with the student's answer, right/wrong per statement
 * and the correct answer — BE only returns those in `exam/submission/<id>`, i.e. after submitting.
 */
export default function ReviewPage() {
    const {id} = useParams();
    const {data, error, isPending, refetch, isFetching} = useSubmission(id);
    const [filter, setFilter] = useState<ReviewFilter>('all');
    const items = useMemo(() => buildReview(data?.answers || []), [data]);

    if (isPending) return <div className='vt-res'><SkeletonCard label='Đang tải bài làm'/><SkeletonCard/></div>;
    if (error || !data) {
        return <div className='vt-res'>
            <ErrorState title='Chưa xem được bài làm' description={loadError(error)} onRetry={() => refetch()} retrying={isFetching}/>
        </div>;
    }

    const sum = summarize(data);
    const shown = filterReview(items, filter);

    return <div className='vt-res'>
        <div className='vt-res-head'>
            <Link to={'/result/' + data.id} className={buttonClass({variant: 'ghost', size: 'sm'}) + ' vt-res-back'}>← Kết quả</Link>
            <PageTitle>Xem lại bài</PageTitle>
            <span className='vt-res-meta'>{data.exam_name || 'Bài thi'} · {sum.isProvisional ? 'tạm tính ' : ''}
                {formatScore(sum.score10)} / 10</span>
        </div>
        <Tabs aria-label='Lọc câu' items={FILTERS} value={filter} onChange={setFilter} idPrefix='rv'/>
        <div role='tabpanel' id={'rv-panel-' + filter} aria-labelledby={'rv-tab-' + filter} className='vt-res'>
            {shown.length === 0
                ? <EmptyState title={items.length ? 'Không có câu nào ở mục này' : 'Bài làm không có câu hỏi'}
                              description={filter === 'wrong' ? 'Bạn không sai câu nào máy chấm.' : undefined}/>
                : shown.map(it => <ReviewCard key={it.number} item={it}/>)}
        </div>
    </div>;
}
