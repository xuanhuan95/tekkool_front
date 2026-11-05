import {useState} from 'react';

import {Modal} from './ui';

const GROUPS: {id: string; label: string; chars: string}[] = [
    {id: 'greek', label: 'Hy Lạp', chars: 'α β γ δ ε θ λ μ π ρ σ τ φ ω Δ Φ Ω Σ'},
    {id: 'cmp', label: 'So sánh', chars: '≤ ≥ ≠ ≈ ≡ ± × ÷ ∞ ∈ ∉ ⊂ ∪ ∩ ∃ ∀'},
    {id: 'arrow', label: 'Mũi tên', chars: '→ ← ↑ ↓ ⇌ ⇒ ⇔ ↔'},
    {id: 'unit', label: 'Đơn vị', chars: '° ′ ″ ‰ µ Å ℃'},
    {id: 'script', label: 'Chỉ số', chars: '⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉'},
];
const RECENT_KEY = 'tt-recent-chars';

const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

/**
 * "Ký tự đặc biệt" (DS-Editor-KyTu): plain Unicode, not a formula. Stays open so several characters go in a row;
 * the last 5 used are remembered on this machine (localStorage, optional).
 */
export default function CharDialog({open, onClose, onInsert}: {open: boolean; onClose: () => void; onInsert: (c: string) => void}) {
    const [tab, setTab] = useState(GROUPS[0].id);
    const [recent, setRecent] = useState(readRecent);
    const pick = (c: string) => {
        onInsert(c);
        const next = [c, ...recent.filter(x => x !== c)].slice(0, 5);
        setRecent(next);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode: no memory, still works */ }
    };
    const key = (c: string) => <button key={c} type='button' className='tt-math-key vt-tip' title={c} aria-label={c} data-tip={c}
                                       onMouseDown={e => e.preventDefault()} onClick={() => pick(c)}>{c}</button>;

    return <Modal open={open} onClose={onClose} title='Ký tự đặc biệt' size='md' mobileSheet showClose>
        <div className='tt-math'>
            <div role='tablist' aria-label='Nhóm ký tự' className='tt-math-tabs'>
                {GROUPS.map(g => <button key={g.id} type='button' role='tab' aria-selected={tab === g.id}
                                         className={'tt-math-tab' + (tab === g.id ? ' on' : '')}
                                         onClick={() => setTab(g.id)}>{g.label}</button>)}
            </div>
            <div className='tt-math-keys tt-math-keys--chars' role='group' aria-label='Ký tự'>
                {GROUPS.find(g => g.id === tab)!.chars.split(' ').map(key)}
            </div>
            {!!recent.length && <>
                <div className='vt-muted'>Dùng gần đây (máy này)</div>
                <div className='tt-math-keys tt-math-keys--chars' role='group' aria-label='Dùng gần đây'>{recent.map(key)}</div>
            </>}
            <span className='vt-muted'>Bấm để chèn tại con trỏ. Cửa sổ giữ mở để chèn nhiều ký tự; nhấn Esc để đóng.</span>
        </div>
    </Modal>;
}
