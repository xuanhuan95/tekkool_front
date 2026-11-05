import {useEffect, useRef, useState} from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';

import {Button, Modal} from './ui';

type Key = {label: string; name: string; latex?: string; command?: string};

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

const CHEM = 'chem';

/** Chemistry tab: the teacher types `H2SO4`, `<=>`, `SO4^2-`; we store it wrapped for mhchem. */
export const toCe = (s: string) => /^\s*\\ce\{/.test(s) ? s.trim() : '\\ce{' + s.trim() + '}';
const fromCe = (s: string) => s.replace(/^\s*\\ce\{([\s\S]*)\}\s*$/, '$1');

/** KaTeX preview of a `\ce{}` string, or the reason it is wrong. */
function chemPreview(text: string): {html: string; error: string | null} {
    if (!text.trim()) return {html: '', error: null};
    try { return {html: katex.renderToString(toCe(text), {throwOnError: true}), error: null}; }
    catch (e) { return {html: '', error: 'Công thức hoá học chưa đúng: ' + (e as Error).message.replace(/^KaTeX parse error: /, '')}; }
}

/** MathLive writes an unfilled slot as `\placeholder{}`, which KaTeX does not know: draw it as an empty box. */
export const toKatex = (latex: string) => latex.replace(/\\placeholder(\[[^\]]*\])?\{[^}]*\}/g, '\\square');

type Props = {open: boolean; latex: string; onCancel: () => void; onDone: (latex: string) => void};

/**
 * Formula keyboard (student editor, DS-Editor #11). MathLive is imported HERE, inside the effect, so the library
 * only downloads when a student opens Σ — never on the exam page load. Our own palette replaces MathLive's keyboard.
 */
export default function MathDialog({open, latex, onCancel, onDone}: Props) {
    const box = useRef<HTMLDivElement>(null);
    const field = useRef<{value: string; insert: (s: string, o?: object) => boolean; executeCommand: (c: string) => boolean;
                          focus: () => void; remove: () => void} | null>(null);
    // Opening on a stored \ce{…} formula goes straight to the chemistry tab.
    const isChem = /^\s*\\ce\{/.test(latex);
    const [tab, setTab] = useState(isChem ? CHEM : TABS[0].id);
    const [chem, setChem] = useState(isChem ? fromCe(latex) : '');
    const [failed, setFailed] = useState(false);
    const preview = chemPreview(chem);

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
            box.current.appendChild(mf);
            field.current = mf as never;
            mf.focus();
        }).catch(() => alive && setFailed(true));
        return () => { alive = false; field.current?.remove(); field.current = null; };
    }, [open, latex]);

    const press = (k: Key) => { field.current?.insert(k.latex!, {focus: true}); };
    const keys = TABS.find(t => t.id === tab)?.keys ?? [];
    const onChem = tab === CHEM;
    const done = () => onDone(onChem ? (chem.trim() ? toCe(chem) : '') : toKatex(field.current?.value ?? ''));

    return <Modal open={open} onClose={onCancel} title='Công thức' size='md'
                  footer={<>
                      <Button onClick={onCancel}>Huỷ</Button>
                      <Button variant='primary' disabled={onChem && !!preview.error} onClick={done}>Xong</Button>
                  </>}>
        <div className='tt-math'>
            <div ref={box} className='tt-math-field' hidden={onChem}/>
            {failed && <p role='alert' className='vt-field-error'>Không tải được bàn phím công thức. Kiểm tra mạng rồi mở lại.</p>}
            <div role='tablist' aria-label='Nhóm ký hiệu' className='tt-math-tabs'>
                {TABS.map(t => <button key={t.id} type='button' role='tab' aria-selected={tab === t.id}
                                       className={'tt-math-tab' + (tab === t.id ? ' on' : '')}
                                       onClick={() => setTab(t.id)}>{t.label}</button>)}
                <button type='button' role='tab' aria-selected={onChem} className={'tt-math-tab' + (onChem ? ' on' : '')}
                        onClick={() => setTab(CHEM)}>Hoá học</button>
            </div>
            {onChem && <div className='tt-math-chem'>
                <input className='tt-math-chem-input' aria-label='Công thức hoá học' value={chem} autoFocus
                       placeholder='Gõ H2SO4, SO4^2-, 2H2 + O2 -> 2H2O, <=>' onChange={e => setChem(e.target.value)}/>
                <div className='vt-muted'>Hệ thống tự đổi chỉ số dưới và bọc \ce{'{}'} khi lưu.</div>
                <div className='tt-math-chem-prev' aria-label='Xem trước'
                     dangerouslySetInnerHTML={{__html: preview.html}}/>
                {preview.error && <p role='alert' className='vt-field-error'>{preview.error}</p>}
            </div>}
            {!onChem && <div className='tt-math-keys' role='group' aria-label='Ký hiệu'>
                {keys.map(k => <button key={k.name} type='button' className='tt-math-key vt-tip' title={k.name} aria-label={k.name}
                                       data-tip={k.name} onClick={() => press(k)}>{k.label}</button>)}
                <button type='button' className='tt-math-key vt-tip' title='Xoá lùi' aria-label='Xoá lùi' data-tip='Xoá lùi'
                        onClick={() => field.current?.executeCommand('deleteBackward')}>⌫</button>
            </div>}
        </div>
    </Modal>;
}
