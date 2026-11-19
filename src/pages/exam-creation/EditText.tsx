import {useLayoutEffect, useRef} from 'react';
import type {KeyboardEvent, MouseEvent, ReactNode} from 'react';

import {cx} from '../../components/ui';
import {fill, isToken, pieces, tidy} from './layoutRules';
import type {Range} from './layoutRules';

export const PEN = <svg viewBox='0 0 24 24' width={16} height={16} fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    <path d='M4 20h4L19 9l-4-4L4 16z'/><path d='M13.5 6.5l4 4'/></svg>;

const NO_RANGE: Range = {from: 1, to: 0};
const FLASH_MS = 1800;

/** Text of a line with its number tokens as blue chips the user cannot type into. */
function paint(el: HTMLElement, value: string, range: Range, n: number, flashAll: boolean) {
    const before = Array.from(el.querySelectorAll('[data-token]')).map(c => c.textContent);
    el.replaceChildren(...pieces(value).filter(Boolean).map(p => {
        if (!isToken(p)) return document.createTextNode(p);
        const chip = document.createElement('span');
        chip.className = 'v3-n';
        chip.contentEditable = 'false';
        chip.dataset.token = p;
        chip.title = 'Tự cập nhật theo số câu';
        chip.textContent = fill(p, range, n);
        return chip;
    }));
    // A number that just changed (or a whole new ô) flashes once, so the teacher sees what moved.
    const chips = Array.from(el.querySelectorAll<HTMLElement>('[data-token]'));
    chips.forEach((c, k) => {
        if (flashAll || (before.length === chips.length && before[k] !== c.textContent)) {
            c.classList.add('is-flash');
            window.setTimeout(() => c.classList.remove('is-flash'), FLASH_MS);
        }
    });
}

/** What the box holds, back to the stored form: chips are their tokens. */
const read = (el: HTMLElement) => tidy(Array.from(el.childNodes).map(c =>
    c instanceof HTMLElement ? (c.dataset.token ?? (c.tagName === 'BR' ? '' : c.textContent ?? '')) : c.textContent ?? '').join(''));

type Props = {
    value: string; onCommit: (v: string) => void; label: string; placeholder?: string;
    range?: Range; n?: number; flash?: boolean;
    /** Only digits (minutes). */
    numeric?: boolean;
    /** An empty result is thrown away (the name of the exam). */
    required?: boolean;
};

/**
 * One piece of text of the sheet, edited where it stands: click → type, Enter or click away = done, Esc = undo.
 * Number tokens (`{from}` `{to}` `{n}`) stay as chips the cursor jumps over. The DOM is painted here, not by React,
 * so a re-render never moves the cursor while someone types.
 */
export function EditText({value, onCommit, label, placeholder, range = NO_RANGE, n = 1, flash, numeric, required}: Props) {
    const box = useRef<HTMLSpanElement>(null);
    const undo = useRef(false);

    useLayoutEffect(() => {
        if (box.current && box.current !== document.activeElement) paint(box.current, value, range, n, !!flash);
    }, [value, range.from, range.to, n, flash]);

    const done = () => {
        const el = box.current;
        if (!el) return;
        let v = read(el);
        if (numeric) v = v.replace(/\D/g, '');
        if (undo.current || (required && !v.trim())) v = value;
        undo.current = false;
        if (v !== value) onCommit(v); else paint(el, value, range, n, false);
    };
    const key = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); box.current?.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); undo.current = true; box.current?.blur(); }
    };
    return <span ref={box} className='v3-edit' contentEditable suppressContentEditableWarning role='textbox' aria-label={label}
                 aria-multiline='false' spellCheck={false} data-placeholder={placeholder} inputMode={numeric ? 'numeric' : undefined}
                 onKeyDown={key} onBlur={done}
                 onPaste={e => { e.preventDefault(); document.execCommand?.('insertText', false, e.clipboardData.getData('text').replace(/\s+/g, ' ')); }}/>;
}

/**
 * A line of the sheet: dashed outline + pen on hover, solid outline while one of its texts has the cursor.
 * A click on the empty part of the line puts the cursor at the end of its last text.
 */
export function Line({cls, children, help}: {cls?: string; children: ReactNode; help?: boolean}) {
    const focusEnd = (e: MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, [contenteditable]')) return;
        const fields = e.currentTarget.querySelectorAll<HTMLElement>('[contenteditable="true"]');
        const last = fields[fields.length - 1];
        if (!last) return;
        last.focus();
        const range = document.createRange();
        range.selectNodeContents(last);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    };
    // The only keyboard stop is the text itself, so the line needs no role of its own.
    return <div className={cx('v3-ed', cls)} onClick={focusEnd}>
        {children}
        <span className='v3-pen'>{PEN}</span>
        {help && <span className='v3-help'>Số tô xanh tự cập nhật, không cần sửa tay · Enter: xong · Esc: huỷ</span>}
    </div>;
}
