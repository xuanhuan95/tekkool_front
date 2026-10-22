import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {Button, Card, ErrorState, PageColumns, SkeletonCard, buttonClass} from '../../components/ui';
import {IconBack, IconCheck, IconTicket} from '../../components/ui/icons';
import {useInProgress} from '../../queries/inProgress';
import {useWallet} from '../../queries/wallet';
import {useExamMeta, useSubjects} from '../../queries/student';
import {useMediaQuery, DESKTOP} from '../useMediaQuery';
import {LoadError, hsPath} from './common';
import {durationLabel, partCount, partsFromStructure, structureRows} from './examStatus';
import {minutesLeft, plainText} from '../../lib/format';

/** Scoring rules of the SPT exam (CLAUDE.md, chốt 21/10) — the same for every exam, so static here. */
function ScoringCard() {
    return <Card as='section' className='hs-card-pad' aria-labelledby='hs-scoring'>
        <h2 id='hs-scoring' className='hs-h2'>Cách tính điểm</h2>
        <ul className='hs-list'>
            <li>Trắc nghiệm: 0,25đ mỗi câu đúng (Ngữ văn 0,3đ).</li>
            <li>Đúng/Sai: tối đa 1đ mỗi câu — đúng 1 ý 0,1đ · 2 ý 0,25đ · 3 ý 0,5đ · 4 ý 1đ.</li>
            <li>Trả lời ngắn: 0,25đ mỗi câu đúng.</li>
            <li>Tự luận: giáo viên chấm, điểm cập nhật sau.</li>
        </ul>
        <span className='hs-meta'>Điểm quy về thang 10.</span>
    </Card>;
}

function TipsCard() {
    const tick = <IconCheck size={14} color='var(--vt-ok-icon)'/>;
    return <Card as='section' className='hs-card-pad' aria-labelledby='hs-tips'>
        <h2 id='hs-tips' className='hs-h2'>Lưu ý</h2>
        <div className='hs-tips'>
            <div>{tick}<span>Bài làm được tự lưu liên tục.</span></div>
            <div>{tick}<span>Hết giờ, hệ thống tự nộp bài.</span></div>
            <div>{tick}<span>Bạn có thể thoát và quay lại làm tiếp, miễn còn trong thời gian làm bài. Đồng hồ vẫn chạy khi bạn thoát.</span></div>
        </div>
    </Card>;
}

/** Turn notice + the start button. Starting costs 1 turn unless this exam is already in progress. */
function StartBlock({examId, name}: {examId: string; name: string}) {
    const navigate = useNavigate();
    const wallet = useWallet();
    const {data: cont, isPending: contPending} = useInProgress();
    const resuming = cont?.exam_id === examId;
    const left = wallet.data?.remaining;

    if (resuming) return <>
        <div className='hs-note' role='note'><IconTicket size={18}/>
            <span><b>Bạn đang làm dở đề này</b> ({minutesLeft(cont!.remaining_sec)}). Làm tiếp không tốn thêm lượt.</span></div>
        <div className='hs-start-bar'>
            <Button variant='primary' size='lg' block onClick={() => navigate(hsPath.take(examId, false))}>Làm tiếp →</Button>
        </div>
    </>;

    if (left === 0) return <>
        <div className='hs-note' role='note'><IconTicket size={18}/>
            <span><b>Bạn đã hết lượt thi.</b> Mua thêm gói để làm đề này.</span></div>
        <div className='hs-start-bar'>
            <Link to={hsPath.packages} className={buttonClass({variant: 'primary', size: 'lg', block: true})}>Mua thêm lượt</Link>
        </div>
    </>;

    return <>
        <div className='hs-note' role='note'><IconTicket size={18}/>
            <span><b>Bắt đầu sẽ dùng 1 lượt.</b>{left != null ? ` Bạn còn ${left} lượt.` : ''}</span></div>
        <div className='hs-start-bar'>
            {/* ?lam_lai=1: the student chose to start; the exam screen handles 402 (out of turns) itself. */}
            <Button variant='primary' size='lg' block disabled={contPending && !cont}
                    aria-label={'Bắt đầu làm bài ' + name}
                    onClick={() => navigate(hsPath.take(examId, true))}>Bắt đầu làm bài</Button>
        </div>
    </>;
}

/** HS-ChiTietDe: exam metadata, structure, scoring, notes, start. */
export default function ExamDetailPage() {
    const {examId} = useParams();
    const [params] = useSearchParams();
    const web = useMediaQuery(DESKTOP);
    const meta = useExamMeta(examId);
    const subjects = useSubjects();
    const monParam = params.get('mon') || undefined;
    const back = <Link to={hsPath.exams(monParam)} className='hs-back'><IconBack size={18}/>Danh sách đề</Link>;

    if (meta.isPending) return <div className='hs-page'>{back}<SkeletonCard/><SkeletonCard/></div>;
    if (meta.isError) {
        const code = (meta.error as {code?: number}).code;
        return <div className='hs-page'>{back}
            {code === 404
                ? <ErrorState title='Không tìm thấy đề này' description='Đề có thể đã bị giáo viên xoá hoặc đổi.'/>
                : <LoadError error={meta.error} onRetry={() => meta.refetch()} what='thông tin đề'/>}
        </div>;
    }

    const exam = meta.data;
    const name = plainText(exam.name) || 'Đề không tên';
    // Subject label: the ?mon we came from, else the exam's own folder when it is a subject.
    const subject = subjects.data?.find(s => s.id === (monParam || exam.folder));
    const parts = partsFromStructure(exam.parts) || partCount(exam);
    const structure = structureRows(exam.parts);
    // Older API without `parts`: titles of the bank structure only.
    const titles = structure.rows.length ? [] : (exam.cau_truc || []).filter(c => c.tieu_de);

    const info = <>
        <div className='hs-head'>
            {subject && <span className='hs-meta'>Môn {subject.name}</span>}
            <h1 className='hs-head-title'>{name}</h1>
        </div>
        <div className='hs-facts'>
            <div className='hs-fact'><span className='hs-meta'>Thời gian</span><b>{durationLabel(exam.duration)}</b></div>
            <div className='hs-fact'><span className='hs-meta'>Số phần</span><b>{parts > 0 ? parts + ' phần' : '—'}</b></div>
            <div className='hs-fact'><span className='hs-meta'>Thang điểm</span><b>10</b></div>
        </div>
        {(structure.rows.length > 0 || titles.length > 0) &&
            <Card as='section' className='hs-card-pad' aria-labelledby='hs-structure'>
                <h2 id='hs-structure' className='hs-h2'>Cấu trúc đề</h2>
                <div className='hs-parts'>
                    {structure.rows.map((r, i) => <div key={i}>
                        <span>{r.name && <b>{r.name}</b>}{r.name && r.kind ? ' · ' : ''}{r.kind}</span>
                        <span className='hs-parts-amount'>{r.amount}</span>
                    </div>)}
                    {titles.map((c, i) => <div key={i}><span>{c.tieu_de}</span></div>)}
                </div>
                {structure.total && <span className='hs-meta'>{structure.total}</span>}
                {exam.parts?.some(p => p.approx) &&
                    <span className='hs-meta'>Đề rút ngẫu nhiên từ ngân hàng mỗi lần làm — số câu là ước tính.</span>}
            </Card>}
    </>;
    const start = <StartBlock examId={exam.id} name={name}/>;

    if (!web) return <div className='hs-page'>{back}{info}<ScoringCard/>{start}<TipsCard/></div>;
    return <div className='hs-page'>
        {back}
        <PageColumns main={<>{info}<ScoringCard/><TipsCard/></>}
                     side={<Card as='aside' className='hs-card-pad' aria-label='Bắt đầu làm bài'>{start}</Card>}/>
    </div>;
}
