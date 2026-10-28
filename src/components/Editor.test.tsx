import {describe, it, expect, vi} from 'vitest';
import {render, act, fireEvent} from '@testing-library/react';
import {Editor} from './Editor';

// The word limit NO LONGER blocks typing (requirement 10/2025): students may
// write as much as they like, the counter is informational only. Previously a
// ProseMirror extension swallowed keys at the limit — if someone rebuilds it,
// the cases below go red immediately.
//
// max_words must still live on: core_question_bank._tu_luan_type classifies the
// TraLoiNgan / VietDoan / VietBai blocks by this very number.

/** Build an Editor; returns a content writer and readers for text + counter. */
function setup(props: {maxWords?: number; maxChars?: number}) {
    const ref: {current: any} = {current: null};
    const r = render(<Editor refMedium={ref} {...props}/>);
    return {
        write: (html: string) => act(() => { ref.current.medium.setContent(html); }),
        text: () => ref.current.medium.getContent().replace(/<[^>]*>/g, ''),
        counter: () => r.container.querySelector('.tt-charcount'),
        // React prints '#db2828' as 'rgb(219, 40, 40)' — comparing against the
        // hex string always matches "not red", giving a falsely green test.
        color: () => (r.container.querySelector('.tt-charcount') as HTMLElement).style.color,
    };
}

describe('Editor — word limit only counts, never blocks', () => {
    it('writing past the word limit keeps the text intact, no truncation', () => {
        const e = setup({maxWords: 5});
        e.write('<p>một hai ba bốn năm sáu bảy tám</p>');
        expect(e.text()).toBe('một hai ba bốn năm sáu bảy tám');
    });

    it('going past the character limit is not truncated either', () => {
        const e = setup({maxChars: 5});
        e.write('<p>abcdefghij</p>');
        expect(e.text()).toBe('abcdefghij');
    });

    it('counter shows the REAL word count, even when over', () => {
        const e = setup({maxWords: 5});
        e.write('<p>một hai ba bốn năm sáu bảy tám</p>');
        expect(e.counter()!.textContent).toBe('8 / 5 từ');
    });

    it('going over the limit does not turn red — over is no longer an error', () => {
        const e = setup({maxWords: 5});
        e.write('<p>một hai ba bốn năm sáu bảy tám</p>');
        expect(e.color()).toBe('rgb(118, 118, 118)');
    });

    it('no limit set means no counter shown', () => {
        const e = setup({});
        e.write('<p>một hai ba</p>');
        expect(e.counter()).toBeNull();
    });
});

// Word import emits formulas and pictures (core_docx.paragraphs). Tiptap drops
// unknown tags, so without RichExtras the teacher opens the question and loses them.
describe('Editor — keeps formulas and pictures from Word import', () => {
    it('sup, sub and data-URI img survive a round trip', () => {
        const ref: {current: any} = {current: null};
        render(<Editor refMedium={ref}/>);
        const html = '<p>x<sup>2</sup> H<sub>2</sub>O <img src="data:image/png;base64,UE5H"></p>';
        act(() => { ref.current.medium.setContent(html); });
        const out = ref.current.medium.getContent();
        expect(out).toContain('<sup>2</sup>');
        expect(out).toContain('<sub>2</sub>');
        expect(out).toContain('src="data:image/png;base64,UE5H"');
    });

    it('span[data-latex]: keeps the LaTeX source and draws it with KaTeX', () => {
        const ref: {current: any} = {current: null};
        const r = render(<Editor refMedium={ref}/>);
        act(() => { ref.current.medium.setContent('<p>V = <span data-latex="\\frac{a^3}{6}"></span></p>'); });
        expect(ref.current.medium.getContent()).toContain('data-latex="\\frac{a^3}{6}"');
        expect(r.container.querySelector('.katex')).not.toBeNull();
    });
});

// Import saves the BE string as-is (no <p>, <br> for line breaks, <b> for bold);
// typing in the Editor saves editor.getHTML(). Opening an imported box must keep the
// content — only the wrapper (<p>) may change — so an edit never loses a formula.
describe('Editor — imported string vs editor-saved HTML', () => {
    const imported = 'Gọi <span data-latex="S"></span> là <b>tập</b> hợp<br>x<sup>2</sup> và <span data-latex="y = \\frac{x ^{2}}{x - 2}"></span>';

    it('open + save keeps every formula, sup and bold; only wraps in <p>', () => {
        const ref: {current: any} = {current: null};
        render(<Editor refMedium={ref}/>);
        act(() => { ref.current.medium.setContent(imported); });
        const out: string = ref.current.medium.getContent();
        expect(out.startsWith('<p>')).toBe(true);
        expect(out.match(/data-latex=/g)).toHaveLength(2);
        expect(out).toContain('data-latex="y = \\frac{x ^{2}}{x - 2}"');
        expect(out).toContain('<strong>tập</strong>');
        expect(out).toContain('<sup>2</sup>');
        expect(out).toContain('<br');
    });
});

describe('Editor — onChange is flushed, never lost to the 500 ms debounce (SPT-92)', () => {
    const typed = (onChange: (h: string) => void) => {
        const ref: {current: any} = {current: null};
        const r = render(<Editor refMedium={ref} onChange={onChange}/>);
        act(() => { ref.current.editor.commands.insertContent('xin chào'); });
        return {ref, r};
    };

    it('blur right after typing reports the text at once', () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        const {ref} = typed(onChange);
        expect(onChange).not.toHaveBeenCalled();
        act(() => { fireEvent.blur(ref.current.editor.view.dom); });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toContain('xin chào');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(onChange).toHaveBeenCalledTimes(1); // the pending timer was cancelled, no double call
        vi.useRealTimers();
    });

    it('leaving the page right after typing still reports the text', () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        const {r} = typed(onChange);
        r.unmount();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toContain('xin chào');
        vi.useRealTimers();
    });

    it('without a flush trigger the debounce still fires after 500 ms', () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        typed(onChange);
        act(() => { vi.advanceTimersByTime(500); });
        expect(onChange).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
