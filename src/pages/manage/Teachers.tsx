import {useState} from 'react';
import type {FormEvent} from 'react';

import {Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FilterChip, IconButton, Modal, PageTitle, Select, Skeleton,
    SkeletonCard, Table, TextField, icons, notify} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useCreateTeacher, useLockTeacher, useResetPassword, useTeachers} from '../../queries/manage';
import type {Teacher} from '../../queries/manage';
import {errorText, formatDate, groupDigits} from '../../lib/format';
import {AccountBadge, Pager, SUBJECTS, TempPasswordDialog, generateTempPassword, isValidTempPassword,
    useDebounced} from './shared';

const LIMIT = 20;

/** BE messages that are English or too terse for Admin. */
export function createTeacherError(e: unknown): string {
    const msg = errorText(e, 'Không tạo được tài khoản');
    if (/exists already/i.test(msg)) return 'Email này đã có tài khoản';
    return msg;
}

type Draft = {name: string; email: string; subjects: string[]; password: string};

/** "Tạo tài khoản giáo viên" dialog (AD-TaoGiaoVien). */
function CreateTeacherDialog({open, onClose, onCreated}: {
    open: boolean; onClose: () => void; onCreated: (t: Teacher, password: string) => void;
}) {
    const create = useCreateTeacher();
    const blank = (): Draft => ({name: '', email: '', subjects: [], password: generateTempPassword()});
    const [d, setD] = useState<Draft>(blank);
    const [tried, setTried] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const errs = {
        name: !d.name.trim() ? 'Nhập họ tên' : null,
        email: !/^\S+@\S+\.\S+$/.test(d.email.trim()) ? 'Email không hợp lệ' : null,
        password: !isValidTempPassword(d.password) ? 'Tối thiểu 8 kí tự, có chữ hoa, chữ thường và số' : null,
    };
    const valid = !errs.name && !errs.email && !errs.password;

    const close = () => {
        if (create.isPending) return;
        setD(blank()); setTried(false); setServerError(null); create.reset();
        onClose();
    };

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        setTried(true);
        setServerError(null);
        if (!valid || create.isPending) return;
        const body = {name: d.name.trim(), email: d.email.trim(), password: d.password, subjects: d.subjects};
        create.mutate(body, {
            onSuccess: t => { onCreated(t, body.password); setD(blank()); setTried(false); create.reset(); onClose(); },
            onError: err => setServerError(createTeacherError(err)),
        });
    };

    const toggle = (s: string, on: boolean) =>
        setD(x => ({...x, subjects: on ? [...x.subjects, s] : x.subjects.filter(v => v !== s)}));

    return <Modal open={open} onClose={close} size='md' title='Tạo tài khoản giáo viên' showClose
                  footer={<>
                      <Button onClick={close} disabled={create.isPending}>Huỷ</Button>
                      <Button variant='primary' loading={create.isPending} loadingText='Đang tạo…' onClick={() => submit()}>Tạo tài khoản</Button>
                  </>}>
        <form className='vt-mg-stack' onSubmit={submit} noValidate>
            <p className='vt-muted'>Giáo viên đăng nhập bằng email và mật khẩu tạm bên dưới.</p>
            <TextField label='Họ tên' value={d.name} autoComplete='off' error={tried ? errs.name : null}
                       onChange={e => setD({...d, name: e.target.value})}/>
            <TextField label='Email' type='email' value={d.email} autoComplete='off' error={tried ? errs.email : null}
                       onChange={e => setD({...d, email: e.target.value})}/>
            <fieldset className='vt-mg-fieldset'>
                <legend className='vt-field-label'>Môn phụ trách · chọn một hoặc nhiều</legend>
                <div className='vt-chip-row'>
                    {SUBJECTS.map(s => <FilterChip key={s} selected={d.subjects.includes(s)} onChange={on => toggle(s, on)}>{s}</FilterChip>)}
                </div>
            </fieldset>
            <div className='vt-mg-pwrow'>
                <TextField label='Mật khẩu tạm' value={d.password} autoComplete='off' spellCheck={false}
                           hint='Tối thiểu 8 kí tự, có chữ hoa, chữ thường và số.' error={tried ? errs.password : null}
                           onChange={e => setD({...d, password: e.target.value})}/>
                <Button size='sm' onClick={() => setD({...d, password: generateTempPassword()})}>Tạo ngẫu nhiên</Button>
            </div>
            <p className='vt-muted vt-mg-small'>Giáo viên đổi mật khẩu ở lần đăng nhập đầu.</p>
            {serverError && <p role='alert' className='vt-mg-err'>{serverError}</p>}
            {/* Enter in a field submits — hidden button so the form has a submitter. */}
            <button type='submit' hidden/>
        </form>
    </Modal>;
}

/** "Tài khoản giáo viên" (AD-GiaoVien). Route /manage/teachers. */
export default function Teachers() {
    const [q, setQ] = useState('');
    const [subject, setSubject] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const query = useDebounced(q.trim());
    const {data, error, refetch, isFetching} = useTeachers({q: query, subject, status, page, limit: LIMIT});
    // Stats line: totals ignore the filters (two 1-row queries; BE has no counts for teachers). Active = everyone not locked.
    const all = useTeachers({limit: 1}).data?.total;
    const locked = useTeachers({status: 'locked', limit: 1}).data?.total;
    const lock = useLockTeacher();
    const reset = useResetPassword();

    const [creating, setCreating] = useState(false);
    const [confirmLock, setConfirmLock] = useState<Teacher | null>(null);
    const [confirmReset, setConfirmReset] = useState<Teacher | null>(null);
    const [shown, setShown] = useState<{name: string; email: string; password: string} | null>(null);

    const filter = (set: (v: string) => void) => (v: string) => { set(v); setPage(1); };

    const doLock = () => {
        const t = confirmLock!;
        lock.mutate({userId: t.id, lock: !t.locked}, {
            onSuccess: () => { notify.success(t.locked ? 'Đã mở khoá' : 'Đã khoá tài khoản', t.name); setConfirmLock(null); },
            onError: e => { notify.error('Không thực hiện được', errorText(e, 'Thử lại sau.')); setConfirmLock(null); },
        });
    };
    const doReset = () => {
        const t = confirmReset!;
        reset.mutate(t.id, {
            onSuccess: r => { setConfirmReset(null); setShown({name: t.name, email: t.email, password: r.temp_password}); },
            onError: e => { notify.error('Không đặt lại được mật khẩu', errorText(e, 'Thử lại sau.')); setConfirmReset(null); },
        });
    };

    const columns: Column<Teacher>[] = [
        {key: 'name', header: 'Họ tên', emphasis: 'strong', render: t =>
            <span className='vt-mg-person'><Avatar name={t.name} size={36}/>{t.name}</span>},
        {key: 'email', header: 'Email', emphasis: 'muted'},
        {key: 'subjects', header: 'Môn phụ trách', render: t => t.subjects.length
            ? <span className='vt-mg-tags'>{t.subjects.map(s => <Badge key={s} tone='draft'>{s}</Badge>)}</span>
            : <span className='vt-muted'>—</span>},
        {key: 'created_at', header: 'Ngày tạo', emphasis: 'muted', render: t => <span className='vt-num'>{formatDate(t.created_at)}</span>},
        {key: 'status', header: 'Trạng thái', render: t => <AccountBadge status={t.status}/>},
        {key: 'actions', header: 'Thao tác', sticky: true, render: t => <span className='vt-mg-actions'>
            <IconButton label={(t.locked ? 'Mở khoá tài khoản ' : 'Khoá tài khoản ') + t.name} tipEnd
                        className={t.locked ? undefined : 'vt-iconbtn--danger'} onClick={() => setConfirmLock(t)}
                        icon={t.locked ? <icons.IconUnlock/> : <icons.IconLock/>}/>
            <IconButton label={'Đặt lại mật khẩu cho ' + t.name} tipEnd onClick={() => setConfirmReset(t)} icon={<icons.IconKey/>}/>
        </span>},
    ];

    const filtered = !!(query || subject || status);

    return <div className='vt-mg-page'>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Tài khoản giáo viên</PageTitle>
                <p className='vt-muted vt-num'>{all !== undefined && locked !== undefined
                    ? `Tổng ${groupDigits(all)} · Hoạt động ${groupDigits(all - locked)} · Đã khoá ${groupDigits(locked)}`
                    : <Skeleton width={220} height={14}/>}</p>
            </div>
            <Button variant='primary' onClick={() => setCreating(true)}>+ Tạo giáo viên</Button>
        </div>

        <Card flush className='vt-table-card'>
        <div className='vt-table-toolbar'>
        <div className='vt-mg-filters'>
            <TextField label='Tìm kiếm' type='search' placeholder='Họ tên hoặc email' value={q}
                       onChange={e => { setQ(e.target.value); setPage(1); }}/>
            <Select label='Môn' value={subject} onChange={e => filter(setSubject)(e.target.value)}
                    placeholder='Tất cả môn' options={SUBJECTS.map(s => ({value: s, label: s}))}/>
            <Select label='Trạng thái' value={status} onChange={e => filter(setStatus)(e.target.value)} placeholder='Tất cả'
                    options={[{value: 'active', label: 'Hoạt động'}, {value: 'locked', label: 'Đã khoá'},
                        {value: 'never_logged_in', label: 'Chưa đăng nhập'}]}/>
        </div>
        </div>
        {error && !data
            ? <div className='vt-table-state'><ErrorState title='Không tải được danh sách giáo viên' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/></div>
            : !data
                ? <div className='vt-table-state'><SkeletonCard label='Đang tải giáo viên'/></div>
                : !data.items.length && !filtered
                    ? <EmptyState bare title='Chưa có giáo viên nào' description='Tạo tài khoản đầu tiên để giáo viên bắt đầu soạn đề.'
                                  action={<Button variant='primary' onClick={() => setCreating(true)}>+ Tạo giáo viên</Button>}/>
                    : <Table bare caption='Danh sách giáo viên' columns={columns} rows={data.items} rowKey={t => t.id}
                             minWidth={760} empty='Không có giáo viên khớp bộ lọc'/>}
        </Card>
        {data && (data.items.length > 0 || filtered) &&
            <Pager page={data.page} limit={data.limit} total={data.total} unit='giáo viên' onPage={setPage}/>}

        <CreateTeacherDialog open={creating} onClose={() => setCreating(false)}
                             onCreated={(t, pw) => { notify.success('Đã tạo tài khoản', t.name); setShown({name: t.name, email: t.email, password: pw}); }}/>

        <ConfirmDialog open={!!confirmLock} tone={confirmLock?.locked ? 'primary' : 'danger'} loading={lock.isPending}
                       title={confirmLock?.locked ? 'Mở khoá giáo viên?' : 'Khoá giáo viên?'}
                       message={confirmLock?.locked
                           ? `${confirmLock?.name} đăng nhập lại được bằng mật khẩu cũ.`
                           : `${confirmLock?.name} sẽ bị đăng xuất và không đăng nhập được. Đề đã tạo và bài đã chấm giữ nguyên.`}
                       confirmLabel={confirmLock?.locked ? 'Mở khoá' : 'Khoá'}
                       onConfirm={doLock} onCancel={() => setConfirmLock(null)}/>

        <ConfirmDialog open={!!confirmReset} loading={reset.isPending} title='Đặt lại mật khẩu?'
                       message={`Hệ thống tạo mật khẩu tạm mới cho ${confirmReset?.name}. Mọi phiên đăng nhập của họ bị đăng xuất.`}
                       confirmLabel='Đặt lại' onConfirm={doReset} onCancel={() => setConfirmReset(null)}/>

        <TempPasswordDialog open={!!shown} name={shown?.name} email={shown?.email} password={shown?.password || ''}
                            onClose={() => setShown(null)}/>
    </div>;
}
