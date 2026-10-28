import {describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';

import {Editor} from './Editor';

// MathLive needs a real browser (shadow DOM, layout): the dialog test drives a fake field instead.
const insert = vi.fn();
vi.mock('mathlive', () => {
    // the dialog appends the element to the page, so the fake is a real <div> with the few methods we use
    function MathfieldElement() {
        const el = document.createElement('div') as unknown as Record<string, unknown>;
        el.value = '';
        el.insert = (s: string) => { insert(s); el.value += s; return true; };
        el.executeCommand = () => true;
        return el;
    }
    return {MathfieldElement};
});

describe('Editor toolbar variants (DS-Editor)', () => {
    it('student: Σ, no image button; teacher (default): image button, no Σ; disableStyle: no toolbar', () => {
        const {rerender} = render(<Editor variant='student'/>);
        expect(screen.getByRole('button', {name: 'Chèn công thức'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Chèn ảnh'})).toBeNull();
        rerender(<Editor/>);
        expect(screen.getByRole('button', {name: 'Chèn ảnh'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Chèn công thức'})).toBeNull();
        rerender(<Editor disableStyle/>);
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('every toolbar button is named (aria-label + tooltip) and the phone "…" toggles the extra group', () => {
        render(<Editor variant='student'/>);
        const bar = screen.getByRole('toolbar', {name: 'Định dạng'});
        for (const b of bar.querySelectorAll('button')) {
            expect(b.getAttribute('aria-label')).toBeTruthy();
            expect(b.getAttribute('data-tip')).toBe(b.getAttribute('aria-label'));
        }
        const more = screen.getByRole('button', {name: 'Thêm công cụ'});
        expect(bar.className).not.toContain('open');
        fireEvent.click(more);
        expect(bar.className).toContain('open');
    });

    it('Σ opens the formula keyboard; a key inserts LaTeX; Xong puts the formula in the answer as span[data-latex]', async () => {
        const onChange = vi.fn();
        render(<Editor variant='student' onChange={onChange}/>);
        fireEvent.click(screen.getByRole('button', {name: 'Chèn công thức'}));
        const dlg = await screen.findByRole('dialog', {name: 'Công thức'});
        fireEvent.click(screen.getByRole('button', {name: 'Căn bậc hai'}));
        await waitFor(() => expect(insert).toHaveBeenCalledWith('\\sqrt{#@}'));
        // the fake field holds what was inserted
        await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Xong'})); });
        expect(dlg).not.toBeInTheDocument();
        await waitFor(() => expect(onChange).toHaveBeenCalled(), {timeout: 1500});
        expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain('data-latex="\\sqrt{#@}"');
    });
});
