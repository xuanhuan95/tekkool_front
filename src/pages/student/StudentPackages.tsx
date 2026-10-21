import {useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';

import Api from '../../services/api';
import {useWallet} from '../../queries/wallet';
import {useMediaQuery, DESKTOP} from '../useMediaQuery';
import type {Package} from '../../types/payment';
import {Icon3D, IconCheck} from './icons';
import type {Art} from './icons';

const money = (n: number) => (n || 0).toLocaleString('vi-VN') + 'đ';
// Teachers name packages "Gói cơ bản" — don't render "Gói Gói cơ bản".
const bare = (name: string) => name.replace(/^gói\s+/i, '');
// Design order: Khởi động / Tăng tốc / Về đích. ponytail: picked by position, add a field when teachers want to choose.
const ART: {art: Art; soft: string}[] = [
    {art: 'mountain', soft: 'var(--primary-soft)'},
    {art: 'bolt', soft: 'var(--accent-soft)'},
    {art: 'trophy', soft: 'var(--primary-soft)'},
];
const art = (i: number) => ART[i % ART.length];
// The package's description, one benefit per line — the design's feature list.
const features = (p?: Package) => (p?.description || '').split('\n').map(s => s.trim()).filter(Boolean);

/** Student "Gói thi" page — Subscription.dc.html (mobile) / SubscriptionDesktop.dc.html. */
export default function StudentPackages() {
    const desktop = useMediaQuery(DESKTOP);
    const navigate = useNavigate();
    const {search} = useLocation();
    const {data: packages} = useQuery({
        queryKey: ['package', 'list', false],
        queryFn: () => Api.get<Package[]>('package/list'),
    });
    const {data: wallet} = useWallet();
    const [picked, setPicked] = useState<string | null>(null);

    const list = packages || [];
    // Default to the middle plan, as the design does ("Tăng tốc").
    const sel = list.find(p => p.id === picked) || list[Math.min(1, list.length - 1)];
    const buy = () => sel && navigate('/payment/' + sel.id);
    const outOfTurns = search.indexOf('het-luot=1') >= 0;

    const usedPct = wallet && wallet.bought ? Math.round(100 * wallet.used / wallet.bought) : 0;
    const walletBox = wallet && <>
        <span className='spt-pk-w-num'><b>{wallet.remaining}</b><span>lượt thi còn lại</span></span>
        <span className='spt-bar'><span style={{width: usedPct + '%', background: 'var(--accent)'}}/></span>
        <small>Đã dùng {wallet.used}/{wallet.bought} lượt</small>
    </>;
    const warn = outOfTurns && <div className='spt-pk-warn' role='alert'>
        Bạn đã hết lượt thi — chọn một gói bên dưới để tiếp tục làm bài.
    </div>;
    const empty = packages && !list.length &&
        <div className='spt-card spt-empty'>Chưa có gói nào đang bán — liên hệ giáo viên của bạn.</div>;

    if (!desktop) return <div className='spt-pk-m'>
        <div className='spt-pk-m-body'>
            <h1>Gói thi thử</h1>
            <section className='spt-pk-m-hero'>
                <img src='/mascot/cheer.svg' alt=''/>
                <span className='spt-pk-w'>{walletBox}</span>
            </section>
            {warn}
            <h2>Chọn gói phù hợp</h2>
            {empty}
            <div role='radiogroup' aria-label='Gói lượt thi' className='spt-pk-m-list'>
                {list.map((p, i) => {
                    const on = p === sel;
                    return <button key={p.id} type='button' role='radio' aria-checked={on}
                                   className={'spt-pk-m-plan' + (on ? ' on' : '')} onClick={() => setPicked(p.id)}>
                        <span className='spt-pk-ic' style={{background: art(i).soft}}><Icon3D name={art(i).art} size={24}/></span>
                        <span className='spt-pk-m-name'><b>{p.name}</b><small>{p.turns} lượt thi</small></span>
                        <span className='spt-pk-m-price'><b>{money(p.price)}</b><small>một lần</small></span>
                        <span className='spt-pk-radio'><span/></span>
                    </button>;
                })}
            </div>
            {features(sel).length > 0 && <ul className='spt-pk-feats spt-card'>
                {features(sel).map(f => <li key={f}><span><IconCheck/></span>{f}</li>)}
            </ul>}
        </div>
        {sel && <div className='spt-pk-m-pay'>
            <button type='button' className='spt-btn' onClick={buy}>Mua gói {bare(sel.name)} · {money(sel.price)}</button>
        </div>}
    </div>;

    return <div className='spt-pk'>
        <section className='spt-pk-hero'>
            <img src='/mascot/cheer.svg' alt=''/>
            <div className='spt-pk-hero-text'>
                <h1>Luyện không giới hạn,<br/><span>tự tin vào phòng thi</span></h1>
                <p>Mở khóa đề Premium, lời giải chi tiết và phân tích điểm yếu theo chuyên đề.</p>
            </div>
            {wallet && <div className='spt-pk-w spt-pk-hero-w'><small>Lượt thi của bạn</small>{walletBox}</div>}
        </section>
        {warn}
        {empty}
        <div role='radiogroup' aria-label='Gói lượt thi' className='spt-pk-grid'>
            {list.map((p, i) => {
                const on = p === sel;
                return <div key={p.id} className={'spt-pk-plan' + (on ? ' on' : '')}>
                    <div className='spt-pk-plan-head'>
                        <span className='spt-pk-ic' style={{background: art(i).soft}}><Icon3D name={art(i).art} size={26}/></span>
                        <span><b>{p.name}</b><small>{p.turns} lượt thi</small></span>
                    </div>
                    <span className='spt-pk-price'><b>{money(p.price)}</b><small>một lần</small></span>
                    <ul className='spt-pk-feats'>
                        {features(p).map(f => <li key={f}><span><IconCheck/></span>{f}</li>)}
                    </ul>
                    <button type='button' role='radio' aria-checked={on} className='spt-pk-pick'
                            onClick={() => setPicked(p.id)}>{on ? 'Đã chọn' : 'Chọn gói'}</button>
                </div>;
            })}
        </div>
        {sel && <div className='spt-pk-bar spt-card'>
            <span><small>Gói đã chọn</small><b>Gói {bare(sel.name)} · {money(sel.price)}</b></span>
            <button type='button' className='spt-btn' onClick={buy}>Thanh toán</button>
        </div>}
    </div>;
}
