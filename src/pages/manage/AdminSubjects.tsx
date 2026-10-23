import {useState} from 'react';
import type {FormEvent} from 'react';

import {Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, ErrorState, PageColumns, PageTitle, SkeletonCard,
    Table, TextField, icons, notify} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useSubjectMutations} from '../../queries/manage';
import {useSubjects} from '../../queries/student';
import type {SubjectSummary} from '../../types/student';
import {errorText} from '../../lib/format';

export const MAX_SUBJECT_NAME = 100;

/** Error text for a subject name, or undefined when valid. */
export function validateSubjectName(name: string): string | undefined {
    const n = name.trim();
    return !n || n.length > MAX_SUBJECT_NAME ? `Tên môn không được trống, tối đa ${MAX_SUBJECT_NAME} ký tự` : undefined;
}

function SubjectForm({subject, onDone}: {subject: SubjectSummary | null; onDone: () => void}) {
    const {create, update} = useSubjectMutations();
    const [name, setName] = useState(subject?.name || '');
    const [tried, setTried] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const saving = create.isPending || update.isPending;
    const err = validateSubjectName(name);

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        setTried(true);
        setServerError(null);
        if (err || saving) return;
        const opts = {
            onSuccess: () => { notify.success(subject ? 'Đã đổi tên môn' : 'Đã tạo môn', name.trim()); onDone(); },
            onError: (e: unknown) => setServerError(errorText(e, 'Không lưu được môn học')),
        };
        if (subject) update.mutate({id: subject.id, name: name.trim()}, opts); else create.mutate(name.trim(), opts);
    };

    return <Card as='section' aria-label={subject ? 'Đổi tên môn' : 'Môn mới'}>
        <form className='vt-mg-stack' onSubmit={submit} noValidate>
            <CardTitle>{subject ? 'Đổi tên môn' : 'Môn mới'}</CardTitle>
            <TextField label='Tên môn' value={name} error={tried ? err : undefined} maxLength={MAX_SUBJECT_NAME}
                       onChange={e => setName(e.target.value)}/>
            {serverError && <p role='alert' className='vt-mg-err'>{serverError}</p>}
            <div className='vt-mg-form-actions'>
                <span style={{flexGrow: 1}}/>
                <Button onClick={onDone} disabled={saving}>Huỷ</Button>
                <Button type='submit' variant='primary' loading={saving} loadingText='Đang lưu…'>{subject ? 'Lưu tên' : 'Tạo môn'}</Button>
            </div>
        </form>
    </Card>;
}

/** "Môn học" (SPT-65). Route /manage/subjects. Admin only on the BE (folder/create, folder/update); no delete — hide instead. */
export default function AdminSubjects() {
    const {data, error, refetch, isFetching} = useSubjects();
    const {update} = useSubjectMutations();
    const [editing, setEditing] = useState<SubjectSummary | 'new' | null>(null);
    const [hiding, setHiding] = useState<SubjectSummary | null>(null);
    const list = data || [];

    const setHidden = (s: SubjectSummary, hidden: boolean) => update.mutate({id: s.id, hidden}, {
        onSuccess: () => { setHiding(null); notify.success(hidden ? 'Đã ẩn môn' : 'Đã hiện môn', s.name); },
        onError: e => { setHiding(null); notify.error(hidden ? 'Không ẩn được môn' : 'Không hiện được môn', errorText(e, 'Thử lại sau.')); },
    });

    const columns: Column<SubjectSummary>[] = [
        {key: 'name', header: 'Môn học', emphasis: 'strong', render: s => s.name},
        {key: 'exams', header: 'Số đề', align: 'right', render: s => <span className='vt-num'>{s.exams}</span>},
        {key: 'hidden', header: 'Trạng thái', render: s => s.hidden
            ? <Badge tone='draft'>Đang ẩn</Badge> : <Badge tone='ok'>Đang hiện</Badge>},
        {key: 'actions', header: 'Thao tác', sticky: true, render: s => <span className='vt-mg-actions'>
            <Button size='sm' variant='ghost' icon={<icons.IconEdit/>} aria-label={'Đổi tên ' + s.name}
                    onClick={() => setEditing(s)}>Đổi tên</Button>
            <Button size='sm' variant='ghost' aria-label={(s.hidden ? 'Hiện ' : 'Ẩn ') + s.name} disabled={update.isPending}
                    onClick={() => s.hidden ? setHidden(s, false) : setHiding(s)}>{s.hidden ? 'Hiện' : 'Ẩn'}</Button>
        </span>},
    ];

    const main = error && !data
        ? <ErrorState title='Không tải được danh sách môn' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                      onRetry={() => refetch()} retrying={isFetching}/>
        : !data
            ? <SkeletonCard label='Đang tải môn học'/>
            : !list.length
                ? <EmptyState title='Chưa có môn học nào' description='Tạo môn đầu tiên để giáo viên soạn đề.'
                              action={<Button variant='primary' onClick={() => setEditing('new')}>+ Môn mới</Button>}/>
                : <Table caption='Danh sách môn học' columns={columns} rows={list} rowKey={s => s.id} minWidth={320}
                         isHighlighted={s => editing !== 'new' && editing?.id === s.id}/>;

    const side = editing
        ? <SubjectForm key={editing === 'new' ? 'new' : editing.id} subject={editing === 'new' ? null : editing} onDone={() => setEditing(null)}/>
        : <Card as='section' className='vt-mg-stack'>
            <CardTitle>Môn học</CardTitle>
            <p className='vt-muted'>Bấm “Đổi tên” ở một môn, hoặc “+ Môn mới” để tạo môn. Môn không xoá được, chỉ ẩn.</p>
        </Card>;

    return <div className='vt-mg-page'>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Môn học</PageTitle>
                <p className='vt-muted'>Chỉ Admin tạo, đổi tên, ẩn/hiện môn. Giáo viên chỉ chọn môn có sẵn khi soạn đề.</p>
            </div>
            <Button variant='primary' onClick={() => setEditing('new')}>+ Môn mới</Button>
        </div>
        <PageColumns main={main} side={<div className='vt-mg-side'>{side}</div>}/>
        <ConfirmDialog open={!!hiding} tone='danger' loading={update.isPending} title='Ẩn môn học?'
                       message={`Học sinh và giáo viên sẽ không thấy môn ${hiding?.name}; đề và bài làm cũ giữ nguyên. Bạn có thể hiện lại bất cứ lúc nào.`}
                       confirmLabel='Ẩn môn' onConfirm={() => hiding && setHidden(hiding, true)} onCancel={() => setHiding(null)}/>
    </div>;
}
