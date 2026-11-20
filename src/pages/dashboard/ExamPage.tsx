import {Fragment} from 'react';
import type {ReactNode} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';

import {Badge, Button, EmptyState, ErrorState, Loading, PageTitle, StatusBadge, buttonClass} from '../../components/ui';
import {errorText, formatScore, stripPoints} from '../../lib/format';
import {useExamDetail, useFolders} from '../../queries/exams';
import type {ExamDetail} from '../../types/exam';
import ExamMenu from './ExamMenu';
import {SOURCE_LABEL, examName, isPublished, partContent, statsText, whenText} from './examMeta';
import {SourceBadge} from './SubjectDetail';
import {useExamActions} from './useExamActions';

/**
 * `/exam/:id` — one exam at a glance (canvas APP-teacher-subjects-v2-exam-bank / exam-word): structure by part,
 * how it was made, submissions, and the same actions as the row. No questions here (that is "Sửa").
 */
export default function ExamPage() {
    const {examId = ''} = useParams();
    const navigate = useNavigate();
    const {data: e, isError, error, isFetching, refetch} = useExamDetail(examId);
    const folders = useFolders();
    const subjects = (folders.data || []).filter(f => !f.parent);
    const actions = useExamActions(subjects, () => navigate(e?.folder ? '/subject/' + e.folder.id : '/', {replace: true}));

    if (isError) {
        const code = (error as {code?: number} | null)?.code;
        return code === 404 || code === 403
            ? <EmptyState title={code === 404 ? 'Không tìm thấy đề này' : 'Cô không xem được đề này'} description='Đề đã bị xoá hoặc thuộc giáo viên khác.'
                          action={<Link to='/' className={buttonClass({variant: 'secondary'})}>Về Môn &amp; đề</Link>}/>
            : <ErrorState title='Không tải được đề' description={errorText(error, 'Thử lại sau. Đề của cô vẫn an toàn.')}
                          onRetry={() => refetch()} retrying={isFetching}/>;
    }
    if (!e) return <Loading/>;

    const ref = {id: e.id, name: e.name, status: e.status, has_submissions: e.submissions.total > 0, from: e.folder?.id || ''};
    const when = whenText(e.updated_at);
    return <div className='vt-th-page'>
        <nav className='vt-th-crumb' aria-label='Đường dẫn'>
            <Link className='vt-link' to='/'>Môn &amp; đề</Link>›
            {e.folder ? <Link className='vt-link' to={'/subject/' + e.folder.id}>{e.folder.name}</Link> : null}{e.folder ? '›' : null}
            <span>Đề</span>
        </nav>
        <div className='vt-th-xhead'>
            <div>
                <PageTitle>{examName(e)}</PageTitle>
                <div className='vt-th-line1'>
                    <StatusBadge status={isPublished(e) ? 'published' : 'draft'}/>
                    <SourceBadge source={e.source}/>
                    <span className='vt-th-muted'>{[statsText(e), when && 'cập nhật ' + when].filter(Boolean).join(' · ')}</span>
                </div>
            </div>
            <div className='vt-th-xacts'>
                {!isPublished(e) && <Button variant='primary' disabled={actions.busy} onClick={() => actions.publish(ref)}>Xuất bản</Button>}
                <Link to={'/edit-exam/' + e.id} className={buttonClass({variant: 'secondary'})}>Sửa</Link>
                <Link to={`/do-exam/${e.id}?lam_lai=1`} className={buttonClass({variant: 'secondary'})}>Làm thử</Link>
                <ExamMenu exam={ref} submissions={e.submissions.total} actions={actions}/>
            </div>
        </div>
        <div className='vt-th-xgrid'>
            <Structure e={e}/>
            <div className='vt-th-detail'>
                <Origin e={e}/>
                <Submissions e={e}/>
            </div>
        </div>
        {actions.dialogs}
    </div>;
}

function Structure({e}: {e: ExamDetail}) {
    const drawn = e.source === 'bank';
    let group: string | null | undefined;
    return <section className='vt-card vt-th-card'>
        <h2>Cấu trúc đề</h2>
        {!e.parts.length ? <EmptyState title='Đề chưa có phần nào' description='Bấm “Sửa” để thêm câu hỏi.'/>
            : <table className='vt-th-parts'>
                <thead><tr><th>Phần</th><th>Nội dung</th><th>Câu</th><th>Điểm</th></tr></thead>
                <tbody>{e.parts.map((p, i) => {
                    const head = p.group_title && p.group_title !== group ? p.group_title : null;
                    group = p.group_title || group;
                    return <Fragment key={i}>
                        {head && <tr><th scope='row' colSpan={4}>{head}</th></tr>}
                        <tr><th scope='row'>{stripPoints(p.title)}</th><td>{partContent(p, drawn)}</td><td>{p.question_count}</td><td>{formatScore(p.points_total)}</td></tr>
                    </Fragment>;
                })}</tbody>
                <tfoot><tr><th scope='row'>Cả đề</th><td></td><td>{e.question_count}</td><td>{formatScore(e.points_total)}</td></tr></tfoot>
            </table>}
        {drawn && <p className='vt-th-note'>Câu hỏi không cố định: mỗi học sinh vào thi được rút một đề khác theo khung này. Bấm “Làm thử” để xem một lần rút.</p>}
    </section>;
}

/** "Tạo bằng cách nào": facts depend on the source; nothing to say (old exam) → no card. */
function Origin({e}: {e: ExamDetail}) {
    const created = whenText(e.created_at, true);
    const shortage = e.draw?.shortage || [];
    const rows: [string, ReactNode][] = [];
    if (e.source) rows.push(['Cách tạo', <Badge tone='title'>{SOURCE_LABEL[e.source]}</Badge>]);
    if (e.source === 'bank') {
        if (e.banks.length) rows.push(['Ngân hàng', e.banks.map((b, i) =>
            <Fragment key={b.id}>{i > 0 && ', '}<Link className='vt-link' to={'/question-bank/' + b.id}>{b.name}</Link></Fragment>)]);
        if (e.source_file) rows.push(['Đề mẫu', e.source_file + ' (chỉ lấy cấu trúc)']);
        if (e.draw) rows.push(['Rút được', shortage.length
            ? 'Chưa đủ khối trong ngân hàng: ' + shortage.map(s => `thiếu ${s.need - s.have} ${s.name.toLowerCase()}`).join(', ')
            : <>Đủ để mỗi học sinh làm khoảng <b>{e.draw.capacity} đề</b> không trùng đoạn</>]);
    } else if (e.source === 'word' && e.source_file) rows.push(['File gốc', e.source_file]);
    if (created) rows.push([e.source === 'word' ? 'Nhập lúc' : 'Tạo lúc', created]);
    if (!rows.length) return null;
    return <section className='vt-card vt-th-card'>
        <h2>Tạo bằng cách nào</h2>
        <dl className='vt-th-kv'>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
        {e.source === 'word' && <p className='vt-th-note'>Câu hỏi cố định như file. Muốn sửa câu thì bấm “Sửa”.</p>}
    </section>;
}

function Submissions({e}: {e: ExamDetail}) {
    const {total, pending} = e.submissions;
    return <section className='vt-card vt-th-card'>
        <h2>Bài nộp</h2>
        <div className='vt-th-stats'>
            <div><b>{total}</b><span>bài nộp</span></div>
            <div><b>{pending}</b><span>chờ chấm tự luận</span></div>
        </div>
        {total ? <Link className='vt-link' to={'/to-grade/' + e.id}>Xem bài nộp</Link>
            : <p className='vt-th-note'>Chưa có bài nộp. {isPublished(e) ? '' : 'Đề nháp thì học sinh chưa thấy.'}</p>}
    </section>;
}
