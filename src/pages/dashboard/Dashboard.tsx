import {useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import striptags from 'striptags';

import {Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FilterChip, PageTitle, SkeletonCard, StatusBadge, Table,
    TextField, buttonClass, notify} from '../../components/ui';
import type {Column} from '../../components/ui';
import {errorText} from '../../lib/format';
import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import {useFolderExams, useFolders} from '../../queries/exams';
import type {ExamStatus, ExamSummary, Folder} from '../../types/exam';
import Default from '../exam-creation/Default';
import {useMediaQuery} from '../useMediaQuery';
import StudentHome from '../student/StudentHome';
import {stripAccents} from './subjectStyle';
import './teacher-home.css';

type Filter = 'all' | ExamStatus;
type Pending = {kind: 'delete' | 'unpublish'; exam: ExamSummary; submissions?: number};

const isPublished = (e: ExamSummary) => e.status !== 'draft';
const examName = (e: ExamSummary) => striptags(e.name) || '(đề không tên)';

/**
 * GV-Mon / GV-DanhSachDe: subject cards → exam table of the open subject, with Nháp / Đã xuất bản.
 * Route `/` and `/subject/:subjectId` (the open subject is the URL param, so F5 and Back keep it).
 * ponytail: search runs on the FE over the loaded list; exam/list has no submission count, so the
 * "bài nộp" number and the locked Xoá come from BE answers (to_grade before unpublish, 409 on delete).
 */
export default function Dashboard() {
    const isTeacher = useAuthStore(s => s.user?.group) === 'teacher';
    return isTeacher ? <TeacherHome/> : <StudentHome/>;
}

function TeacherHome() {
    const {subjectId} = useParams();
    const [q, setQ] = useState('');
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const folders = useFolders();

    if (folders.isError) return <ErrorState title='Không tải được kho đề' description='Kiểm tra kết nối mạng rồi thử lại. Đề của cô vẫn an toàn.'
                                            onRetry={() => folders.refetch()} retrying={folders.isFetching}/>;
    if (!folders.data) return <div className='vt-th-page'><SkeletonCard/><SkeletonCard/></div>;

    // Subjects only (root folders); child folders are not shown (Q5: no rename/delete UI yet).
    const subjects = folders.data.filter(f => !f.parent);
    const hiddenCount = subjects.filter(s => s.hidden).length;
    const match = (t: string) => stripAccents(t).includes(stripAccents(q));
    const shown = q ? subjects.filter(s => match(s.name)) : subjects;

    if (!subjects.length) return <div className='vt-th-page'>
        <PageTitle>Môn & đề</PageTitle>
        <EmptyState title='Chưa có môn học nào'
                    description='Môn học do Admin tạo. Khi Admin tạo xong, môn sẽ hiện ở đây để cô soạn đề. Cô báo Admin giúp nhé.'/>
    </div>;

    return <div className='vt-th-page'>
        <div className='vt-th-head'>
            <div>
                <PageTitle>Môn & đề</PageTitle>
                <p>{subjects.length} môn{hiddenCount > 0 && ` · ${hiddenCount} môn đang ẩn`}. Danh sách môn do Admin quản lý — cô chọn môn có sẵn để soạn đề. Cần thêm môn, báo Admin.</p>
            </div>
            <TextField label='Tìm đề, tìm môn' placeholder='Tìm đề, tìm môn' value={q} onChange={e => setQ(e.target.value)}/>
        </div>

        {q && !shown.length && !subjectId && <EmptyState title={`Không có mục nào khớp “${q}”`}
            action={<Button variant='secondary' onClick={() => setQ('')}>Xoá ô tìm</Button>}/>}

        <div className='vt-th-subjects'>
            {shown.map(s => <SubjectCard key={s.id} subject={s} active={s.id === subjectId}
                                         menuOpen={menuFor === s.id}
                                         onMenu={() => setMenuFor(menuFor === s.id ? null : s.id)}/>)}
        </div>

        {subjectId && subjects.some(s => s.id === subjectId) &&
            <ExamList subject={subjects.find(s => s.id === subjectId)!} subjects={subjects} q={q}/>}
    </div>;
}

function SubjectCard({subject, active, menuOpen, onMenu}: {subject: Folder; active: boolean; menuOpen: boolean; onMenu: () => void}) {
    const navigate = useNavigate();
    const to = (path: string) => navigate(path + '?folder=' + subject.id);
    return <Card as='article' className={'vt-th-subject' + (active ? ' is-active' : '')}>
        <Link to={'/subject/' + subject.id} className='vt-th-subject-name' aria-current={active ? 'true' : undefined}>{subject.name}</Link>
        {subject.hidden && <Badge tone='sun'>Môn đang ẩn — học sinh không thấy</Badge>}
        <Button variant='secondary' aria-expanded={menuOpen} onClick={onMenu}>+ Tạo đề</Button>
        {menuOpen && <div className='vt-th-menu' role='menu'>
            <button role='menuitem' type='button' onClick={() => to('/create-exam')}>
                <b>Tự soạn</b><span>Soạn theo phần trên máy tính</span></button>
            <button role='menuitem' type='button' onClick={() => to('/import-exam')}>
                <b>Nhập Word</b><span>Tải file .docx, xem lại rồi lưu</span></button>
            <button role='menuitem' type='button' onClick={() => to('/create-from-bank')}>
                <b>Từ ngân hàng đề</b><span>Theo cấu trúc, mỗi lượt một đề riêng</span></button>
        </div>}
    </Card>;
}

function ExamList({subject, subjects, q}: {subject: Folder; subjects: Folder[]; q: string}) {
    const qc = useQueryClient();
    const wide = useMediaQuery('(min-width: 768px)');
    const {data, isError, isFetching, refetch} = useFolderExams(subject.id);
    const [filter, setFilter] = useState<Filter>('all');
    const [pending, setPending] = useState<Pending | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = () => qc.invalidateQueries({queryKey: ['exam', 'list']});
    const run = async (fn: () => Promise<void>, failTitle: string) => {
        setBusy(true);
        try { await fn(); refresh(); }
        catch (e) { notify.error(failTitle, errorText(e, 'Thử lại sau.')); }
        finally { setBusy(false); setPending(null); }
    };

    const publish = (e: ExamSummary) => run(async () => {
        try {
            await Api.post(`exam/publish/${e.id}`);
        } catch (err) {
            const n = (err as {invalid_questions?: unknown[]})?.invalid_questions?.length;
            throw n ? {error: `Đề còn ${n} chỗ phải sửa (mở Sửa để xem). Đề vẫn là Nháp.`} : err;
        }
        notify.success('Đã xuất bản', `Học sinh thấy đề này từ bây giờ, trong môn ${subject.name}.`);
    }, 'Chưa xuất bản được');

    const unpublish = (e: ExamSummary) => run(async () => {
        await Api.post(`exam/unpublish/${e.id}`);
        notify.success('Đã chuyển về nháp', 'Học sinh không còn thấy đề này.');
    }, 'Không chuyển về nháp được');

    // Light warning only when the exam already has submissions (to_grade lists them); none → switch at once.
    const askUnpublish = async (e: ExamSummary) => {
        setBusy(true);
        try {
            const subs = await Api.get<unknown[]>(`exam/to_grade/${e.id}`);
            if (subs.length) { setPending({kind: 'unpublish', exam: e, submissions: subs.length}); setBusy(false); }
            else { setBusy(false); unpublish(e); }
        } catch (err) { setBusy(false); notify.error('Không chuyển về nháp được', errorText(err, 'Thử lại sau.')); }
    };

    const remove = (e: ExamSummary) => run(async () => {
        await Api.post(`exam/delete/${e.id}`);
        notify.success('Đã xoá đề', examName(e));
    }, 'Không xoá được đề');

    const duplicate = (e: ExamSummary) => run(async () => {
        await Api.post(`exam/duplicate/${e.id}`, Default.exam());
        notify.success('Đã nhân bản đề', examName(e));
    }, 'Không nhân bản được');

    const move = (e: ExamSummary, folderId: string) => run(async () => {
        await Api.post('exam/move_to_folder', {examId: e.id, folderId});
        notify.success('Đã chuyển đề', `Sang môn ${subjects.find(s => s.id === folderId)?.name}.`);
    }, 'Không chuyển được đề');

    const all = data || [];
    const matched = q ? all.filter(e => stripAccents(examName(e)).includes(stripAccents(q))) : all;
    const rows = matched.filter(e => filter === 'all' || (filter === 'draft') === !isPublished(e));
    const count = (f: Filter) => matched.filter(e => f === 'all' || (f === 'draft') === !isPublished(e)).length;

    const actions = (e: ExamSummary) => <div className='vt-th-actions'>
        <Link to={'/edit-exam/' + e.id} className={buttonClass({variant: 'secondary'})}>Sửa</Link>
        <Link to={`/do-exam/${e.id}?lam_lai=1`} className={buttonClass({variant: 'ghost'})}>Làm thử</Link>
        <Link to={'/to-grade/' + e.id} className={buttonClass({variant: 'ghost'})}>Bài nộp</Link>
        {isPublished(e)
            ? <Button variant='ghost' disabled={busy} onClick={() => askUnpublish(e)}>Chuyển về nháp</Button>
            : <Button variant='primary' disabled={busy} onClick={() => publish(e)}>Xuất bản</Button>}
        <Button variant='ghost' disabled={busy} onClick={() => duplicate(e)}>Nhân bản</Button>
        <select className='vt-th-move' aria-label={'Chuyển môn: ' + examName(e)} value={subject.id} disabled={busy}
                onChange={ev => move(e, ev.target.value)}>
            {subjects.filter(s => !s.hidden || s.id === subject.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button variant='ghost' className='vt-th-del' disabled={busy} onClick={() => setPending({kind: 'delete', exam: e})}>Xoá</Button>
    </div>;

    const columns: Column<ExamSummary>[] = [
        {key: 'name', header: 'Tên đề', emphasis: 'strong', render: examName},
        {key: 'status', header: 'Trạng thái', render: e => <StatusBadge status={isPublished(e) ? 'published' : 'draft'}/>},
        {key: 'duration', header: 'Thời gian', render: e => e.duration ? `${e.duration} phút` : 'Không giới hạn'},
        {key: 'actions', header: 'Thao tác', render: actions},
    ];

    return <section className='vt-th-exams' aria-busy={isFetching}>
        <div className='vt-th-exams-head'>
            <h2>{subject.name}</h2>
            <span>{all.length} đề · học sinh chỉ thấy đề đã xuất bản</span>
            <div className='vt-th-filters'>
                {([['all', 'Tất cả'], ['draft', 'Nháp'], ['published', 'Đã xuất bản']] as const).map(([k, label]) =>
                    <FilterChip key={k} selected={filter === k} onChange={() => setFilter(k)}>{label} · {count(k)}</FilterChip>)}
            </div>
        </div>

        {isError ? <ErrorState title='Không tải được kho đề' description='Kiểm tra kết nối mạng rồi thử lại. Đề của cô vẫn an toàn.'
                               onRetry={() => refetch()} retrying={isFetching}/>
            : !data ? <SkeletonCard/>
            : !rows.length ? <EmptyState title={q ? `Không có đề nào khớp “${q}”`
                                              : filter === 'draft' ? 'Chưa có đề nháp nào'
                                              : filter === 'published' ? 'Chưa có đề nào xuất bản'
                                              : 'Thư mục trống'}
                                         description={!q && filter === 'all' ? 'Bấm “Tạo đề” trên thẻ môn.' : undefined}/>
            : <div className={isFetching ? 'vt-th-loading' : undefined}>
                {wide
                    ? <Table caption={'Đề của môn ' + subject.name} columns={columns} rows={rows} rowKey={e => e.id} minWidth={820}/>
                    : <ul className='vt-th-cards'>{rows.map(e => <li key={e.id}><Card>
                        <b>{examName(e)}</b>
                        <StatusBadge status={isPublished(e) ? 'published' : 'draft'}/>
                        <p>{e.duration ? `${e.duration} phút` : 'Không giới hạn'} · Môn {subject.name}</p>
                        <div className='vt-th-actions'>
                            <Link to={`/do-exam/${e.id}?lam_lai=1`} className={buttonClass({variant: 'secondary'})}>Làm thử</Link>
                            <Link to={'/to-grade/' + e.id} className={buttonClass({variant: 'secondary'})}>Bài nộp</Link>
                        </div>
                        <small>Sửa, xuất bản, xoá: dùng máy tính</small>
                    </Card></li>)}</ul>}
            </div>}

        <ConfirmDialog open={pending?.kind === 'delete'} tone='danger' loading={busy}
                       title='Xoá đề này?' cancelLabel='Giữ lại' confirmLabel='Xoá đề'
                       message={pending && <span><b>{examName(pending.exam)}</b><br/>
                           {isPublished(pending.exam) ? 'Đã xuất bản' : 'Nháp'}. Xoá rồi không lấy lại được. Chỉ đề chưa có bài nộp mới xoá được.</span>}
                       onCancel={() => setPending(null)} onConfirm={() => pending && remove(pending.exam)}/>
        <ConfirmDialog open={pending?.kind === 'unpublish'} loading={busy}
                       title={pending ? `Chuyển “${examName(pending.exam)}” về nháp?` : ''}
                       cancelLabel='Để nguyên' confirmLabel='Chuyển về nháp'
                       message={pending && <span>Đề đã có <b>{pending.submissions} bài nộp</b>. Học sinh sẽ không còn thấy và không làm được đề này. Bài đã nộp vẫn giữ.</span>}
                       onCancel={() => setPending(null)} onConfirm={() => pending && unpublish(pending.exam)}/>
    </section>;
}
