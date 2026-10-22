import {Link} from 'react-router-dom';

import {Badge, Card, EmptyState, Medal, PageColumns, Skeleton, SkeletonCard, Table, buttonClass} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useInProgress} from '../../queries/inProgress';
import {useWallet} from '../../queries/wallet';
import {useBoard, useMySubmissions, useSubjects} from '../../queries/student';
import type {SubjectSummary} from '../../types/student';
import type {Submission} from '../../types/submission';
import {useMediaQuery, DESKTOP} from '../useMediaQuery';
import {ContinueCard, LoadError, PageHead, TitleCard, greetName, hsPath} from '../hs/common';
import {formatDayMonth, formatPoints, formatScore, minutesLeft, plainText, score10} from '../../lib/format';
import {studentTitle} from '../hs/title';

/** Subjects shown on the phone home before "Xem cả N môn" (design: 6). */
const MOBILE_SUBJECTS = 6;

function subjectMeta(s: SubjectSummary): string {
    return s.exams + ' đề · ' + (s.done > 0 ? 'đã làm ' + s.done : 'chưa làm');
}

function SubjectGrid({subjects}: {subjects: SubjectSummary[]}) {
    return <div className='hs-subjects'>
        {subjects.map(s => <Link key={s.id} to={hsPath.exams(s.id)} className='hs-subject'>
            <b>{s.name}</b><span className='hs-meta'>{subjectMeta(s)}</span>
        </Link>)}
    </div>;
}

function SubjectsSection({web}: {web: boolean}) {
    const q = useSubjects();
    const head = (count?: number) => web
        ? <div className='hs-col2'><h2 className='hs-h2'>Chọn môn</h2>
            <span className='hs-meta'>{count != null ? count + ' môn thi SPT · ' : ''}mỗi lần làm đề trừ 1 lượt</span></div>
        : <div className='hs-row'><h2 className='hs-h2'>Chọn môn</h2>
            {count != null && count > MOBILE_SUBJECTS && <Link to={hsPath.exams()} className='vt-link'>Xem cả {count} môn</Link>}</div>;

    if (q.isPending) return <section className='hs-sec' aria-busy='true'>{head()}
        <div className='hs-subjects'>{Array.from({length: 6}, (_, i) => <Skeleton key={i} height={62} shape='card'/>)}</div>
    </section>;
    if (q.isError) return <section className='hs-sec'>{head()}<LoadError error={q.error} onRetry={() => q.refetch()} what='danh sách môn'/></section>;
    const list = q.data;
    return <section className='hs-sec'>
        {head(list.length)}
        {list.length === 0
            ? <EmptyState title='Chưa có môn thi nào' description='Giáo viên đang soạn đề, bạn quay lại sau nhé.'/>
            : <SubjectGrid subjects={web ? list : list.slice(0, MOBILE_SUBJECTS)}/>}
    </section>;
}

function TurnsCard({web}: {web: boolean}) {
    const w = useWallet();
    if (w.isPending) return <SkeletonCard label='Đang tải lượt thi'/>;
    // Wallet down: the header pill is gone too; a small error card beats a wrong "0 lượt".
    if (w.isError) return <LoadError error={w.error} onRetry={() => w.refetch()} what='số lượt thi'/>;
    const n = w.data.remaining;
    const buy = <Link to={hsPath.packages} className={buttonClass({variant: 'primary', block: web})}>
        {web ? 'Mua thêm lượt' : 'Mua thêm'}</Link>;
    return <Card as='section' className={'hs-turns' + (web ? ' hs-turns--web' : '')} aria-label='Lượt thi'>
        <div className='hs-col2'>
            <span className='hs-meta'>{web ? 'Lượt thi của bạn' : 'Lượt thi còn lại'}</span>
            <span className='hs-big vt-num'>{n} lượt</span>
            <span className='hs-meta'>Không hết hạn{web && w.data.bought ? ` · đã mua ${w.data.bought}, đã dùng ${w.data.used}` : ''}</span>
        </div>
        {buy}
    </Card>;
}

function TitleBlock({web}: {web: boolean}) {
    const subs = useMySubmissions();
    const info = studentTitle(subs.data);
    // No data or no title under the temporary rule → nothing (see hs/title.ts).
    return info ? <TitleCard info={info} web={web}/> : null;
}

function WeekTop() {
    const q = useBoard('week', null, 3);
    if (q.isPending) return <SkeletonCard label='Đang tải xếp hạng'/>;
    if (q.isError) return null;   // side widget: the full board has its own error state
    const b = q.data;
    const me = b.me;
    return <Card as='section' className='hs-mini' aria-label='Top tuần này'>
        <div className='hs-row'><h2 className='hs-h2'>Top tuần này</h2><Link to={hsPath.ranking} className='vt-link'>Xem tất cả</Link></div>
        {b.entries.length === 0
            ? <p className='hs-meta'>Tuần này chưa có ai hoàn thành đề. Làm đề đầu tiên để lên bảng!</p>
            : b.entries.map(e => <div key={(e.rank ?? 0) + e.name} className='hs-mini-row'>
                {e.rank != null && <Medal rank={e.rank}/>}
                <span>{e.is_me ? 'Bạn' : e.name}</span>
                <b>{formatPoints(e.points)}</b>
            </div>)}
        {me && !b.entries.some(e => e.is_me) && <div className='hs-mini-row hs-mini-me'>
            <span/>
            <span>{me.rank != null ? 'Bạn: hạng ' + me.rank : 'Bạn: chưa có điểm tuần này'}</span>
            <b>{formatPoints(me.points)}</b>
        </div>}
        <span className='hs-meta'>10 điểm mỗi đề hoàn thành + điểm bài (lần tốt nhất).</span>
    </Card>;
}

const RECENT = 4;

function RecentTable() {
    const q = useMySubmissions();
    const head = <div className='hs-row'><h2 className='hs-h2'>Bài làm gần đây</h2><Link to={hsPath.history} className='vt-link'>Xem lịch sử</Link></div>;
    if (q.isPending) return <section className='hs-sec'>{head}<SkeletonCard/></section>;
    if (q.isError) return <section className='hs-sec'>{head}<LoadError error={q.error} onRetry={() => q.refetch()} what='bài làm gần đây'/></section>;
    const rows = q.data.slice(0, RECENT);
    const pending = (s: Submission) => s.status === 'GRADING' || s.pending_count > 0;
    const cols: Column<Submission>[] = [
        {key: 'name', header: 'Đề', emphasis: 'strong',
         render: s => <Link to={hsPath.result(s.id)} className='vt-link'>{plainText(s.exam_name) || 'Đề không tên'}</Link>},
        {key: 'date', header: 'Ngày', emphasis: 'muted', render: s => formatDayMonth(s.submitted_at)},
        {key: 'score', header: 'Điểm /10', align: 'right', emphasis: 'bold',
         render: s => formatScore(score10(s.score, s.max_score)) + (pending(s) ? '*' : '')},
        {key: 'status', header: 'Trạng thái',
         render: s => pending(s) ? <Badge tone='sun'>Chờ chấm tự luận</Badge> : <Badge tone='ok'>Đã chấm</Badge>},
    ];
    return <section className='hs-sec'>
        {head}
        {rows.length === 0
            ? <EmptyState title='Chưa có bài nào' description='Chọn một môn ở trên và làm đề đầu tiên nhé.'/>
            : <Table caption='Bài làm gần đây' columns={cols} rows={rows} rowKey={s => s.id} minWidth={480}/>}
        {rows.some(pending) && <p className='hs-meta'>* Tạm tính, chưa gồm điểm tự luận.</p>}
    </section>;
}

/** HS-TrangChu (phone) / HS-Web-TrangChu (≥1024px). */
export default function StudentHome() {
    const web = useMediaQuery(DESKTOP);
    const name = useAuthStore(s => s.user?.name);
    const {data: cont} = useInProgress();
    const hello = 'Chào ' + (greetName(name) || 'bạn') + '!';

    if (!web) return <div className='hs-page'>
        <PageHead title={hello} sub='Hôm nay mình luyện tiếp nhé.'/>
        <TurnsCard web={false}/>
        {cont && <ContinueCard cont={cont}/>}
        <SubjectsSection web={false}/>
        <TitleBlock web={false}/>
    </div>;

    const sub = cont
        ? `Bài ${cont.subject || plainText(cont.exam_name)} đang làm dở ${minutesLeft(cont.remaining_sec)}. Làm tiếp hay chọn đề môn khác?`
        : 'Hôm nay mình luyện tiếp nhé. Chọn môn để bắt đầu.';
    return <div className='hs-page'>
        <PageHead title={hello} sub={sub}/>
        <PageColumns
            main={<>
                {cont && <ContinueCard cont={cont} web/>}
                <SubjectsSection web/>
                <RecentTable/>
            </>}
            side={<>
                <TurnsCard web/>
                <TitleBlock web/>
                <WeekTop/>
            </>}/>
    </div>;
}
