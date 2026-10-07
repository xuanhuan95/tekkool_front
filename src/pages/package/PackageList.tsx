import {useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {Button, Form, Header, Icon, Label, Message, Modal, Segment, Table} from 'semantic-ui-react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import Loading from '../../components/Loading';
import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import type {Package, Wallet} from '../../types/payment';

/** Amount like 100000 -> "100.000 đ". */
const money = (n?: number) => (n || 0).toLocaleString('vi-VN') + ' đ';

/** Package being edited in the modal. Not saved yet means no `id`. */
type PackageForm = Omit<Package, 'id'> & {id?: string};

const BLANK: PackageForm = {
    name: '', turns: 4, price: 100000, description: '', order: 0, active: true,
};

/**
 * Practice-exam package management.
 *
 * Replaces selling each exam: a student buys a package, gets N exam turns, usable
 * on any exam. A turn is deducted when the exam STARTS, not on submit.
 */
export default function PackageList() {
    const navigate = useNavigate();
    const location = useLocation();
    const qc = useQueryClient();
    // group is a string id ('teacher' | 'student' | 'visitor').
    const isTeacher = useAuthStore(s => s.user?.group) === 'teacher';

    const [form, setForm] = useState<PackageForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    // ?all=1: teachers also see hidden packages to edit or re-enable them. Students
    // only see packages on sale — the BE filters by itself, this param only widens it.
    //
    // The old version read the role INSIDE componentDidMount, when `auth` might not
    // be ready yet, so a teacher could get the student's list by mistake. The store
    // has a value from the first render, and `isTeacher` is in the queryKey so
    // changing role reloads the right list.
    const {data: packages} = useQuery({
        queryKey: ['package', 'list', isTeacher],
        queryFn: () => Api.get<Package[]>('package/list' + (isTeacher ? '?all=1' : '')),
    });

    // Remaining turns: only students need this. Teachers never spend turns.
    const {data: wallet} = useQuery({
        queryKey: ['payment', 'wallet'],
        queryFn: () => Api.get<Wallet>('payment/wallet'),
        enabled: !isTeacher,
    });

    const reload = () => qc.invalidateQueries({queryKey: ['package', 'list']});

    const save = async () => {
        if (!form) return;
        if (!(form.name || '').trim()) return setError('Chưa đặt tên gói');
        if (!(form.turns > 0)) return setError('Số lượt phải từ 1 trở lên');

        setSaving(true);
        setError(null);
        const r = await Api.post<{error?: string}>(
            form.id ? 'package/update/' + form.id : 'package/create', form);
        setSaving(false);
        if (r && r.error) return setError(r.error);

        setForm(null);
        reload();
    };

    const remove = async (p: Package) => {
        if (!window.confirm('Xoá gói “' + p.name + '”?')) return;
        const r = await Api.post<{message?: string}>('package/remove/' + p.id, {});
        // A package that has been sold is only hidden by the BE — tell the teacher clearly.
        setMsg(r && r.message ? r.message : null);
        reload();
    };

    if (!packages) return <Loading/>;

    /* ---------- Student view: pick a package to buy ---------- */
    if (!isTeacher) {
        // ?het-luot=1: DoExam redirects here when entering an exam with an empty wallet —
        // state the reason plainly, don't make the student guess why they were kicked out.
        const outOfTurns = (location.search || '').indexOf('het-luot=1') >= 0;

        return <div className='tk-dash'>
            <div className='tk-dash-bar'>
                <Header as='h2' className='tk-dash-title'>Gói thi thử</Header>
                {/* Don't use Semantic's <Statistic>: it forces a serif font on the number
                    and uppercases the label, clashing with the rest of the page.
                    A small tag in the same typeface is enough. */}
                {wallet && <div className={'tk-turns' + (wallet.remaining > 0 ? '' : ' empty')}>
                    <span className='tk-turns-num'>{wallet.remaining}</span>
                    <span className='tk-turns-label'>lượt còn lại</span>
                </div>}
            </div>

            {outOfTurns && <Message warning icon>
                <Icon name='hourglass end'/>
                <Message.Content>
                    <Message.Header>Bạn đã hết lượt thi</Message.Header>
                    Chọn một gói bên dưới để tiếp tục làm bài.
                </Message.Content>
            </Message>}

            {!packages.length
                ? <Segment placeholder>
                    <Header icon>
                        <Icon name='cube' color='grey'/>
                        Chưa có gói nào đang bán
                        <Header.Subheader>
                            Giáo viên chưa mở bán gói nào — liên hệ giáo viên của bạn.
                        </Header.Subheader>
                    </Header>
                </Segment>
                : <div className='tk-pkg-list'>
                    {packages.map(p =>
                        <button key={p.id} type='button' className='tk-pkg'
                                onClick={() => navigate('/payment/' + p.id)}>
                            <div className='tk-pkg-name'>{p.name}</div>
                            <div className='tk-pkg-turns'>{p.turns} lượt thi thử</div>
                            <div className='tk-pkg-price'>{money(p.price)}</div>
                            {p.description &&
                                <div className='tk-pkg-desc'>{p.description}</div>}
                        </button>)}
                </div>}
        </div>;
    }

    /* ---------- Teacher view: management table ---------- */
    const set = <K extends keyof PackageForm>(key: K, value: PackageForm[K]) =>
        setForm(f => f && ({...f, [key]: value}));

    return <div className='tk-dash'>
        <div className='tk-dash-bar'>
            <Header as='h2' className='tk-dash-title'>
                Gói thi thử
                <Header.Subheader>
                    Học sinh mua gói để lấy lượt thi. Mỗi lần bắt đầu vào thi trừ 1 lượt.
                </Header.Subheader>
            </Header>
            <Button primary icon labelPosition='left'
                    onClick={() => { setForm({...BLANK}); setError(null); }}>
                <Icon name='plus'/> Tạo gói mới
            </Button>
        </div>

        {msg && <Message info onDismiss={() => setMsg(null)} content={msg}/>}

        {!packages.length
            ? <Segment placeholder>
                <Header icon>
                    <Icon name='cube' color='grey'/>
                    Chưa có gói nào
                    <Header.Subheader>
                        Chưa có gói thì học sinh không mua được lượt thi nào.
                    </Header.Subheader>
                </Header>
                <Button primary icon labelPosition='left'
                        onClick={() => { setForm({...BLANK}); setError(null); }}>
                    <Icon name='plus'/> Tạo gói mới
                </Button>
            </Segment>
            : <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Gói</Table.HeaderCell>
                        <Table.HeaderCell textAlign='center'>Số lượt</Table.HeaderCell>
                        <Table.HeaderCell textAlign='right'>Giá</Table.HeaderCell>
                        <Table.HeaderCell textAlign='center'>Trạng thái</Table.HeaderCell>
                        <Table.HeaderCell/>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {packages.map(p =>
                        <Table.Row key={p.id} disabled={!p.active}>
                            <Table.Cell>
                                <b>{p.name}</b>
                                {p.description &&
                                    <div style={{color: '#888', fontSize: '.9em'}}>
                                        {p.description}
                                    </div>}
                            </Table.Cell>
                            <Table.Cell textAlign='center'>
                                <Label circular color='blue'>{p.turns}</Label>
                            </Table.Cell>
                            <Table.Cell textAlign='right'>{money(p.price)}</Table.Cell>
                            <Table.Cell textAlign='center'>
                                {p.active
                                    ? <Label basic color='green' size='small'>Đang bán</Label>
                                    : <Label basic size='small'>Đã ẩn</Label>}
                            </Table.Cell>
                            <Table.Cell textAlign='right' collapsing>
                                <Button size='mini' basic
                                        onClick={() => { setForm({...p}); setError(null); }}>
                                    <Icon name='edit'/> Sửa
                                </Button>
                                <Button size='mini' basic icon title='Xoá gói'
                                        onClick={() => remove(p)}>
                                    <Icon name='trash alternate outline' color='red'/>
                                </Button>
                            </Table.Cell>
                        </Table.Row>)}
                </Table.Body>
            </Table>}

        {form && <Modal open size='tiny' onClose={() => setForm(null)}>
            <Modal.Header>{form.id ? 'Sửa gói' : 'Tạo gói mới'}</Modal.Header>
            <Modal.Content>
                <Form error={!!error}>
                    <Form.Input label='Tên gói' value={form.name} autoFocus
                                placeholder='Ví dụ: Cơ bản'
                                onChange={(_e, {value}) => set('name', value)}/>
                    <Form.Group widths='equal' className='tk-pkg-nums'>
                        <Form.Input label='Số lượt thi' type='number' min='1'
                                    value={form.turns}
                                    onChange={(_e, {value}) => set('turns', parseInt(value) || 0)}/>
                        <Form.Input label='Giá (đ)' type='number' min='0' step='10000'
                                    value={form.price}
                                    onChange={(_e, {value}) => set('price', parseInt(value) || 0)}/>
                        <Form.Input label='Thứ tự hiện' type='number'
                                    value={form.order}
                                    onChange={(_e, {value}) => set('order', parseInt(value) || 0)}/>
                    </Form.Group>
                    <Form.TextArea label='Mô tả' rows={2} value={form.description || ''}
                                   placeholder='Hiện trên trang bán gói cho học sinh'
                                   onChange={(_e, {value}) => set('description', String(value ?? ''))}/>
                    <Form.Checkbox label='Đang bán (bỏ chọn để ẩn khỏi trang bán)'
                                   checked={!!form.active}
                                   onChange={(_e, {checked}) => set('active', !!checked)}/>
                    <Message error content={error}/>
                </Form>
            </Modal.Content>
            <Modal.Actions>
                <Button basic onClick={() => setForm(null)}>Huỷ</Button>
                <Button primary loading={saving} onClick={save}>
                    <Icon name='check'/> Lưu
                </Button>
            </Modal.Actions>
        </Modal>}
    </div>;
}
