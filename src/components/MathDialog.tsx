import {useEffect, useRef, useState} from 'react';

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
    const [tab, setTab] = useState(TABS[0].id);
    const [failed, setFailed] = useState(false);

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
            mf.value = latex;
            mf.setAttribute('aria-label', 'Công thức');
            box.current.appendChild(mf);
            field.current = mf as never;
            mf.focus();
        }).catch(() => alive && setFailed(true));
        return () => { alive = false; field.current?.remove(); field.current = null; };
    }, [open, latex]);

    const press = (k: Key) => { field.current?.insert(k.latex!, {focus: true}); };
    const keys = TABS.find(t => t.id === tab)!.keys;

    return <Modal open={open} onClose={onCancel} title='Công thức' size='md'
                  footer={<>
                      <Button onClick={onCancel}>Huỷ</Button>
                      <Button variant='primary' onClick={() => onDone(toKatex(field.current?.value ?? ''))}>Xong</Button>
                  </>}>
        <div className='tt-math'>
            <div ref={box} className='tt-math-field'/>
            {failed && <p role='alert' className='vt-field-error'>Không tải được bàn phím công thức. Kiểm tra mạng rồi mở lại.</p>}
            <div role='tablist' aria-label='Nhóm ký hiệu' className='tt-math-tabs'>
                {TABS.map(t => <button key={t.id} type='button' role='tab' aria-selected={tab === t.id}
                                       className={'tt-math-tab' + (tab === t.id ? ' on' : '')}
                                       onClick={() => setTab(t.id)}>{t.label}</button>)}
            </div>
            <div className='tt-math-keys' role='group' aria-label='Ký hiệu'>
                {keys.map(k => <button key={k.name} type='button' className='tt-math-key vt-tip' title={k.name} aria-label={k.name}
                                       data-tip={k.name} onClick={() => press(k)}>{k.label}</button>)}
                <button type='button' className='tt-math-key vt-tip' title='Xoá lùi' aria-label='Xoá lùi' data-tip='Xoá lùi'
                        onClick={() => field.current?.executeCommand('deleteBackward')}>⌫</button>
            </div>
        </div>
    </Modal>;
}
