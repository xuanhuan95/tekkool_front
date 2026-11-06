import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';

import {Editor} from './Editor';

// MathLive needs a real browser (shadow DOM, layout): the dialog test drives a fake field instead.
const insert = vi.fn();
beforeEach(() => insert.mockClear());
vi.mock('mathlive', () => {
    // the dialog appends the element to the page, so the fake is a real <div> with the few methods we use
    function MathfieldElement() {
        const div = document.createElement('div');
        const el = div as unknown as Record<string, unknown>;
        el.value = '';
        el.insert = (s: string) => { insert(s); el.value = (el.value as string) + s.replace('#@', 'x'); div.dispatchEvent(new Event('input')); return true; };
        el.executeCommand = () => true;
        return el;
    }
    return {MathfieldElement};
});

describe('Editor toolbar variants (DS-Editor)', () => {
    it('student: Σ, no image button; teacher (default): Σ and image button; disableStyle: no toolbar', () => {
        const {rerender} = render(<Editor variant='student'/>);
        expect(screen.getByRole('button', {name: 'Chèn công thức'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Chèn ảnh'})).toBeNull();
        rerender(<Editor/>);
        expect(screen.getByRole('button', {name: 'Chèn ảnh'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Chèn công thức'})).toBeInTheDocument();
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

    it('Σ opens the formula keyboard; a key inserts LaTeX; "Chèn công thức" puts the formula in the answer as span[data-latex]', async () => {
        const onChange = vi.fn();
        render(<Editor variant='student' onChange={onChange}/>);
        fireEvent.click(screen.getByRole('button', {name: 'Chèn công thức'}));
        const dlg = await screen.findByRole('dialog', {name: 'Chèn công thức'});
        // The dialog shows at once, the MathLive field mounts only after the lazy import resolves (slow on CI):
        // a key pressed before that finds no field and inserts nothing — wait for the field first.
        await waitFor(() => expect(dlg.querySelector('.tt-math-field')!.childElementCount).toBe(1));
        fireEvent.click(within(dlg).getByRole('tab', {name: 'Bàn phím'}));
        fireEvent.click(within(dlg).getByRole('button', {name: 'Căn bậc hai'}));
        await waitFor(() => expect(insert).toHaveBeenCalledWith('\\sqrt{#@}'));
        // the fake field holds what was inserted
        await act(async () => { fireEvent.click(within(dlg).getByRole('button', {name: 'Chèn công thức'})); });
        expect(dlg).not.toBeInTheDocument();
        await waitFor(() => expect(onChange).toHaveBeenCalled(), {timeout: 3000});
        expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain('data-latex="\\sqrt{x}"');
    });

    it('teacher: Σ inserts a new formula as span[data-latex]', async () => {
        const onChange = vi.fn();
        render(<Editor onChange={onChange}/>);
        fireEvent.click(screen.getByRole('button', {name: 'Chèn công thức'}));
        const dlg = await screen.findByRole('dialog', {name: 'Chèn công thức'});
        await waitFor(() => expect(dlg.querySelector('.tt-math-field')!.childElementCount).toBe(1));
        fireEvent.click(within(dlg).getByRole('tab', {name: 'Bàn phím'}));
        fireEvent.click(within(dlg).getByRole('button', {name: 'Căn bậc hai'}));
        await waitFor(() => expect(insert).toHaveBeenCalledWith('\\sqrt{#@}'));
        await act(async () => { fireEvent.click(within(dlg).getByRole('button', {name: 'Chèn công thức'})); });
        await waitFor(() => expect(onChange).toHaveBeenCalled(), {timeout: 3000});
        expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain('data-latex="\\sqrt{x}"');
    });

    it('teacher: clicking a formula imported from Word reopens the keyboard on it', async () => {
        const {container} = render(<Editor text='<p>Cho <span data-latex="x^2"></span></p>'/>);
        fireEvent.click(container.querySelector('span[data-latex]')!);
        await screen.findByRole('dialog', {name: 'Chèn công thức'});
    });
});

describe('Hộp chèn bảng và hộp công thức (SPT-116 vòng sửa)', () => {
    it('lưới 8×8: bấm ô đặt nhãn "n hàng × m cột" và chèn đúng cỡ', async () => {
        const {container} = render(<Editor/>);
        fireEvent.click(screen.getByRole('button', {name: 'Chèn bảng'}));
        const dlg = await screen.findByRole('dialog', {name: 'Chèn bảng'});
        fireEvent.click(within(dlg).getByRole('button', {name: '4 hàng × 2 cột'}));
        expect(within(dlg).getByText('4 hàng × 2 cột')).toBeInTheDocument();
        fireEvent.click(within(dlg).getByRole('button', {name: 'Chèn bảng'}));
        await waitFor(() => expect(container.querySelectorAll('table tr')).toHaveLength(4));
        expect(container.querySelectorAll('table tr:first-child th')).toHaveLength(2);
    });

    it('công thức sai (thiếu }): hiện lỗi cụ thể và nút "Chèn công thức" tắt', async () => {
        render(<Editor/>);
        fireEvent.click(screen.getByRole('button', {name: 'Chèn công thức'}));
        const dlg = await screen.findByRole('dialog', {name: 'Chèn công thức'});
        fireEvent.change(within(dlg).getByLabelText(/Sửa trực tiếp/), {target: {value: '\\frac{a}{b'}});
        expect(within(dlg).getByRole('alert')).toHaveTextContent('Thiếu dấu } ở cuối');
        expect(within(dlg).getAllByRole('button', {name: 'Chèn công thức'}).pop()).toBeDisabled();
    });
});
