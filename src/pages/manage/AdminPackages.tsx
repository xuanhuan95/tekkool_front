import {useState} from 'react';
import type {FormEvent} from 'react';

import {Badge, IconButton, Button, Card, CardTitle, ConfirmDialog, EmptyState, ErrorState, PageColumns, PageTitle, SkeletonCard,
    Switch, Table, TextArea, TextField, buttonClass, icons, notify} from '../../components/ui';
import type {Column} from '../../components/ui';
import {useAdminPackages, usePackageMutations} from '../../queries/manage';
import type {PackageInput} from '../../queries/manage';
import type {Package} from '../../types/payment';
import PackageCard from '../pay/PackageCard';
import {errorText, formatMoney, groupDigits} from '../../lib/format';
import {PackagesSubNav} from './shared';

// Same limits as apis/package.py.
export const MAX_TURNS = 1000;
export const MAX_PRICE = 100000000;
export const MAX_NAME = 100;
export const MAX_DESC = 1000;

export type PackageDraft = {name: string; turns: string; price: string; description: string; order: string;
    active: boolean; featured: boolean};

/** "99.000" / "99000đ" -> 99000; anything without digits -> NaN. */
export function parseMoney(s: string): number {
    const digits = (s || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : NaN;
}

export function draftOf(p?: Package): PackageDraft {
    return p
        ? {name: p.name, turns: String(p.turns), price: groupDigits(p.price), description: p.description || '',
            order: String(p.order ?? 0), active: p.active !== false, featured: !!p.featured}
        : {name: '', turns: '', price: '', description: '', order: '', active: true, featured: false};
}

/** Field errors (Vietnamese, same rules as the BE) — empty object = valid. */
export function validatePackage(d: PackageDraft): Partial<Record<keyof PackageDraft, string>> {
    const e: Partial<Record<keyof PackageDraft, string>> = {};
    const name = d.name.trim();
    if (!name || name.length > MAX_NAME) e.name = `Tên gói không được trống, tối đa ${MAX_NAME} ký tự`;
    const turns = Number(d.turns);
    if (!/^\d+$/.test(d.turns.trim()) || turns < 1 || turns > MAX_TURNS) e.turns = `Số lượt từ 1 đến ${groupDigits(MAX_TURNS)}`;
    const price = parseMoney(d.price);
    if (isNaN(price) || price > MAX_PRICE) e.price = `Giá từ 0 đến ${groupDigits(MAX_PRICE)}đ`;
    if (d.description.trim().length > MAX_DESC) e.description = `Mô tả tối đa ${MAX_DESC} ký tự`;
    if (d.order.trim() && !/^\d+$/.test(d.order.trim())) e.order = 'Thứ tự là số không âm';
    return e;
}

export function toInput(d: PackageDraft): PackageInput {
    const out: PackageInput = {name: d.name.trim(), turns: Number(d.turns), price: parseMoney(d.price),
        description: d.description.trim(), active: d.active, featured: d.featured};
    if (d.order.trim()) out.order = Number(d.order);
    return out;
}

/** ids with item i moved one step up (-1) or down (+1); unchanged at the edges. */
export function moveId(ids: string[], i: number, dir: -1 | 1): string[] {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return ids;
    const out = ids.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
}

function PackageForm({pkg, onDone}: {pkg: Package | null; onDone: () => void}) {
    const {create, update, remove} = usePackageMutations();
    const [d, setD] = useState<PackageDraft>(() => draftOf(pkg || undefined));
    const [tried, setTried] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const errs = validatePackage(d);
    const saving = create.isPending || update.isPending;
    const show = (k: keyof PackageDraft) => (tried ? errs[k] : undefined);

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        setTried(true);
        setServerError(null);
        if (Object.keys(errs).length || saving) return;
        const body = toInput(d);
        const opts = {
            onSuccess: () => { notify.success(pkg ? 'Đã lưu gói' : 'Đã tạo gói', body.name); onDone(); },
            onError: (err: unknown) => setServerError(errorText(err, 'Không lưu được gói')),
        };
        if (pkg) update.mutate({pkgId: pkg.id, body}, opts); else create.mutate(body, opts);
    };

    const doRemove = () => remove.mutate(pkg!.id, {
        onSuccess: r => {
            setConfirmRemove(false);
            if (r.hidden) notify.success('Đã ngừng bán', r.message || 'Gói đã có người mua nên chỉ ẩn đi.');
            else notify.success('Đã xoá gói', pkg!.name);
            onDone();
        },
        onError: err => { setConfirmRemove(false); setServerError(errorText(err, 'Không xoá được gói')); },
    });

    const price = parseMoney(d.price);
    const preview = {name: d.name || 'Tên gói', turns: Number(d.turns) || 0, price: isNaN(price) ? 0 : price,
        description: d.description, featured: d.featured};

    return <>
        <Card as='section' aria-label={pkg ? 'Sửa gói' : 'Gói mới'}>
            <form className='vt-mg-stack' onSubmit={submit} noValidate>
                <CardTitle>{pkg ? 'Sửa gói' : 'Gói mới'}</CardTitle>
                <TextField label='Tên gói' value={d.name} error={show('name')} maxLength={MAX_NAME}
                           onChange={e => setD({...d, name: e.target.value})}/>
                <TextField label='Số lượt' type='number' min={1} max={MAX_TURNS} inputMode='numeric' value={d.turns} error={show('turns')}
                           onChange={e => setD({...d, turns: e.target.value})}/>
                <TextField label='Giá (đ)' inputMode='numeric' value={d.price} error={show('price')}
                           hint={price === 0 ? 'Giá 0đ: học sinh không thanh toán được gói này.' : undefined}
                           onChange={e => setD({...d, price: e.target.value})}
                           onBlur={() => { const v = parseMoney(d.price); if (!isNaN(v)) setD(x => ({...x, price: groupDigits(v)})); }}/>
                <TextArea label='Mô tả' rows={3} value={d.description} error={show('description')}
                          onChange={e => setD({...d, description: e.target.value})}/>
                <TextField label='Thứ tự' type='number' min={0} inputMode='numeric' value={d.order} error={show('order')}
                           hint='Nhỏ hiển thị trước trên trang “Gói thi” của học sinh.'
                           onChange={e => setD({...d, order: e.target.value})}/>
                <Switch checked={d.active} onChange={v => setD({...d, active: v})} label='Đang bán'/>
                <Switch checked={d.featured} onChange={v => setD({...d, featured: v})} label='Gắn nhãn “Phổ biến”'/>
                <p className='vt-muted vt-mg-small'>Lượt không hết hạn. Sửa số lượt/giá không đổi đơn đã mua. Gói đã có người mua chỉ ngừng bán, không xoá.</p>
                {serverError && <p role='alert' className='vt-mg-err'>{serverError}</p>}
                <div className='vt-mg-form-actions'>
                    {pkg && <Button variant='danger' size='sm' onClick={() => setConfirmRemove(true)} disabled={saving}>
                        {pkg.sold ? 'Ngừng bán' : 'Xoá gói'}</Button>}
                    <span style={{flexGrow: 1}}/>
                    <Button onClick={onDone} disabled={saving}>Huỷ</Button>
                    <Button type='submit' variant='primary' loading={saving} loadingText='Đang lưu…'>{pkg ? 'Lưu thay đổi' : 'Tạo gói'}</Button>
                </div>
            </form>
        </Card>
        <div className='vt-mg-stack'>
            <span className='vt-mg-preview-label'>Xem trước — học sinh sẽ thấy</span>
            <PackageCard pkg={preview} note=' · không hết hạn'
                         action={<span className={buttonClass({variant: d.featured ? 'primary' : 'secondary', block: true})} aria-hidden='true'>Chọn gói</span>}/>
        </div>
        <ConfirmDialog open={confirmRemove} tone='danger' loading={remove.isPending}
                       title={pkg?.sold ? 'Ngừng bán gói?' : 'Xoá gói?'}
                       message={pkg?.sold
                           ? `${pkg?.name} đã có ${pkg?.sold} đơn nên chỉ được ẩn khỏi trang bán; hoá đơn cũ giữ nguyên.`
                           : `${pkg?.name} chưa có ai mua, gói sẽ bị xoá hẳn.`}
                       confirmLabel={pkg?.sold ? 'Ngừng bán' : 'Xoá'} onConfirm={doRemove} onCancel={() => setConfirmRemove(false)}/>
    </>;
}

/** "Quản lý gói" (AD-Goi). Route /manage/packages. Admin only on the BE (package/create|update|reorder|remove). */
export default function AdminPackages() {
    const {data, error, refetch, isFetching} = useAdminPackages();
    const {reorder} = usePackageMutations();
    const [editing, setEditing] = useState<Package | 'new' | null>(null);
    const list = data || [];
    const ids = list.map(p => p.id);

    const move = (i: number, dir: -1 | 1) => reorder.mutate(moveId(ids, i, dir), {
        onError: e => notify.error('Không sắp xếp được', errorText(e, 'Thử lại sau.')),
    });

    const columns: Column<Package>[] = [
        {key: 'name', header: 'Tên gói', emphasis: 'strong', render: p => <span className='vt-mg-person'>
            {p.name}{p.featured && <Badge tone='popular'>Phổ biến</Badge>}</span>},
        {key: 'turns', header: 'Số lượt', align: 'right', render: p => <span className='vt-num'>{p.turns}</span>},
        {key: 'price', header: 'Giá', align: 'right', render: p => <span className='vt-num'>{formatMoney(p.price)}</span>},
        {key: 'order', header: 'Thứ tự', render: (p, i) => <span className='vt-mg-order'>
            <span className='vt-num' style={{minWidth: 20}}>{p.active ? p.order : '—'}</span>
            <IconButton variant='outline' label={'Đưa ' + p.name + ' lên'} icon={<icons.IconArrowUp/>} disabled={i === 0 || reorder.isPending}
                        onClick={() => move(i, -1)}/>
            <IconButton variant='outline' label={'Đưa ' + p.name + ' xuống'} icon={<icons.IconArrowDown size={18}/>} disabled={i === list.length - 1 || reorder.isPending}
                        onClick={() => move(i, 1)}/>
        </span>},
        {key: 'active', header: 'Trạng thái', render: p => p.active
            ? <Badge tone='ok'>Đang bán</Badge> : <Badge tone='draft'>Ngừng bán</Badge>},
        {key: 'sold', header: <span title='Số đơn thanh toán thành công'>Đã bán</span>, align: 'right', render: p => <span className='vt-num'>{groupDigits(p.sold || 0)}</span>},
        {key: 'actions', header: 'Thao tác', sticky: true, render: p => editing !== 'new' && editing?.id === p.id
            ? <span className='vt-muted'>Đang sửa</span>
            : <Button size='sm' variant='ghost' icon={<icons.IconEdit/>} aria-label={'Sửa ' + p.name}
                      onClick={() => setEditing(p)}>Sửa</Button>},
    ];

    const main = <>
        {error && !data
            ? <ErrorState title='Không tải được danh sách gói' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !data
                ? <SkeletonCard label='Đang tải gói'/>
                : !list.length
                    ? <EmptyState title='Chưa có gói nào' description='Tạo gói đầu tiên để học sinh mua lượt.'
                                  action={<Button variant='primary' onClick={() => setEditing('new')}>+ Gói mới</Button>}/>
                    : <Table caption='Danh sách gói' columns={columns} rows={list} rowKey={p => p.id} minWidth={760}
                             isHighlighted={p => editing !== 'new' && editing?.id === p.id}/>}
    </>;

    const side = editing
        ? <PackageForm key={editing === 'new' ? 'new' : editing.id} pkg={editing === 'new' ? null : editing} onDone={() => setEditing(null)}/>
        : <Card as='section' className='vt-mg-stack'>
            <CardTitle>Sửa gói</CardTitle>
            <EmptyState bare title='Chọn một gói để sửa'/>
        </Card>;

    return <div className='vt-mg-page'>
        <PackagesSubNav/>
        <div className='vt-mg-head'>
            <div>
                <PageTitle>Quản lý gói</PageTitle>
            </div>
            <Button variant='primary' onClick={() => setEditing('new')}>+ Gói mới</Button>
        </div>
        <PageColumns main={main} side={<div className='vt-mg-side'>{side}</div>}/>
    </div>;
}
