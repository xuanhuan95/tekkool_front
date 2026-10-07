import {describe, it, expect} from 'vitest';
import {render, act} from '@testing-library/react';
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
