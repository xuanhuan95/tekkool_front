import {useState} from 'react';
import {describe, it, expect} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';

import {SubjectPicker} from './SubjectPicker';

const NAMES = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý'];
const subjects = NAMES.map((name, i) => ({id: 's' + i, name, exams: 1}));
const NOTE = 'Tối đa 7 môn — bỏ bớt môn để thêm tổ hợp này.';

function Harness({start = []}: {start?: string[]}) {
    const [sel, setSel] = useState<string[]>(start);
    return <SubjectPicker subjects={subjects} selected={sel} onChange={setSel}/>;
}
const combo = (code: string) => screen.getByRole('button', {name: new RegExp('^' + code)});

describe('SubjectPicker combos (SPT-138)', () => {
    it('A00 then B00 both stay pressed; unpressing A00 keeps the shared Toán + Hóa', () => {
        render(<Harness/>);
        fireEvent.click(combo('A00'));
        fireEvent.click(combo('B00'));
        expect(combo('A00')).toHaveAttribute('aria-pressed', 'true');
        expect(combo('B00')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(combo('A00'));
        expect(combo('A00')).toHaveAttribute('aria-pressed', 'false');
        expect(combo('B00')).toHaveAttribute('aria-pressed', 'true');
        const tile = (name: string) => screen.getByRole('button', {name: new RegExp('^' + name + '$')});
        for (const n of ['Toán', 'Hóa học', 'Sinh học']) expect(tile(n)).toHaveAttribute('aria-pressed', 'true');
        expect(tile('Vật lý')).toHaveAttribute('aria-pressed', 'false');
    });
    it('at 7 subjects the combo that would pass 7 is dimmed with the note and ignores clicks', () => {
        render(<Harness start={['s0', 's1', 's2', 's3', 's4', 's5', 's6']}/>);   // Toán Văn Anh Lý Hóa Sinh Sử
        expect(combo('C00')).toHaveAttribute('aria-disabled', 'true');
        expect(combo('A00')).not.toHaveAttribute('aria-disabled');
        expect(screen.getByText(NOTE)).toBeInTheDocument();
        fireEvent.click(combo('C00'));
        expect(combo('C00')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('Đã đủ 7 môn.')).toBeInTheDocument();
    });
    it('no note while nothing is blocked', () => {
        render(<Harness start={['s0']}/>);
        expect(screen.queryByText(NOTE)).toBeNull();
    });
});
