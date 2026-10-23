import {useState} from 'react';
import type {FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';

import Api from '../../services/api';
import {Avatar, Button, Card, Modal, PasswordField, SkeletonCard, Switch, TextField, TitleChip, notify} from '../../components/ui';
import {IconCrown, IconEdit} from '../../components/ui/icons';
import {useAuthStore} from '../../stores/authStore';
import {useWallet} from '../../queries/wallet';
import {PROFILE_KEY, useMeProfile, useRankingPrivacy} from '../../queries/student';
import type {MeProfile} from '../../types/student';
import {LoadError, PageHead, hsPath, titleHint} from './common';
import {errorText} from '../../lib/format';
import {passwordApiError, validateName, validatePassword} from './account';
import type {PasswordErrors, PasswordForm} from './account';

function RenameDialog({open, current, onClose}: {open: boolean; current: string; onClose: () => void}) {
    const qc = useQueryClient();
    const setUser = useAuthStore(s => s.setUser);
    const user = useAuthStore(s => s.user);
    const [name, setName] = useState(current);
    const [err, setErr] = useState<string>();
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const v = validateName(name);
        if (v) return setErr(v);
        setBusy(true);
        try {
            const r = await Api.post<{name: string}>('me/update', {name: name.trim()});
            qc.setQueryData<MeProfile>(PROFILE_KEY, p => p && {...p, name: r.name});
            if (user) setUser({...user, name: r.name});   // header avatar + greeting
            qc.invalidateQueries({queryKey: ['ranking']});
            notify.success('Đã đổi tên hiển thị');
            onClose();
        } catch (ex) {
            setErr(errorText(ex, 'Không đổi được tên. Thử lại sau.'));
        } finally {
            setBusy(false);
        }
    };

    return <Modal open={open} onClose={busy ? undefined : onClose} title='Đổi tên hiển thị'
                  footer={<>
                      <Button onClick={onClose} disabled={busy}>Huỷ</Button>
                      <Button variant='primary' type='submit' form='hs-rename' loading={busy}>Lưu</Button>
                  </>}>
        <form id='hs-rename' className='hs-form' onSubmit={submit} noValidate>
            <TextField label='Tên hiển thị' value={name} autoComplete='name' maxLength={60} error={err}
                       hint='Tên này hiện trên bảng xếp hạng (trừ khi bạn ẩn tên).'
                       onChange={e => { setName(e.target.value); setErr(undefined); }}/>
        </form>
    </Modal>;
}

const EMPTY_PW: PasswordForm = {old: '', next: '', confirm: ''};

function PasswordDialog({open, onClose}: {open: boolean; onClose: () => void}) {
    const [f, setF] = useState<PasswordForm>(EMPTY_PW);
    const [errs, setErrs] = useState<PasswordErrors>({});
    const [err, setErr] = useState<string>();
    const [busy, setBusy] = useState(false);
    const set = (k: keyof PasswordForm, v: string) => {
        setF(x => ({...x, [k]: v}));
        setErrs(x => ({...x, [k]: undefined}));
        setErr(undefined);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const v = validatePassword(f);
        setErrs(v);
        if (Object.values(v).some(Boolean)) return;
        setBusy(true);
        try {
            await Api.post('me/change_password', {old_password: f.old, new_password: f.next});
            notify.success('Đã đổi mật khẩu', 'Lần sau đăng nhập bằng mật khẩu mới.');
            setF(EMPTY_PW);
            onClose();
        } catch (ex) {
            const m = passwordApiError(ex);
            if (m.field) setErrs({[m.field]: m.message});
            else setErr(m.message);
        } finally {
            setBusy(false);
        }
    };

    return <Modal open={open} onClose={busy ? undefined : onClose} title='Đổi mật khẩu'
                  footer={<>
                      <Button onClick={onClose} disabled={busy}>Huỷ</Button>
                      <Button variant='primary' type='submit' form='hs-password' loading={busy}>Đổi mật khẩu</Button>
                  </>}>
        <form id='hs-password' className='hs-form' onSubmit={submit} noValidate>
            {err && <p role='alert' className='vt-field-error'>{err}</p>}
            <PasswordField label='Mật khẩu hiện tại' autoComplete='current-password' value={f.old} error={errs.old}
                           onChange={e => set('old', e.target.value)}/>
            <PasswordField label='Mật khẩu mới' autoComplete='new-password' value={f.next} error={errs.next}
                           hint='Ít nhất 6 ký tự.' onChange={e => set('next', e.target.value)}/>
            <PasswordField label='Nhập lại mật khẩu mới' autoComplete='new-password' value={f.confirm} error={errs.confirm}
                           onChange={e => set('confirm', e.target.value)}/>
        </form>
    </Modal>;
}

function PrivacySwitch({hidden}: {hidden: boolean}) {
    const m = useRankingPrivacy();
    // Optimistic: show the new state while saving; on error it falls back to the server value.
    const shownHidden = m.isPending && m.variables !== undefined ? m.variables : hidden;
    return <div className='hs-setting' style={{cursor: 'default'}}>
        <Switch checked={!shownHidden} disabled={m.isPending}
                label={<span className='hs-setting-main'><span>Hiện tên trên bảng xếp hạng</span>
                    <span className='hs-meta'>Tắt để hiện là “Học sinh ẩn danh”</span></span>}
                onChange={show => m.mutate(!show, {
                    onSuccess: r => notify.success(r.hide_ranking_name ? 'Đã ẩn tên khỏi bảng xếp hạng' : 'Tên bạn đã hiện trên bảng xếp hạng'),
                    onError: e => notify.error('Không lưu được', errorText(e, 'Thử lại sau.')),
                })}/>
    </div>;
}

/** HS-TaiKhoan: profile, title, turns, links, ranking privacy, rename, change password, sign out. */
export default function AccountPage() {
    const authUser = useAuthStore(s => s.user);
    const signOut = useAuthStore(s => s.signOut);
    const profile = useMeProfile();
    const wallet = useWallet();
    const [dialog, setDialog] = useState<'rename' | 'password' | null>(null);
    const [leaving, setLeaving] = useState(false);

    const title = profile.data?.title ?? null;
    const next = titleHint(profile.data);
    const name = profile.data?.name || authUser?.name || '';
    const email = profile.data?.email || authUser?.email || '';

    return <div className='hs-page' style={{maxWidth: 720}}>
        <PageHead title='Tài khoản'/>

        <Card as='section' className='hs-card-pad' aria-label='Thông tin của bạn'>
            <div className='hs-row' style={{justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 14}}>
                <Avatar name={name}/>
                <div className='hs-col2'>
                    <span className='hs-h2' style={{overflowWrap: 'anywhere'}}>{name || 'Học sinh'}</span>
                    <span className='hs-meta' style={{overflowWrap: 'anywhere'}}>{email}</span>
                    {title && <span><TitleChip title={title}/></span>}
                </div>
            </div>
            {next && <div className='hs-row' style={{justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 8}}>
                <IconCrown size={16}/>
                <span className='hs-meta'><b>{title ? 'Bậc tiếp theo' : 'Danh hiệu đầu tiên'}: {next.name}.</b> {next.hint}.</span>
            </div>}
        </Card>

        <Card as='section' className='hs-card-pad' aria-label='Lượt thi'>
            <div className='hs-row'>
                <div className='hs-col2'>
                    <span className='hs-meta'>Lượt thi còn lại</span>
                    <span className='hs-big vt-num'>{wallet.data ? wallet.data.remaining + ' lượt' : wallet.isError ? '—' : '…'}</span>
                </div>
                <span className='hs-meta'>Không hết hạn</span>
            </div>
            <nav aria-label='Gói và lịch sử' className='hs-row' style={{justifyContent: 'flex-start', gap: 16}}>
                <Link to={hsPath.packages} className='vt-link'>Gói thi</Link>
                <Link to='/billing' className='vt-link'>Lịch sử mua gói</Link>
                <Link to={hsPath.history} className='vt-link'>Lịch sử làm bài</Link>
            </nav>
        </Card>

        <section className='hs-sec' aria-labelledby='hs-settings'>
            <h2 id='hs-settings' className='hs-h2'>Cài đặt</h2>
            {profile.isPending ? <SkeletonCard label='Đang tải cài đặt'/>
                : profile.isError ? <LoadError error={profile.error} onRetry={() => profile.refetch()} what='cài đặt tài khoản'/>
                : <Card flush className='hs-settings'>
                    <PrivacySwitch hidden={profile.data.hide_ranking_name}/>
                    <button type='button' className='hs-setting' onClick={() => setDialog('rename')}>
                        <span className='hs-setting-main'><span>Đổi tên hiển thị</span><span className='hs-meta'>{name}</span></span>
                        <IconEdit/>
                    </button>
                    <button type='button' className='hs-setting' onClick={() => setDialog('password')}>
                        <span className='hs-setting-main'><span>Đổi mật khẩu</span></span>
                        <IconEdit/>
                    </button>
                </Card>}
        </section>

        <Button variant='danger' block loading={leaving} loadingText='Đang đăng xuất…'
                onClick={() => { setLeaving(true); signOut(); }}>Đăng xuất</Button>

        {dialog === 'rename' && <RenameDialog open current={name} onClose={() => setDialog(null)}/>}
        {dialog === 'password' && <PasswordDialog open onClose={() => setDialog(null)}/>}
    </div>;
}
