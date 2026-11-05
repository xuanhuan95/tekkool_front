import {useEffect, useRef, useState} from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';

import {Button, Modal} from './ui';

type Key = {label: string; name: string; latex?: string; command?: string};

// Mẫu nhanh (DS-Editor-CongThuc): a sample with its slots already filled; the teacher edits it in the LaTeX box.
const TEMPLATES: {name: string; tex: string}[] = [
    {name: 'Phân số', tex: '\\frac{a}{b}'}, {name: 'Căn bậc hai', tex: '\\sqrt{x}'}, {name: 'Mũ', tex: 'x^{n}'}, {name: 'Chỉ số dưới', tex: 'x_{i}'},
    {name: 'Tích phân', tex: '\\int_{a}^{b} f(x)\\,dx'}, {name: 'Giới hạn', tex: '\\lim_{x\\to\\infty} f(x)'},
    {name: 'Hệ phương trình', tex: '\\begin{cases} x+y=5 \\\\ x-y=1 \\end{cases}'}, {name: 'Vectơ', tex: '\\overrightarrow{AB}'},
    {name: 'Ma trận', tex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}'}, {name: 'Căn bậc n', tex: '\\sqrt[n]{x}'},
    {name: 'Giá trị tuyệt đối', tex: '|x|'}, {name: 'Tổng Σ', tex: '\\sum_{i=1}^{n} a_i'},
];

// Hoá học: quick-insert chips and sample reactions (typed text, turned into \\ce{} on save).
const CHEM_CHIPS: {label: string; add: string}[] = [
    {label: '→', add: ' -> '}, {label: '⇌', add: ' <=> '}, {label: '↑', add: ' ^ '}, {label: '↓', add: ' v '}, {label: 'X⁺', add: '^+'}, {label: 'X²⁻', add: '^2-'},
    {label: 'H₂', add: 'H2'}, {label: 't°', add: '->[t°]'}, {label: '(s)', add: '(s)'}, {label: '(l)', add: '(l)'}, {label: '(g)', add: '(g)'}, {label: '(aq)', add: '(aq)'},
];
const CHEM_SAMPLES: {label: string; text: string}[] = [
    {label: 'Phản ứng', text: '2H2 + O2 -> 2H2O'}, {label: 'Phản ứng thuận nghịch', text: 'N2 + 3H2 <=> 2NH3'},
    {label: 'Ion', text: 'SO4^2-'}, {label: 'Muối ngậm nước', text: 'CuSO4.5H2O'},
];


// `#@` = the current selection, `#?` = an empty slot (MathLive syntax).
const TABS: {id: string; label: string; keys: Key[]}[] = [
    {id: 'basic', label: 'Cơ bản', keys: [
        {label: 'a/b', name: 'Phân số', latex: '\\frac{#@}{#?}'},
        {label: '√', name: 'Căn bậc hai', latex: '\\sqrt{#@}'},
        {label: 'xⁿ', name: 'Luỹ thừa', latex: '#@^{#?}'},
        {label: 'xₙ', name: 'Chỉ số dưới', latex: '#@_{#?}'},
        {label: '∫', name: 'Tích phân', latex: '\\int_{#?}^{#?}'},
        {label: 'Σ', name: 'Tổng', latex: '\\sum_{#?}^{#?}'},
        {label: 'lim', name: 'Giới hạn', latex: '\\lim_{#?\\to #?}'},
        {label: '( )', name: 'Dấu ngoặc', latex: '\\left(#@\\right)'},
        {label: 'ⁿ√x', name: 'Căn bậc n', latex: '\\sqrt[#?]{#@}'},
        {label: '|x|', name: 'Giá trị tuyệt đối', latex: '\\left|#@\\right|'},
        {label: '{⋮', name: 'Hệ phương trình', latex: '\\begin{cases}#?\\\\#?\\end{cases}'},
        {label: '→AB', name: 'Vectơ', latex: '\\overrightarrow{#@}'},
        {label: '▦', name: 'Ma trận', latex: '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}'},
    ]},
    {id: 'func', label: 'Hàm số', keys: [
        {label: 'x', name: 'Biến x', latex: 'x'}, {label: 'π', name: 'Pi', latex: '\\pi'},
        {label: 'sin', name: 'sin', latex: '\\sin'}, {label: 'cos', name: 'cos', latex: '\\cos'},
        {label: 'tan', name: 'tan', latex: '\\tan'}, {label: 'log', name: 'log', latex: '\\log'},
        {label: 'ln', name: 'ln', latex: '\\ln'}, {label: 'e', name: 'e', latex: 'e'},
    ]},
    {id: 'sym', label: 'Ký hiệu', keys: [
        {label: '∞', name: 'Vô cực', latex: '\\infty'}, {label: '±', name: 'Cộng trừ', latex: '\\pm'},
        {label: '×', name: 'Nhân', latex: '\\times'}, {label: '÷', name: 'Chia', latex: '\\div'},
        {label: '≤', name: 'Nhỏ hơn hoặc bằng', latex: '\\le'}, {label: '≥', name: 'Lớn hơn hoặc bằng', latex: '\\ge'},
        {label: '≠', name: 'Khác', latex: '\\ne'}, {label: '⇔', name: 'Tương đương', latex: '\\Leftrightarrow'},
        {label: '←', name: 'Mũi tên trái', latex: '\\leftarrow'}, {label: '→', name: 'Mũi tên phải', latex: '\\rightarrow'},
    ]},
];

type Tab = 'quick' | 'chem' | 'kbd';
const TAB_LABEL: Record<Tab, string> = {quick: 'Mẫu nhanh', chem: 'Hoá học', kbd: 'Bàn phím'};

/** Chemistry tab: the teacher types `H2SO4`, `<=>`, `SO4^2-`; we store it wrapped for mhchem. */
export const toCe = (s: string) => /^\s*\\ce\{/.test(s) ? s.trim() : '\\ce{' + s.trim() + '}';
const fromCe = (s: string) => s.replace(/^\s*\\ce\{([\s\S]*)\}\s*$/, '$1');

/** MathLive writes an unfilled slot as `\placeholder{}`, which KaTeX does not know: draw it as an empty box. */
export const toKatex = (latex: string) => latex.replace(/\\placeholder(\[[^\]]*\])?\{[^}]*\}/g, '\\square');

const ARROWS = ['->', '<-', '<->', '<=>', '<=>>', '<<=>', '-->'];

/** What is wrong with the formula, in teacher words (null = fine or empty). KaTeX (+ mhchem for chemistry) is the judge. */
function problem(text: string, chem: boolean): string | null {
    if (!text.trim()) return null;
    if (chem) {
        const bad = (text.match(/[<=>-]{2,}/g) || []).find(t => !ARROWS.includes(t));
        if (bad) return 'Không hiểu “' + bad + '”. Dùng -> cho phản ứng hoặc <=> cho thuận nghịch.';
    } else {
        const open = (text.match(/\{/g) || []).length, close = (text.match(/\}/g) || []).length;
        if (open > close) return 'Thiếu dấu } ở cuối. Kiểm tra lại các cặp ngoặc { }.';
        if (close > open) return 'Thừa dấu }. Kiểm tra lại các cặp ngoặc { }.';
    }
    try { katex.renderToString(chem ? toCe(text) : toKatex(text), {throwOnError: true}); return null; }
    catch (e) { return (e as Error).message.replace(/^KaTeX parse error: /, ''); }
}

const render = (text: string, chem: boolean) => {
    try { return katex.renderToString(chem ? toCe(text) : toKatex(text), {throwOnError: false}); } catch { return ''; }
};

type Props = {open: boolean; latex: string; onCancel: () => void; onDone: (latex: string) => void};

/**
 * "Chèn công thức" (DS-Editor-CongThuc): three tabs, one shared preview, "Chèn công thức" off while the formula is wrong.
 * MathLive is imported HERE, inside the effect, so the library only downloads when Σ is opened — never on the exam page load.
 */
export default function MathDialog({open, latex, onCancel, onDone}: Props) {
    const box = useRef<HTMLDivElement>(null);
    const field = useRef<{value: string; insert: (s: string, o?: object) => boolean; executeCommand: (c: string) => boolean;
                          focus: () => void; remove: () => void} | null>(null);
    // Opening on a stored \ce{…} formula goes straight to the chemistry tab.
    const isChem = /^\s*\\ce\{/.test(latex);
    const [tab, setTab] = useState<Tab>(isChem ? 'chem' : 'quick');
    const [kbdTab, setKbdTab] = useState(TABS[0].id);
    const [tex, setTex] = useState(isChem ? '' : latex);
    const [chem, setChem] = useState(isChem ? fromCe(latex) : '');
    const [failed, setFailed] = useState(false);
    const onChem = tab === 'chem';
    const text = onChem ? chem : tex;
    const err = problem(text, onChem);
    const html = text.trim() && !err ? render(text, onChem) : '';

    useEffect(() => {
        if (!open) return;
        let alive = true;
        setFailed(false);
        import('mathlive').then(({MathfieldElement}) => {
            if (!alive || !box.current) return;
            // Fonts: KaTeX css is already loaded app-wide (same families); no extra downloads.
            MathfieldElement.fontsDirectory = null;
            MathfieldElement.soundsDirectory = null;
            const mf = new MathfieldElement();
            mf.mathVirtualKeyboardPolicy = 'manual';
            mf.value = isChem ? '' : latex;
            mf.setAttribute('aria-label', 'Công thức');
            mf.addEventListener('input', () => setTex(mf.value));
            box.current.appendChild(mf);
            field.current = mf as never;
        }).catch(() => alive && setFailed(true));
        return () => { alive = false; field.current?.remove(); field.current = null; };
    }, [open, latex]);

    // Entering the keyboard tab: show what the other tab built, then focus.
    useEffect(() => {
        const mf = field.current;
        if (tab !== 'kbd' || !mf) return;
        if (mf.value !== tex) mf.value = tex;
        mf.focus();
    }, [tab]);

    const press = (k: Key) => { field.current?.insert(k.latex!, {focus: true}); };
    const keys = TABS.find(t => t.id === kbdTab)?.keys ?? [];
    const done = () => onDone(onChem ? toCe(chem) : toKatex(tex));
    const addChem = (t: string) => setChem(c => c + t);

    return <Modal open={open} onClose={onCancel} title='Chèn công thức' size='md' showClose
                  footer={<>
                      <Button onClick={onCancel}>Huỷ</Button>
                      <Button variant='primary' disabled={!text.trim() || !!err} onClick={done}>Chèn công thức</Button>
                  </>}>
        <div className='tt-math'>
            <div role='tablist' aria-label='Kiểu công thức' className='tt-math-tabs tt-math-tabs--seg'>
                {(Object.keys(TAB_LABEL) as Tab[]).map(t => <button key={t} type='button' role='tab' aria-selected={tab === t}
                                       className={'tt-math-tab' + (tab === t ? ' on' : '')}
                                       onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}
            </div>

            {tab === 'quick' && <>
                <span className='tt-math-hint'>Chọn mẫu, rồi điền vào ô trống</span>
                <div className='tt-math-tpls' role='group' aria-label='Mẫu công thức'>
                    {TEMPLATES.map(t => <button key={t.name} type='button' title={t.name} aria-label={t.name}
                                                className={'tt-math-tpl' + (tex === t.tex ? ' on' : '')} onClick={() => setTex(t.tex)}>
                        <span dangerouslySetInnerHTML={{__html: render(t.tex, false)}}/><small>{t.name}</small>
                    </button>)}
                </div>
            </>}

            {tab === 'chem' && <>
                <span className='tt-math-hint'>Gõ công thức hoá học (H2SO4, SO4^2-, -&gt;, &lt;=&gt;). Hệ thống tự đổi chỉ số dưới.</span>
                <input className={'tt-math-chem-input' + (err ? ' bad' : '')} aria-label='Công thức hoá học' value={chem} autoFocus
                       aria-invalid={!!err} onChange={e => setChem(e.target.value)}/>
                <span className='tt-math-hint'>Chèn nhanh</span>
                <div className='tt-math-chips' role='group' aria-label='Chèn nhanh'>
                    {CHEM_CHIPS.map(c => <button key={c.label} type='button' className='tt-math-chip' onClick={() => addChem(c.add)}>{c.label}</button>)}
                </div>
                <span className='tt-math-hint'>Mẫu</span>
                <div className='tt-math-chips' role='group' aria-label='Mẫu'>
                    {CHEM_SAMPLES.map(c => <button key={c.label} type='button' className='tt-math-chip small' onClick={() => setChem(c.text)}>{c.label}</button>)}
                </div>
            </>}

            {/* MathLive host: always mounted (the library loads once), only shown on the keyboard tab. */}
            <div ref={box} className='tt-math-field' hidden={tab !== 'kbd'}/>
            {tab === 'kbd' && <>
                {failed && <p role='alert' className='vt-field-error'>Không tải được bàn phím công thức. Kiểm tra mạng rồi mở lại.</p>}
                <div role='tablist' aria-label='Nhóm ký hiệu' className='tt-math-tabs'>
                    {TABS.map(t => <button key={t.id} type='button' role='tab' aria-selected={kbdTab === t.id}
                                           className={'tt-math-tab' + (kbdTab === t.id ? ' on' : '')}
                                           onClick={() => setKbdTab(t.id)}>{t.label}</button>)}
                </div>
                <div className='tt-math-keys' role='group' aria-label='Ký hiệu'>
                    {keys.map(k => <button key={k.name} type='button' className='tt-math-key vt-tip' title={k.name} aria-label={k.name}
                                           data-tip={k.name} onClick={() => press(k)}>{k.label}</button>)}
                    <button type='button' className='tt-math-key vt-tip' title='Xoá lùi' aria-label='Xoá lùi' data-tip='Xoá lùi'
                            onClick={() => field.current?.executeCommand('deleteBackward')}>⌫</button>
                </div>
            </>}

            {err && <div role='alert' className='tt-math-err'>
                <b>Công thức chưa hợp lệ</b><span>{err}</span>
            </div>}
            <div className='tt-math-prev' aria-label='Xem trước'>
                <small>Xem trước</small>
                <span dangerouslySetInnerHTML={{__html: html}}/>
            </div>
            {tab === 'quick' && <>
                <label className='tt-math-hint' htmlFor='tt-math-tex'>Sửa trực tiếp (LaTeX, không bắt buộc)</label>
                <input id='tt-math-tex' className={'tt-math-tex' + (err ? ' bad' : '')} value={tex} spellCheck={false}
                       aria-invalid={!!err} onChange={e => setTex(e.target.value)}/>
            </>}
            {onChem && <span className='tt-math-hint'>Mã lưu: <code>{chem.trim() ? toCe(chem) : '\\ce{ }'}</code></span>}
        </div>
    </Modal>;
}
