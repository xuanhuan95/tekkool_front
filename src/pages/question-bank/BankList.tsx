import {useState} from 'react';
import {Link} from 'react-router-dom';

import {Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageTitle, Select, SkeletonCard, TextField,
    buttonClass, notify} from '../../components/ui';
import {errorText} from '../../lib/format';
import {useBankSubjects, useBanks, useCreateBank, useRemoveBank} from '../../queries/questionBank';
import type {BankKind, BankSummary} from '../../types/exam';
import './question-bank.css';
import './paper-bank.css';

/** What the card counts: whole exams (kind paper) or blocks. */
export const bankCount = (b: BankSummary) => b.kind === 'paper' ? b.items ?? 0 : b.blocks;

/**
 * GV-NganHang: banks by subject; card actions are Nhập đề / Xem nội dung / Xoá only (04/11: banks are not tied to creating exams).
 * Blocks are viewable and deletable (SPT-73, BankBlocks); editing one is still "fix in Word and import again" (design Q14).
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
                                <div className='vt-qb-top'>
                                    <h2 className='vt-qb-name'>{b.name}</h2>
                                    <Badge tone='title'>{b.subject}</Badge>
                                </div>
                                <div className='vt-qb-count'><b>{bankCount(b)}</b> {b.kind === 'paper' ? 'đề' : 'khối câu hỏi'}</div>
                                <div className='vt-qb-actions'>
                                    <Link to={'/import-exam?bank=' + b.id} className={buttonClass({variant: 'primary'})}>Nhập đề</Link>
                                    {bankCount(b) > 0 &&
                                        <Link to={'/question-bank/' + b.id} className={buttonClass({variant: 'secondary'})}>Xem nội dung</Link>}
                                    <Button variant='ghost' className='vt-qb-remove' aria-label={'Xoá ngân hàng ' + b.name}
                                            onClick={() => setRemoving(b)}>Xoá</Button>
                                </div>
                            </Card>)}
                        </div>
                    </>}

        <CreateBankModal open={creating} taken={(banks || []).map(b => b.name)} onClose={() => setCreating(false)}/>

        <ConfirmDialog open={!!removing} tone='danger' loading={remove.isPending}
                       title={removing ? `Xoá ngân hàng "${removing.name}"?` : ''}
                       message={removing && <span className='vt-qb-warn'>
                           {bankCount(removing)} {removing.kind === 'paper' ? 'đề' : 'khối'} bên trong mất theo, không lấy lại được.</span>}
                       cancelLabel='Giữ lại' confirmLabel='Xoá ngân hàng'
                       onCancel={() => setRemoving(null)}
                       onConfirm={() => removing && remove.mutate(removing.id, {
                           onSuccess: () => { notify.success('Đã xoá ngân hàng', removing.name); setRemoving(null); },
                           onError: e => { notify.error('Không xoá được', errorText(e, 'Thử lại sau.')); setRemoving(null); },
                       })}/>
    </div>;
}

/** Blank name -> subject name; if taken, "Hoá học 2", "Hoá học 3"… */
export function defaultBankName(subject: string, taken: string[]): string {
    let name = subject;
    for (let n = 2; taken.includes(name); n++) name = subject + ' ' + n;
    return name;
}

function CreateBankModal({open, onClose, taken}: {open: boolean; onClose: () => void; taken: string[]}) {
    const {data: subjects = []} = useBankSubjects();
    const create = useCreateBank();
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [kind, setKind] = useState<BankKind>('block');
    const [errors, setErrors] = useState<{subject?: string; server?: string}>({});

    const close = () => { setName(''); setSubject(''); setKind('block'); setErrors({}); onClose(); };
    const submit = () => {
        if (!subject) return setErrors({subject: 'Chưa chọn môn'});
        setErrors({});
        // BE still requires a name -> fill it in here (ponytail: BE untouched).
        const finalName = name.trim() || defaultBankName(subject, taken);
        create.mutate({name: finalName, subject, kind}, {
            onSuccess: () => { notify.success('Đã tạo ngân hàng', finalName); close(); },
            onError: e => setErrors({server: errorText(e, 'Không tạo được ngân hàng.')}),
        });
    };

    return <Modal open={open} onClose={create.isPending ? undefined : close} title='Ngân hàng mới'
                  footer={<>
                      <Button variant='secondary' onClick={close} disabled={create.isPending}>Huỷ</Button>
                      <Button variant='primary' onClick={submit} loading={create.isPending}>Tạo ngân hàng</Button>
                  </>}>
        <form className='vt-qb-page' onSubmit={e => { e.preventDefault(); submit(); }}>
            <Select label='Loại ngân hàng' value={kind} onChange={e => setKind(e.target.value as BankKind)}
                    options={[{value: 'block', label: 'Theo khối'}, {value: 'paper', label: 'Nguyên đề'}]}/>
            <Select label='Môn' placeholder='Chọn môn' value={subject} error={errors.subject}
                    options={subjects.map(s => ({value: s, label: s}))}
                    onChange={e => setSubject(e.target.value)}/>
            <TextField label={<>Tên ngân hàng <span className='vt-muted' style={{fontWeight: 400}}>(không bắt buộc)</span></>}
                       placeholder={subject || 'Tên môn đã chọn'} value={name}
                       onChange={e => setName(e.target.value)}/>
            {errors.server && <div role='alert' className='vt-qb-warn'>{errors.server}</div>}
        </form>
    </Modal>;
}
