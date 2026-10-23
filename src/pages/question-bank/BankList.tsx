import {useState} from 'react';
import {Link} from 'react-router-dom';

import {Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageTitle, Select, SkeletonCard, TextField,
    buttonClass, notify} from '../../components/ui';
import {errorText} from '../../lib/format';
import {useBankSubjects, useBanks, useCreateBank, useRemoveBank} from '../../queries/questionBank';
import type {BankSummary} from '../../types/exam';
import './question-bank.css';

/**
 * GV-NganHang: banks by subject, the door to Nhập đề / Tạo đề / Làm thử.
 * ponytail: no screen to view or edit single blocks (design Q14) — fix in Word and import again.
 */
export default function BankList() {
    const {data: banks, isError, error, refetch, isFetching} = useBanks();
    const remove = useRemoveBank();
    const [creating, setCreating] = useState(false);
    const [removing, setRemoving] = useState<BankSummary | null>(null);

    const openCreate = <Button variant='primary' onClick={() => setCreating(true)}>+ Ngân hàng mới</Button>;

    return <div className='vt-qb-page'>
        <div className='vt-qb-head'>
            <div>
                <PageTitle>Ngân hàng câu hỏi</PageTitle>
                <p>Nhập đề Word vào ngân hàng của môn, rồi tạo đề hoặc để mỗi học sinh rút một đề khác nhau.</p>
            </div>
            {banks && banks.length > 0 && openCreate}
        </div>

        {isError
            ? <ErrorState title='Không tải được danh sách ngân hàng.' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !banks
                ? <div className='vt-qb-grid'><SkeletonCard/><SkeletonCard/></div>
                : banks.length === 0
                    ? <EmptyState title='Chưa có ngân hàng nào'
                                  description='Tạo một ngân hàng cho môn học, rồi nhập đề Word vào đó.' action={openCreate}/>
                    : <>
                        <div className='vt-qb-grid'>
                            {banks.map(b => <Card key={b.id} as='article' className='vt-qb-card'>
                                <h2 className='vt-qb-name'>{b.name}</h2>
                                <div><Badge tone='title'>{b.subject}</Badge></div>
                                {b.blocks
                                    ? <div className='vt-qb-count'><b>{b.blocks}</b> khối câu hỏi</div>
                                    : <div className='vt-qb-empty-box'>Chưa có khối nào — bấm Nhập đề để thêm.</div>}
                                <div className='vt-qb-actions'>
                                    <Link to={'/import-exam?bank=' + b.id} className={buttonClass({variant: 'primary'})}>Nhập đề</Link>
                                    {b.blocks
                                        ? <Link to={'/create-from-bank?bank=' + b.id} className={buttonClass({variant: 'secondary'})}>Tạo đề</Link>
                                        : <Button variant='secondary' disabled>Tạo đề</Button>}
                                    {b.blocks > 0 &&
                                        <Link to={'/draw-exam/bank/' + b.id} className={buttonClass({variant: 'ghost'})}>Làm thử</Link>}
                                    <Button variant='ghost' className='vt-qb-remove' aria-label={'Xoá ngân hàng ' + b.name}
                                            onClick={() => setRemoving(b)}>Xoá</Button>
                                </div>
                            </Card>)}
                        </div>
                        <p className='vt-qb-note'>Chưa có màn xem hoặc sửa từng khối. Muốn sửa, hãy sửa file Word rồi nhập lại.</p>
                    </>}

        <CreateBankModal open={creating} onClose={() => setCreating(false)}/>

        <ConfirmDialog open={!!removing} tone='danger' loading={remove.isPending}
                       title={removing ? `Xoá ngân hàng "${removing.name}"?` : ''}
                       message={removing && <span className='vt-qb-warn'>
                           {removing.blocks} khối bên trong mất theo, không lấy lại được.</span>}
                       cancelLabel='Giữ lại' confirmLabel='Xoá ngân hàng'
                       onCancel={() => setRemoving(null)}
                       onConfirm={() => removing && remove.mutate(removing.id, {
                           onSuccess: () => { notify.success('Đã xoá ngân hàng', removing.name); setRemoving(null); },
                           onError: e => { notify.error('Không xoá được', errorText(e, 'Thử lại sau.')); setRemoving(null); },
                       })}/>
    </div>;
}

function CreateBankModal({open, onClose}: {open: boolean; onClose: () => void}) {
    const {data: subjects = []} = useBankSubjects();
    const create = useCreateBank();
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [errors, setErrors] = useState<{name?: string; subject?: string; server?: string}>({});

    const close = () => { setName(''); setSubject(''); setErrors({}); onClose(); };
    const submit = () => {
        const next = {
            name: name.trim() ? undefined : 'Chưa nhập tên ngân hàng',
            subject: subject ? undefined : 'Chưa chọn môn',
        };
        setErrors(next);
        if (next.name || next.subject) return;
        create.mutate({name: name.trim(), subject}, {
            onSuccess: () => { notify.success('Đã tạo ngân hàng', name.trim()); close(); },
            onError: e => setErrors({server: errorText(e, 'Không tạo được ngân hàng.')}),
        });
    };

    return <Modal open={open} onClose={create.isPending ? undefined : close} title='Ngân hàng mới'
                  footer={<>
                      <Button variant='secondary' onClick={close} disabled={create.isPending}>Huỷ</Button>
                      <Button variant='primary' onClick={submit} loading={create.isPending}>Tạo ngân hàng</Button>
                  </>}>
        <form className='vt-qb-page' onSubmit={e => { e.preventDefault(); submit(); }}>
            <TextField label='Tên ngân hàng' placeholder='Ví dụ: Ngữ văn 12 — HK1' value={name} error={errors.name}
                       onChange={e => setName(e.target.value)}/>
            <Select label='Môn' placeholder='Chọn môn' value={subject} error={errors.subject}
                    hint='Không đổi được sau khi tạo.' options={subjects.map(s => ({value: s, label: s}))}
                    onChange={e => setSubject(e.target.value)}/>
            {errors.server && <div role='alert' className='vt-qb-warn'>{errors.server}</div>}
        </form>
    </Modal>;
}
