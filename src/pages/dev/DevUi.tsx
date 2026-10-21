import {useState} from 'react';
import type {ReactNode} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {Toaster} from 'react-hot-toast';

import {
    AdminLayout, Avatar, Badge, BottomNav, Button, Card, CardTitle, ConfirmDialog, EmptyState, ErrorState,
    FilterChip, HeaderSticky, Medal, Modal, PageColumns, PageTitle, ProgressBar, STATUS_BADGE, SegmentedControl,
    Select, Skeleton, SkeletonCard, StatPill, StatusBadge, StudentLayout, StudentStats, Switch, Table, Tabs,
    TextArea, TextField, ToastCard, WaveLine, buttonClass, notify,
} from '../../components/ui';
import type {Column, Status} from '../../components/ui';
import DevExam from './DevExam';
import './dev.css';

/*
 * Internal catalogue of the design-D kit, for Athena to review against design/screens/DS-*.dc.html.
 * Mounted ONLY when import.meta.env.DEV (App.tsx) — not in the production bundle.
 *   /dev/ui          all components
 *   /dev/ui/hs       student layout (resize 390 ↔ 1280)
 *   /dev/ui/admin    admin layout
 *   /dev/ui/lam-bai  exam screen, whole paper on one page
 * Sample content = design-system.md §7 (no real data).
 */

function Section({title, children, note}: {title: string; children: ReactNode; note?: string}) {
    return <section className='dev-section'>
        <h2 className='dev-h2'>{title}</h2>
        {note && <p className='dev-note'>{note}</p>}
        {children}
    </section>;
}

function Spec({label, children}: {label: string; children: ReactNode}) {
    return <div className='dev-spec'>{children}<span className='dev-cap'>{label}</span></div>;
}

type Row = {id: number; exam: string; subject: string; date: string; score: string; status: Status};
const ROWS: Row[] = [
    {id: 1, exam: 'Đề thi thử SPT số 3', subject: 'Toán', date: '20/10', score: '7,75', status: 'graded'},
    {id: 2, exam: 'Đề số 2', subject: 'Ngữ văn', date: '18/10', score: '—', status: 'pending'},
    {id: 3, exam: 'Đề số 5', subject: 'Tiếng Anh', date: '16/10', score: '8,25', status: 'graded'},
    {id: 4, exam: 'Đề thi thử SPT số 4', subject: 'Toán', date: '21/10', score: '—', status: 'inProgress'},
];
const COLS: Column<Row>[] = [
    {key: 'exam', header: 'Đề', emphasis: 'strong'},
    {key: 'subject', header: 'Môn'},
    {key: 'date', header: 'Ngày', emphasis: 'muted'},
    {key: 'score', header: 'Điểm', align: 'right', emphasis: 'bold'},
    {key: 'status', header: 'Trạng thái', render: r => <StatusBadge status={r.status}/>},
];

function Catalogue() {
    const [tab, setTab] = useState<'week' | 'all'>('week');
    const [seg, setSeg] = useState<'mon' | 'de'>('mon');
    const [subjects, setSubjects] = useState<string[]>(['Toán']);
    const [hide, setHide] = useState(true);
    const [confirm, setConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sheet, setSheet] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = () => { setSaving(true); setTimeout(() => setSaving(false), 1500); };
    const submit = () => {
        setSubmitting(true);
        setTimeout(() => { setSubmitting(false); setConfirm(false); notify.success('Đã nộp bài', 'Xem kết quả ngay.'); }, 1500);
    };

    return <div className='vt-paper dev-page'>
        <header className='dev-head'>
            <PageTitle>viettestpro · Bộ component</PageTitle>
            <WaveLine/>
            <nav className='dev-links' aria-label='Trang demo'>
                <Link to='/dev/ui/hs'>Layout học sinh</Link>
                <Link to='/dev/ui/admin'>Layout admin</Link>
                <Link to='/dev/ui/lam-bai'>Màn làm bài</Link>
            </nav>
        </header>

        <Section title='Nút' note='Chính · Phụ · Chữ · Nguy hiểm · Khoá; hàng 2: đang tải (bấm "Lưu" để thử); hàng 3: cỡ sm / lg / block.'>
            <div className='dev-grid'>
                <Spec label='Chính'><Button variant='primary'>Làm bài</Button></Spec>
                <Spec label='Phụ'><Button>Huỷ</Button></Spec>
                <Spec label='Chữ'><Button variant='ghost'>Xem tất cả</Button></Spec>
                <Spec label='Nguy hiểm'><Button variant='danger'>Xoá đề</Button></Spec>
                <Spec label='Khoá'><Button variant='primary' disabled>Nộp bài</Button></Spec>
                <Spec label='Chính · đang tải'><Button variant='primary' loading={saving} loadingText='Đang lưu…' onClick={save}>Lưu</Button></Spec>
                <Spec label='Phụ · đang tải'><Button loading loadingText='Đang lưu…'>Lưu</Button></Spec>
                <Spec label='Chữ · đang tải'><Button variant='ghost' loading loadingText='Đang lưu…'>Lưu</Button></Spec>
                <Spec label='Nguy hiểm · đang tải'><Button variant='danger' loading loadingText='Đang xoá…'>Xoá</Button></Spec>
                <Spec label='Link dạng nút'><Link to='/dev/ui' className={buttonClass({variant: 'primary'})}>Làm tiếp →</Link></Spec>
                <Spec label='sm 44px'><Button variant='primary' size='sm'>Nộp bài</Button></Spec>
                <Spec label='lg 52px'><Button variant='primary' size='lg'>Nộp bài</Button></Spec>
            </div>
        </Section>

        <Section title='Nhãn trạng thái & chip lọc'>
            <div className='dev-row'>
                {(Object.keys(STATUS_BADGE) as Status[]).map(s => <StatusBadge key={s} status={s}/>)}
                <Badge tone='title'>Học sinh chăm</Badge>
            </div>
            <div className='vt-chip-row'>
                {['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lí'].map(s =>
                    <FilterChip key={s} selected={subjects.includes(s)}
                                onChange={on => setSubjects(x => on ? [...x, s] : x.filter(y => y !== s))}>{s}</FilterChip>)}
            </div>
        </Section>

        <Section title='Ô thống kê, avatar, huy chương'>
            <div className='dev-row'>
                <StatPill kind='title'>Học sinh chăm</StatPill>
                <StatPill kind='star' label='20 sao'>20</StatPill>
                <StatPill kind='turns' to='/dev/ui'>7 lượt</StatPill>
                <StatPill kind='grading' to='/dev/ui'>3 bài chờ chấm</StatPill>
                <StatPill kind='star' size='sm' label='20 sao'>20</StatPill>
                <StatPill kind='turns' size='sm' label='7 lượt'>7</StatPill>
                <Avatar name='Nguyễn Minh Anh'/>
                <Avatar name='Cô Thu Hà' size={36}/>
                <Medal rank={1}/><Medal rank={2}/><Medal rank={3}/><Medal rank={4}/>
            </div>
        </Section>

        <Section title='Ô nhập & lựa chọn'>
            <div className='dev-fields'>
                <TextField label='Email' type='email' placeholder='ban@email.com' autoComplete='email'/>
                <TextField label='Mật khẩu' type='password' defaultValue='12345' error='Cần ít nhất 8 ký tự'/>
                <TextField label='Mã học sinh' defaultValue='HS-20481' disabled/>
                <TextField label='Họ và tên' placeholder='Nguyễn Minh Anh' hint='Hiện trên bảng xếp hạng'/>
                <Select label='Môn thi' defaultValue='Toán'
                        options={['Toán', 'Ngữ văn', 'Tiếng Anh'].map(v => ({value: v, label: v}))}/>
                <TextArea label='Mô tả đề' rows={2} placeholder='Đề bám sát cấu trúc SPT, 4 phần, 90 phút.'/>
                <Switch checked={hide} onChange={setHide} label='Ẩn tên khỏi bảng xếp hạng'/>
            </div>
        </Section>

        <Section title='Tab & segmented'>
            <div className='dev-row'>
                <Tabs aria-label='Bảng xếp hạng' value={tab} onChange={setTab}
                      items={[{value: 'week', label: 'Bảng tuần'}, {value: 'all', label: 'Thành tích'}]}/>
                <SegmentedControl aria-label='Xếp theo' value={seg} onChange={setSeg}
                                  items={[{value: 'mon', label: 'Theo môn'}, {value: 'de', label: 'Theo đề'}]}/>
            </div>
        </Section>

        <Section title='Thẻ'>
            <PageColumns
                main={<div className='dev-cards'>
                    <Card><CardTitle>Lượt thi là gì?</CardTitle>
                        <p className='vt-muted dev-p'>Mỗi lần mở một đề dùng 1 lượt. Lượt không hết hạn, mua thêm bất cứ lúc nào.</p></Card>
                    <Card><span className='vt-muted dev-small'>Lượt còn lại</span>
                        <div className='vt-hand dev-big'>7 lượt</div>
                        <span className='vt-muted dev-small'>Gói 10 lượt · không hết hạn</span></Card>
                    <Card className='dev-action-card'>
                        <StatusBadge status='inProgress' className='dev-self-start'/>
                        <CardTitle>Toán — Đề thi thử SPT số 3</CardTitle>
                        <div className='dev-between'><span className='vt-muted dev-small'>10 / 23 câu · còn 38 phút</span>
                            <Button variant='primary'>Làm tiếp →</Button></div>
                    </Card>
                    <Card size='md' className='dev-between'><b>Đề thi thử SPT số 4</b><span className='vt-muted dev-small'>90 phút</span></Card>
                </div>}
                side={<Card><CardTitle>Cột phụ</CardTitle><p className='vt-muted dev-p'>flex 1 1 300px, tối đa 380px; xuống dưới khi màn hẹp.</p></Card>}/>
        </Section>

        <Section title='Bảng'>
            <Table caption='Lịch sử làm bài' columns={COLS} rows={ROWS} rowKey={r => r.id} isHighlighted={r => r.id === 3}/>
            <Table caption='Bảng rỗng' showCaption columns={COLS} rows={[]} rowKey={r => r.id} empty='Chưa có bài làm nào'/>
        </Section>

        <Section title='Hộp thoại & toast'>
            <div className='dev-row'>
                <Button variant='primary' onClick={() => setConfirm(true)}>Mở "Nộp bài?"</Button>
                <Button onClick={() => setSheet(true)}>Mở sheet</Button>
                <Button onClick={() => notify.success('Đã lưu đề', 'Học sinh thấy ngay.')}>Toast thành công</Button>
                <Button variant='danger' onClick={() => notify.error('Không lưu được', 'Kiểm tra mạng rồi thử lại.')}>Toast lỗi</Button>
            </div>
            <div className='dev-row'>
                <ToastCard title='Đã lưu đề' description='Học sinh thấy ngay.'/>
                <ToastCard tone='error' title='Không lưu được' description='Kiểm tra mạng rồi thử lại.'/>
            </div>
            <ConfirmDialog open={confirm} title='Nộp bài?' message='Bạn còn 3 câu chưa làm. Nộp rồi sẽ không sửa được bài.'
                           cancelLabel='Làm tiếp' confirmLabel='Nộp bài' loading={submitting}
                           onCancel={() => setConfirm(false)} onConfirm={submit}/>
            <Modal open={sheet} onClose={() => setSheet(false)} title='Đi tới câu' placement='sheet' showClose>
                <p>Sheet trượt từ dưới lên (mobile). Esc hoặc bấm nền để đóng.</p>
            </Modal>
        </Section>

        <Section title='Tiến độ, rỗng, đang tải, lỗi'>
            <div className='dev-states'>
                <Card><ProgressBar value={10} max={23} label='Số câu đã làm' caption='Tiến độ' showCount/></Card>
                <EmptyState title='Chưa có bài làm' description='Chọn đề để bắt đầu.'
                            action={<Button variant='primary' size='sm'>Xem đề thi</Button>}/>
                <SkeletonCard/>
                <ErrorState title='Không tải được đề' description='Mạng đang chập chờn. Bài làm của bạn vẫn được giữ.'
                            onRetry={() => {}}/>
                <Card><div className='dev-skel'><Skeleton width='40%' height={22}/><Skeleton/><Skeleton shape='pill' height={8}/></div></Card>
            </div>
        </Section>

        <Section title='Header & điều hướng (thu nhỏ)' note='Bản đầy đủ: /dev/ui/hs và /dev/ui/admin — kéo cửa sổ 390 ↔ 1280.'>
            <div className='dev-frame dev-frame--phone'>
                <HeaderSticky variant='mobile' right={<><StudentStats size='sm' stars={20} turns={7}/><Avatar name='Minh Anh' size={36}/></>}/>
                <div className='dev-frame-fill'/>
                <BottomNav className='dev-bottomnav-static'/>
            </div>
            <div className='dev-frame'>
                <HeaderSticky variant='web' nav={[{to: '/dev/ui', label: 'Trang chủ', end: true}, {to: '/exams', label: 'Đề thi'},
                    {to: '/ranking', label: 'Xếp hạng'}, {to: '/packages', label: 'Gói thi'}]}
                              right={<><StudentStats stars={20} turns={7} title='Học sinh chăm'/><Avatar name='Minh Anh'/></>}/>
            </div>
        </Section>
        <Toaster position='top-right'/>
    </div>;
}

function DemoStudent() {
    return <StudentLayout name='Minh Anh' stars={20} turns={7} title='Học sinh chăm'
                          navMobile={[{to: '/dev/ui/hs', label: 'Trang chủ', end: true}, {to: '/dev/ui', label: 'Đề thi', end: true},
                              {to: '/dev/ui/admin', label: 'Xếp hạng', end: true}, {to: '/dev/ui/lam-bai', label: 'Tôi', end: true}]}
                          navWeb={[{to: '/dev/ui/hs', label: 'Trang chủ', end: true}, {to: '/dev/ui', label: 'Đề thi', end: true},
                              {to: '/dev/ui/admin', label: 'Xếp hạng', end: true}, {to: '/dev/ui/lam-bai', label: 'Gói thi', end: true}]}
                          accountTo='/dev/ui'>
        <div className='vt-stack'>
            <PageTitle>Chào Minh Anh</PageTitle>
            <PageColumns
                main={<>
                    <Card className='dev-action-card'>
                        <StatusBadge status='inProgress' className='dev-self-start'/>
                        <CardTitle>Toán — Đề thi thử SPT số 3</CardTitle>
                        <div className='dev-between'><span className='vt-muted dev-small'>10 / 23 câu · còn 38 phút</span>
                            <Link to='/dev/ui/lam-bai' className={buttonClass({variant: 'primary'})}>Làm tiếp →</Link></div>
                    </Card>
                    {['Ngữ văn — Đề số 2', 'Tiếng Anh — Đề số 5', 'Toán — Đề thi thử SPT số 4'].map(t =>
                        <Card key={t} size='md' className='dev-between'><b>{t}</b><span className='vt-muted dev-small'>90 phút</span></Card>)}
                    <div className='dev-tall vt-muted'>(nội dung dài để thử header dính khi cuộn)</div>
                </>}
                side={<Card><span className='vt-muted dev-small'>Lượt còn lại</span>
                    <div className='vt-hand dev-big'>7 lượt</div>
                    <Button variant='primary' block>Mua thêm lượt</Button></Card>}/>
        </div>
    </StudentLayout>;
}

type Teacher = {id: number; name: string; email: string; exams: number; status: Status};
function DemoAdmin() {
    const rows: Teacher[] = [
        {id: 1, name: 'Cô Thu Hà', email: 'thuha@viettestpro.vn', exams: 12, status: 'published'},
        {id: 2, name: 'Thầy Lê Quốc Huy', email: 'huy@viettestpro.vn', exams: 4, status: 'draft'},
    ];
    return <AdminLayout nav={[{to: '/dev/ui/admin', label: 'Giáo viên', end: true}, {to: '/dev/ui', label: 'Người dùng', end: true},
        {to: '/dev/ui/hs', label: 'Gói thi', end: true}, {to: '/dev/ui/lam-bai', label: 'Doanh thu', end: true}, {to: '/dev', label: 'Giao dịch', end: true}]}>
        <div className='vt-stack'>
            <div className='dev-between'><PageTitle>Giáo viên</PageTitle><Button variant='primary'>Tạo tài khoản giáo viên</Button></div>
            <Table caption='Danh sách giáo viên' rows={rows} rowKey={r => r.id} columns={[
                {key: 'name', header: 'Họ tên', emphasis: 'strong', render: r =>
                    <span className='dev-person'><Avatar name={r.name} size={36}/>{r.name}</span>},
                {key: 'email', header: 'Email', emphasis: 'muted'},
                {key: 'exams', header: 'Số đề', align: 'right', emphasis: 'bold'},
                {key: 'status', header: 'Trạng thái', render: r => <Badge tone={r.status === 'draft' ? 'draft' : 'ok'}>
                    {r.status === 'draft' ? 'Chưa kích hoạt' : 'Đang hoạt động'}</Badge>},
            ]}/>
        </div>
    </AdminLayout>;
}

export default function DevUi() {
    const {pathname} = useLocation();
    if (pathname.startsWith('/dev/ui/hs')) return <DemoStudent/>;
    if (pathname.startsWith('/dev/ui/admin')) return <DemoAdmin/>;
    if (pathname.startsWith('/dev/ui/lam-bai')) return <DevExam/>;
    return <Catalogue/>;
}
