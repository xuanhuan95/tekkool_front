import {Link, useNavigate, useParams} from 'react-router-dom';

import {Badge, Button, Card, ErrorState, PageTitle, SkeletonCard, buttonClass} from '../../components/ui';
import {IconStar} from '../../components/ui/icons';
import {useSubmission} from '../../queries/submissions';
import type {ApiError} from '../../services/api';
import {formatDecimal, formatMinutes, formatPoints, formatScore, formatTimeDate} from '../../lib/format';
import {partRows, summarize} from './submissionView';
import './results.css';

export function loadError(e: unknown): string {
    const err = e as ApiError | null;
    if (err?.code === 403) return 'Bạn không xem được bài làm này.';
    if (err?.code === 404) return 'Không tìm thấy bài làm.';
    return err?.error || 'Không tải được kết quả — kiểm tra mạng rồi thử lại.';
}

/**
 * `/result/:id` (HS-KetQua): score /10 (provisional while essays wait), table by part I–IV,
 * + weekly ranking points, links to the review. Reads `exam/submission/<id>`.
 */
export default function ResultPage() {
    const {id} = useParams();
    const navigate = useNavigate();
    const {data, error, isPending, refetch, isFetching} = useSubmission(id);

    if (isPending) return <div className='vt-res'><SkeletonCard label='Đang tải kết quả'/><SkeletonCard/></div>;
    if (error || !data) {
        return <div className='vt-res'>
            <ErrorState title='Chưa xem được kết quả' description={loadError(error)} onRetry={() => refetch()} retrying={isFetching}/>
        </div>;
    }

    const sum = summarize(data);
    const rows = partRows(data);
    const scaleNote = data.max_score && Math.abs(data.max_score - 10) > 1e-6
        ? ` (quy đổi từ ${formatDecimal(data.score)} / ${formatDecimal(data.max_score)})` : '';

    return <div className='vt-res'>
        <div className='vt-res-head'>
            <span className='vt-res-meta'>
                {data.subject?.name && <>Môn {data.subject.name} · </>}Đã nộp lúc {formatTimeDate(data.submitted_at)}
            </span>
            <PageTitle>{data.exam_name || 'Bài thi'}</PageTitle>
        </div>

        {/* Q20: essay still waiting → no provisional score, no parts table, no ranking points (Q19: not on the board yet). */}
        {sum.isProvisional && <Card className='vt-score' aria-label='Đã nộp bài'>
            <div className='vt-score-top'><Badge tone='sun-strong'>Chờ chấm tự luận</Badge></div>
            <p className='vt-score-done'>Chúc mừng bạn đã hoàn thành bài thi của mình. Bài thi của bạn sẽ được giáo viên phụ trách chấm điểm</p>
            {data.auto_submitted && <span className='vt-score-note'>Hết giờ — hệ thống đã tự nộp bài.</span>}
            <div className='vt-score-time'>Thời gian làm: <b>{formatMinutes(data.duration_sec)}</b>
                {data.duration_min ? <span className='vt-muted'> / {data.duration_min} phút</span> : null}</div>
        </Card>}

        {!sum.isProvisional && <Card className='vt-score' aria-label='Điểm của bạn'>
            <div className='vt-score-top'>
                <span className='vt-score-label'>Điểm của bạn</span>
                <Badge tone='ok'>Đã chấm</Badge>
            </div>
            <div className='vt-score-big'>
                <span className='vt-score-num'>{formatScore(sum.score10)}</span>
                <span className='vt-score-of'>/ 10</span>
            </div>
            {scaleNote && <span className='vt-score-note'>Thang 10{scaleNote}</span>}
            {data.auto_submitted && <span className='vt-score-note'>Hết giờ — hệ thống đã tự nộp bài.</span>}
            <div className='vt-score-time'>Thời gian làm: <b>{formatMinutes(data.duration_sec)}</b>
                {data.duration_min ? <span className='vt-muted'> / {data.duration_min} phút</span> : null}</div>
        </Card>}

        {!sum.isProvisional && rows.length > 0 && <Card className='vt-parts-card'>
            <table className='vt-parts'>
                <caption className='vt-sr-only'>Điểm theo phần</caption>
                <thead><tr><th scope='col'>Phần</th><th scope='col'>Đúng</th><th scope='col'>Điểm</th></tr></thead>
                <tbody>
                    {rows.map(r => <tr key={r.name}>
                        <th scope='row'>{r.name}</th>
                        <td className={r.correct === '—' ? 'vt-muted' : undefined}>{r.correct}</td>
                        <td>
                            {r.pending ? <Badge tone='sun'>Chờ chấm</Badge> : <b>{formatScore(r.score || 0)}</b>}
                            {' '}<span className='vt-muted'>/ {formatDecimal(r.maxScore)}</span>
                        </td>
                    </tr>)}
                    <tr className='vt-parts-total'>
                        <th scope='row'>Tổng</th>
                        <td/>
                        <td><b>{formatScore(sum.score10)}</b> <span className='vt-muted'>/ 10</span></td>
                    </tr>
                </tbody>
            </table>
        </Card>}

        {/* The number comes from BE (ranking_contribution) — same rule as the weekly board, never recomputed here. */}
        {!sum.isProvisional && sum.rankPoints !== null && <Card size='md' className='vt-rankpts'>
            <span className='vt-rankpts-title'><IconStar size={20}/> +{formatPoints(sum.rankPoints)} điểm xếp hạng tuần</span>
            <span className='vt-rankpts-desc'>
                {sum.rankPoints > 0
                    ? '10 (hoàn thành đề) + điểm bài (thang 10), làm tròn 1 chữ số. Chỉ tính lần làm tốt nhất của mỗi đề trong tuần.'
                    : 'Lần này không cộng thêm: bảng tuần chỉ tính lần làm tốt nhất của mỗi đề trong tuần.'}
            </span>
        </Card>}

        {data.teacher_comment && <Card size='md'>
            <span className='vt-rv-label'>Nhận xét của giáo viên</span>
            <p className='vt-rv-comment'>{data.teacher_comment}</p>
        </Card>}

        <div className='vt-res-actions'>
            <Link to={'/review/' + data.id} className={buttonClass({variant: 'primary', block: true})}>Xem lại bài</Link>
            <Button variant='secondary' block onClick={() => navigate('/')}>Về trang chủ</Button>
        </div>
    </div>;
}
