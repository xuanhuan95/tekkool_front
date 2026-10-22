import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';

import Button from './Button';
import {ConfirmDialog} from './Modal';
import {PasswordField, TextField} from './Field';
import {SegmentedControl, Tabs} from './Tabs';
import ProgressBar from './ProgressBar';
import {initialsOf} from './Avatar';
import {FilterChip} from './Badge';

describe('Button', () => {
    it('click calls onClick', () => {
        const on = vi.fn();
        render(<Button onClick={on}>Lưu</Button>);
        fireEvent.click(screen.getByRole('button', {name: 'Lưu'}));
        expect(on).toHaveBeenCalledTimes(1);
    });

    it('disabled: no click, real disabled attribute', () => {
        const on = vi.fn();
        render(<Button disabled onClick={on}>Nộp bài</Button>);
        const b = screen.getByRole('button', {name: 'Nộp bài'});
        expect(b).toBeDisabled();
        fireEvent.click(b);
        expect(on).not.toHaveBeenCalled();
    });

    it('loading: swallows clicks (no double submit), aria-busy, keeps focusable', () => {
        const on = vi.fn();
        render(<Button variant='primary' loading loadingText='Đang lưu…' onClick={on}>Lưu</Button>);
        const b = screen.getByRole('button', {name: 'Đang lưu…'});
        fireEvent.click(b);
        fireEvent.click(b);
        expect(on).not.toHaveBeenCalled();
        expect(b).toHaveAttribute('aria-busy', 'true');
        expect(b).toHaveAttribute('aria-disabled', 'true');
        expect(b).not.toBeDisabled();
        b.focus();
        expect(b).toHaveFocus();
    });

    it('loading → done: clicks work again', () => {
        const on = vi.fn();
        const {rerender} = render(<Button loading onClick={on}>Lưu</Button>);
        fireEvent.click(screen.getByRole('button'));
        rerender(<Button loading={false} onClick={on}>Lưu</Button>);
        fireEvent.click(screen.getByRole('button'));
        expect(on).toHaveBeenCalledTimes(1);
    });

    it('defaults to type=button so it never submits a surrounding form by accident', () => {
        render(<Button>X</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
});

describe('ConfirmDialog', () => {
    const setup = (loading = false) => {
        const onConfirm = vi.fn(), onCancel = vi.fn();
        render(<ConfirmDialog open title='Nộp bài?' message='Bạn còn 3 câu chưa làm.' confirmLabel='Nộp bài'
                              cancelLabel='Làm tiếp' loading={loading} onConfirm={onConfirm} onCancel={onCancel}/>);
        return {onConfirm, onCancel};
    };

    it('is a labelled modal dialog', () => {
        setup();
        const d = screen.getByRole('dialog', {name: 'Nộp bài?'});
        expect(d).toHaveAttribute('aria-modal', 'true');
        expect(d).toHaveTextContent('Bạn còn 3 câu chưa làm.');
    });

    it('focus starts on the safe button (cancel)', () => {
        setup();
        expect(screen.getByRole('button', {name: 'Làm tiếp'})).toHaveFocus();
    });

    it('confirm → onConfirm, cancel → onCancel', () => {
        const {onConfirm, onCancel} = setup();
        fireEvent.click(screen.getByRole('button', {name: 'Nộp bài'}));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', {name: 'Làm tiếp'}));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Esc cancels', () => {
        const {onCancel} = setup();
        fireEvent.keyDown(document, {key: 'Escape'});
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('while loading: confirm ignored, Esc and cancel do nothing', () => {
        const {onConfirm, onCancel} = setup(true);
        fireEvent.click(screen.getByRole('button', {name: 'Nộp bài'}));
        fireEvent.keyDown(document, {key: 'Escape'});
        fireEvent.click(screen.getByRole('button', {name: 'Làm tiếp'}));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('closed: renders nothing', () => {
        render(<ConfirmDialog open={false} title='X' onConfirm={() => {}} onCancel={() => {}}/>);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('focus returns to the opener when closed', () => {
        function Host() {
            const [open, setOpen] = useState(false);
            return <>
                <button onClick={() => setOpen(true)}>Mở</button>
                <ConfirmDialog open={open} title='Xoá đề?' onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)}/>
            </>;
        }
        render(<Host/>);
        const opener = screen.getByRole('button', {name: 'Mở'});
        opener.focus();
        fireEvent.click(opener);
        fireEvent.click(screen.getByRole('button', {name: 'Huỷ'}));
        expect(opener).toHaveFocus();
    });
});

describe('TextField', () => {
    it('label is linked; error sets aria-invalid and is described', () => {
        render(<TextField label='Mật khẩu' error='Cần ít nhất 8 ký tự' hint='ẩn khi có lỗi'/>);
        const input = screen.getByLabelText('Mật khẩu');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAccessibleDescription('Cần ít nhất 8 ký tự');
        expect(screen.queryByText('ẩn khi có lỗi')).toBeNull();
    });
    it('hint is the description when there is no error', () => {
        render(<TextField label='Họ và tên' hint='Hiện trên bảng xếp hạng'/>);
        expect(screen.getByLabelText('Họ và tên')).toHaveAccessibleDescription('Hiện trên bảng xếp hạng');
        expect(screen.getByLabelText('Họ và tên')).not.toHaveAttribute('aria-invalid');
    });
});

describe('Tabs / SegmentedControl', () => {
    const items = [{value: 'week', label: 'Bảng tuần'}, {value: 'all', label: 'Thành tích'}] as const;

    it('click selects; arrow keys move and select', () => {
        const on = vi.fn();
        render(<Tabs aria-label='Bảng xếp hạng' items={[...items]} value='week' onChange={on}/>);
        expect(screen.getByRole('tab', {name: 'Bảng tuần'})).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('tab', {name: 'Thành tích'}));
        expect(on).toHaveBeenLastCalledWith('all');
        fireEvent.keyDown(screen.getByRole('tab', {name: 'Bảng tuần'}), {key: 'ArrowRight'});
        expect(on).toHaveBeenLastCalledWith('all');
        fireEvent.keyDown(screen.getByRole('tab', {name: 'Bảng tuần'}), {key: 'ArrowLeft'});
        expect(on).toHaveBeenLastCalledWith('all'); // wraps around
    });

    it('only the selected item is in the Tab order', () => {
        render(<SegmentedControl aria-label='Kỳ' items={[...items]} value='all' onChange={() => {}}/>);
        expect(screen.getByRole('radio', {name: 'Thành tích'})).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', {name: 'Bảng tuần'})).toHaveAttribute('tabindex', '-1');
    });
});

describe('small helpers', () => {
    it('ProgressBar clamps and exposes values', () => {
        render(<ProgressBar value={30} max={23} label='Số câu đã làm'/>);
        const p = screen.getByRole('progressbar', {name: 'Số câu đã làm'});
        expect(p).toHaveAttribute('aria-valuenow', '23');
        expect(p).toHaveAttribute('aria-valuemax', '23');
    });

    it('initialsOf takes the last two words of a Vietnamese name', () => {
        expect(initialsOf('Nguyễn Minh Anh')).toBe('MA');
        expect(initialsOf('Cô Thu Hà')).toBe('TH');
        expect(initialsOf('  bảo ')).toBe('B');
        expect(initialsOf('đỗ minh khoa')).toBe('MK');
        expect(initialsOf('')).toBe('?');
    });

    it('FilterChip toggles aria-pressed via onChange', () => {
        const on = vi.fn();
        render(<FilterChip selected={false} onChange={on}>Toán</FilterChip>);
        fireEvent.click(screen.getByRole('button', {name: 'Toán'}));
        expect(on).toHaveBeenCalledWith(true);
    });
});

describe('PasswordField', () => {
    it('eye button toggles visibility without submitting the form', () => {
        const submit = vi.fn((e: {preventDefault: () => void}) => e.preventDefault());
        render(<form onSubmit={submit}><PasswordField label='Mật khẩu' defaultValue='abc123'/></form>);
        const input = screen.getByLabelText('Mật khẩu');
        expect(input).toHaveAttribute('type', 'password');
        fireEvent.click(screen.getByRole('button', {name: 'Hiện mật khẩu'}));
        expect(input).toHaveAttribute('type', 'text');
        expect(screen.getByRole('button', {name: 'Ẩn mật khẩu'})).toHaveAttribute('aria-pressed', 'true');
        expect(submit).not.toHaveBeenCalled();
    });

    it('error wires aria-invalid + describedby', () => {
        render(<PasswordField label='Nhập lại mật khẩu' error='Mật khẩu nhập lại chưa khớp'/>);
        const input = screen.getByLabelText('Nhập lại mật khẩu');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAccessibleDescription('Mật khẩu nhập lại chưa khớp');
    });
});

describe('Table: sideways scroll hint + sticky action column (QC B4)', () => {
    it('sticky column gets the sticky class on header and cells; overflowing table shows the right-edge hint', async () => {
        const {default: Table} = await import('./Table');
        const proto = HTMLElement.prototype;
        const sw = Object.getOwnPropertyDescriptor(proto, 'scrollWidth');
        const cw = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
        Object.defineProperty(proto, 'scrollWidth', {configurable: true, get: () => 900});
        Object.defineProperty(proto, 'clientWidth', {configurable: true, get: () => 390});
        try {
            render(<Table caption='Gói' rowKey={r => r.id} rows={[{id: '1', name: 'Gói 5 lượt'}]}
                          columns={[{key: 'name', header: 'Tên'}, {key: 'act', header: 'Thao tác', sticky: true, render: () => 'Sửa'}]}/>);
            expect(screen.getByText('Thao tác')).toHaveClass('vt-td--sticky');
            expect(screen.getByText('Sửa')).toHaveClass('vt-td--sticky');
            const region = screen.getByRole('region', {name: 'Gói'});
            expect(region).toHaveClass('vt-table-scroll--right');
            expect(region).not.toHaveClass('vt-table-scroll--left');
        } finally {
            if (sw) Object.defineProperty(proto, 'scrollWidth', sw);
            if (cw) Object.defineProperty(proto, 'clientWidth', cw);
        }
    });
});

describe('Table: a pinned column too wide for the phone is not pinned (QC B4b)', () => {
    it('adds vt-table-scroll--nosticky when the sticky header is wider than 45% of the visible width', async () => {
        const {default: Table} = await import('./Table');
        const proto = HTMLElement.prototype;
        const keep = ['scrollWidth', 'clientWidth', 'offsetWidth'].map(k => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
        Object.defineProperty(proto, 'scrollWidth', {configurable: true, get: () => 900});
        Object.defineProperty(proto, 'clientWidth', {configurable: true, get: () => 340});
        Object.defineProperty(proto, 'offsetWidth', {configurable: true, get: () => 220});
        try {
            render(<Table caption='GV' rowKey={r => r.id} rows={[{id: '1'}]}
                          columns={[{key: 'a', header: 'Tên'}, {key: 'act', header: 'Thao tác', sticky: true, render: () => 'Khoá'}]}/>);
            expect(screen.getByRole('region', {name: 'GV'})).toHaveClass('vt-table-scroll--nosticky');
        } finally {
            keep.forEach(([k, d]) => { if (d) Object.defineProperty(proto, k, d); });
        }
    });
});

describe('isNavActive: result/review/history highlight "Đề thi", packages "Tôi" on phones', () => {
    it('matches own path, `end`, and `also` prefixes', async () => {
        const {isNavActive, STUDENT_NAV_MOBILE} = await import('./layout/nav');
        const current = (path: string) => STUDENT_NAV_MOBILE.filter(i => isNavActive(i, path)).map(i => i.label);
        expect(current('/')).toEqual(['Trang chủ']);
        expect(current('/exams/X')).toEqual(['Đề thi']);
        expect(current('/result/S1')).toEqual(['Đề thi']);
        expect(current('/review/S1')).toEqual(['Đề thi']);
        expect(current('/history')).toEqual(['Đề thi']);
        expect(current('/packages')).toEqual(['Tôi']);
        expect(current('/resultx')).toEqual([]);
    });
});
