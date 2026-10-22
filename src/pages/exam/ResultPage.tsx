import {Link, useNavigate, useParams} from 'react-router-dom';

import {Badge, Button, Card, ErrorState, PageTitle, SkeletonCard, buttonClass} from '../../components/ui';
import {IconStar} from '../../components/ui/icons';
import {useSubmission} from '../../queries/submissions';
import type {ApiError} from '../../services/api';
import {formatDecimal} from './paper';
import {
    formatMinutes, formatRankPoints, formatScore, formatTimeDate, parseServerDate, partRows, summarize, toScale10,
} from './submissionView';
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
            <span className='vt-res-meta'>Đã nộp lúc {formatTimeDate(parseServerDate(data.submitted_at))}</span>
            <PageTitle>{data.exam_name || 'Bài thi'}</PageTitle>
        </div>

        <Card className='vt-score' aria-label='Điểm của bạn'>
            <div className='vt-score-top'>
                <span className='vt-score-label'>Điểm của bạn</span>
                {sum.isProvisional
                    ? <Badge tone='sun-strong'>Chờ chấm tự luận</Badge>
                    : <Badge tone='ok'>Đã chấm</Badge>}
            </div>
            <div className='vt-score-big'>
                <span className='vt-score-num'>{formatScore(sum.score10)}</span>
                <span className='vt-score-of'>/ 10</span>
            </div>
            {sum.isProvisional &&
                <span className='vt-score-note'>Tạm tính · chờ chấm {formatDecimal(sum.pendingPoints10)}đ tự luận</span>}
            {scaleNote && <span className='vt-score-note'>Thang 10{scaleNote}</span>}
            {data.auto_submitted && <span className='vt-score-note'>Hết giờ — hệ thống đã tự nộp bài.</span>}
            <div className='vt-score-time'>Thời gian làm: <b>{formatMinutes(data.duration_sec)}</b></div>
        </Card>

        {rows.length > 0 && <Card className='vt-parts-card'>
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
                        <th scope='row'>{sum.isProvisional ? 'Tạm tính' : 'Tổng'}</th>
                        <td/>
                        <td><b>{formatScore(toScale10(data.score, data.max_score))}</b> <span className='vt-muted'>/ 10</span></td>
                    </tr>
                </tbody>
            </table>
        </Card>}

        {data.max_score > 0 && <Card size='md' className='vt-rankpts'>
            <span className='vt-rankpts-title'><IconStar size={20}/> +{formatRankPoints(sum.rankPoints)} điểm xếp hạng tuần</span>
            <span className='vt-rankpts-desc'>
                10 (hoàn thành đề) + {formatScore(sum.score10)} (điểm bài), làm tròn 1 chữ số. Chỉ tính lần làm tốt
                nhất của mỗi đề trong tuần.{sum.isProvisional && ' Sẽ cập nhật khi chấm xong tự luận.'}
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
