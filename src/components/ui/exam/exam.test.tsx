import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';

import QuestionBlock from './QuestionBlock';
import {QuestionGrid, QuestionNumberStrip} from './QuestionNav';
import {AutosaveNote, ExamBanner, ExamEnd, ExamHeader} from './ExamFrame';
import {countTrueFalse, countWords, formatClock, questionCellLabel} from './types';

const OPTIONS = [{key: 'A', content: '2'}, {key: 'B', content: '6'}, {key: 'C', content: '4'}, {key: 'D', content: '8'}];
const STATEMENTS = [
    {key: 'a', content: 'f′(x) = 3x² − 6x.'},
    {key: 'b', content: 'Hàm số đồng biến trên (0; 2).'},
    {key: 'c', content: 'Giá trị cực tiểu bằng −2.'},
    {key: 'd', content: 'Đồ thị cắt trục tung tại (0; 2).'},
];

describe('QuestionBlock — trắc nghiệm', () => {
    const choice = (value: string | null, onChange = vi.fn(), disabled = false) => {
        render(<QuestionBlock kind='choice' number={1} prompt='Tích phân bằng' options={OPTIONS}
                              value={value} onChange={onChange} disabled={disabled}/>);
        return onChange;
    };

    it('clicking an option calls onChange with its key', () => {
        const on = choice(null);
        fireEvent.click(screen.getByRole('radio', {name: /^C\./}));
        expect(on).toHaveBeenCalledWith('C');
    });

    it('selected option is aria-checked, others not', () => {
        choice('B');
        expect(screen.getByRole('radio', {name: /^B\./})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', {name: /^A\./})).toHaveAttribute('aria-checked', 'false');
    });

    it('clicking the already selected option does not fire again (radio, no accidental clear)', () => {
        const on = choice('B');
        fireEvent.click(screen.getByRole('radio', {name: /^B\./}));
        expect(on).not.toHaveBeenCalled();
    });

    it('arrow keys move the choice; wraps from D to A', () => {
        const on = choice('D');
        fireEvent.keyDown(screen.getByRole('radiogroup', {name: 'Đáp án câu 1'}), {key: 'ArrowRight'});
        expect(on).toHaveBeenLastCalledWith('A');
        fireEvent.keyDown(screen.getByRole('radiogroup'), {key: 'ArrowLeft'});
        expect(on).toHaveBeenLastCalledWith('C');
    });

    it('one Tab stop: the selected option (or A when none)', () => {
        choice(null);
        const radios = screen.getAllByRole('radio');
        expect(radios.map(r => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    });

    it('disabled: no change', () => {
        const on = choice(null, vi.fn(), true);
        fireEvent.click(screen.getByRole('radio', {name: /^A\./}));
        expect(on).not.toHaveBeenCalled();
    });

    it('has the id the strip scrolls to', () => {
        const {container} = render(<QuestionBlock kind='choice' number={7} prompt='x' options={OPTIONS}
                                                  value={null} onChange={() => {}}/>);
        expect(container.querySelector('#cau-7')).not.toBeNull();
    });
});

describe('QuestionBlock — Đúng/Sai 4 ý', () => {
    const tf = (value: Record<string, boolean | null>, onChange = vi.fn()) => {
        render(<QuestionBlock kind='truefalse' number={13} prompt='Xét tính đúng sai' statements={STATEMENTS}
                              value={value} onChange={onChange}/>);
        return onChange;
    };

    it('Đ on ý b → onChange with b=true, keeping the other answers', () => {
        const on = tf({a: true});
        fireEvent.click(screen.getByRole('button', {name: 'Ý b đúng'}));
        expect(on).toHaveBeenCalledWith({a: true, b: true});
    });

    it('S on ý a switches Đ → S', () => {
        const on = tf({a: true, b: false});
        fireEvent.click(screen.getByRole('button', {name: 'Ý a sai'}));
        expect(on).toHaveBeenCalledWith({a: false, b: false});
    });

    it('pressing the chosen button again clears that statement', () => {
        const on = tf({a: true, c: false});
        fireEvent.click(screen.getByRole('button', {name: 'Ý c sai'}));
        expect(on).toHaveBeenCalledWith({a: true, c: null});
    });

    it('aria-pressed reflects the value; counter "đã trả lời x / 4 ý"', () => {
        tf({a: true, b: false, d: true});
        expect(screen.getByRole('button', {name: 'Ý a đúng'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: 'Ý a sai'})).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', {name: 'Ý b sai'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: 'Ý c đúng'})).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('đã trả lời 3 / 4 ý')).toBeInTheDocument();
    });

    it('each statement is its own labelled group', () => {
        tf({});
        const g = screen.getByRole('group', {name: 'Câu 13 ý d'});
        expect(within(g).getAllByRole('button')).toHaveLength(2);
    });
});

describe('QuestionBlock — trả lời ngắn, tự luận, đánh dấu', () => {
    it('short answer passes the typed text through', () => {
        const on = vi.fn();
        render(<QuestionBlock kind='short' number={17} prompt='Sau bao nhiêu giờ?' label='Kết quả (đơn vị: giờ)'
                              value='' onChange={on}/>);
        const input = screen.getByLabelText('Kết quả (đơn vị: giờ)');
        expect(input).toHaveAttribute('inputmode', 'decimal');
        expect(input).toHaveAccessibleDescription('Chỉ ghi kết quả, ví dụ: 2,5 hoặc -3');
        fireEvent.change(input, {target: {value: '2,5'}});
        expect(on).toHaveBeenCalledWith('2,5');
    });

    it('essay: textarea + word count (no teacher note, SPT-82); toolbar only with onTool', () => {
        const on = vi.fn(), tool = vi.fn();
        render(<QuestionBlock kind='essay' number={23} title='Câu 23 · 1,5 điểm' prompt='Tìm kích thước'
                              value='Gọi x là cạnh' onChange={on} onTool={tool}/>);
        expect(screen.getByText('4 chữ')).toBeInTheDocument();
        expect(screen.queryByText(/Giáo viên sẽ chấm/)).toBeNull();
        fireEvent.change(screen.getByLabelText('Bài làm của bạn'), {target: {value: 'abc'}});
        expect(on).toHaveBeenCalledWith('abc');
        fireEvent.click(screen.getByRole('button', {name: 'Chèn công thức'}));
        expect(tool).toHaveBeenCalledWith('formula');
    });

    it('essay without onTool has no toolbar', () => {
        render(<QuestionBlock kind='essay' number={23} prompt='x' value='' onChange={() => {}}/>);
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('flag button toggles and shows its state', () => {
        const on = vi.fn();
        const {rerender} = render(<QuestionBlock kind='short' number={18} prompt='x' value='' onChange={() => {}}
                                                 flagged={false} onToggleFlag={on}/>);
        const flag = screen.getByRole('button', {name: 'Xem lại sau'});
        expect(flag).toHaveAttribute('data-tip', 'Xem lại sau');   // icon only: tooltip names it
        fireEvent.click(flag);
        expect(on).toHaveBeenCalledTimes(1);
        rerender(<QuestionBlock kind='short' number={18} prompt='x' value='' onChange={() => {}} flagged onToggleFlag={on}/>);
        expect(screen.getByRole('button', {name: 'Bỏ đánh dấu xem lại'})).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('QuestionNumberStrip', () => {
    const qs = [
        {number: 1, answered: true},
        {number: 2, answered: true},
        {number: 3, answered: false},
        {number: 5, answered: true, flagged: true},
        {number: 6, answered: false, flagged: true},
    ];

    it('labels every cell with its state', () => {
        render(<QuestionNumberStrip questions={qs} current={2} onJump={() => {}}/>);
        expect(screen.getByRole('button', {name: 'Câu 1, đã làm'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Câu 3, chưa làm'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Câu 5, đã làm, đánh dấu xem lại'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Câu 6, chưa làm, đánh dấu xem lại'})).toBeInTheDocument();
    });

    it('current cell has aria-current, done cells the done class, flagged cells the dot', () => {
        render(<QuestionNumberStrip questions={qs} current={2} onJump={() => {}}/>);
        const cur = screen.getByRole('button', {name: 'Câu 2, đã làm, đang xem'});
        expect(cur).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('button', {name: 'Câu 1, đã làm'})).not.toHaveAttribute('aria-current');
        expect(cur).toHaveClass('vt-qcell--done');
        expect(screen.getByRole('button', {name: 'Câu 3, chưa làm'})).not.toHaveClass('vt-qcell--done');
        expect(screen.getByRole('button', {name: /^Câu 5,/}).querySelector('.vt-qcell-flag')).not.toBeNull();
        expect(screen.getByRole('button', {name: /^Câu 1,/}).querySelector('.vt-qcell-flag')).toBeNull();
    });

    it('clicking a cell jumps to that number; "Tất cả câu" opens the sheet', () => {
        const jump = vi.fn(), all = vi.fn();
        render(<QuestionNumberStrip questions={qs} current={2} onJump={jump} onOpenAll={all}/>);
        fireEvent.click(screen.getByRole('button', {name: /^Câu 5,/}));
        expect(jump).toHaveBeenCalledWith(5);
        fireEvent.click(screen.getByRole('button', {name: 'Tất cả câu'}));
        expect(all).toHaveBeenCalledTimes(1);
    });

    it('grid groups by part and counts done', () => {
        const jump = vi.fn();
        render(<QuestionGrid showHeading current={1} onJump={jump} parts={[
            {title: 'Phần I · Trắc nghiệm', questions: qs.slice(0, 3)},
            {title: 'Phần II · Đúng/Sai', questions: qs.slice(3)},
        ]}/>);
        expect(screen.getByText('3 / 5 đã làm')).toBeInTheDocument();
        const part2 = screen.getByRole('group', {name: 'Phần II · Đúng/Sai'});
        fireEvent.click(within(part2).getByRole('button', {name: /^Câu 6,/}));
        expect(jump).toHaveBeenCalledWith(6);
    });
});

describe('ExamHeader / ExamEnd', () => {
    it('clock turns red at ≤5 minutes', () => {
        const props = {title: 'Toán · Đề số 3', answered: 11, total: 23, onExit: () => {}, onSubmit: () => {}};
        const {rerender} = render(<ExamHeader {...props} secondsLeft={2292}/>);
        expect(screen.getByRole('timer')).toHaveTextContent('38:12');
        expect(screen.getByRole('timer')).not.toHaveClass('vt-timer--warn');
        expect(screen.getByRole('timer')).toHaveAccessibleName('Thời gian còn lại 38 phút 12 giây');
        rerender(<ExamHeader {...props} secondsLeft={300}/>);
        expect(screen.getByRole('timer')).toHaveClass('vt-timer--warn');
    });

    it('end block: summary (no "Hết đề" title), submit blocked while submitting', () => {
        const submit = vi.fn();
        render(<ExamEnd answered={11} total={23} flagged={2} savedAt='20:41' submitting onSubmit={submit}/>);
        expect(screen.queryByText('Hết đề')).toBeNull();
        expect(screen.getByText(/2 câu đánh dấu/)).toBeInTheDocument();
        expect(screen.getByText('Đã lưu tự động lúc 20:41')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Nộp bài'}));
        expect(submit).not.toHaveBeenCalled();
    });
});

describe('exam helpers', () => {
    it('formatClock', () => {
        expect(formatClock(5400)).toBe('90:00');
        expect(formatClock(2292)).toBe('38:12');
        expect(formatClock(59.9)).toBe('00:59');
        expect(formatClock(-3)).toBe('00:00');
    });
    it('countTrueFalse ignores null/undefined', () => {
        expect(countTrueFalse({a: true, b: false, c: null, d: undefined})).toBe(2);
        expect(countTrueFalse(null)).toBe(0);
    });
    it('countWords strips tags', () => {
        expect(countWords('<p>Gọi <b>x</b> là</p>  cạnh')).toBe(4);
        expect(countWords('   ')).toBe(0);
    });
    it('questionCellLabel', () => {
        expect(questionCellLabel({number: 4, answered: false}, true)).toBe('Câu 4, chưa làm, đang xem');
    });
});

describe('ExamHeader no limit, AutosaveNote states, ExamBanner', () => {
    it('secondsLeft null shows "Không giới hạn" and no timer role', () => {
        render(<ExamHeader title='Đề' secondsLeft={null} answered={0} total={3} onExit={() => {}} onSubmit={() => {}}/>);
        expect(screen.getByText('Không giới hạn')).toBeTruthy();
        expect(screen.queryByRole('timer')).toBeNull();
    });

    it('offline wins over saved; saving shows "Đang lưu…"', () => {
        const {rerender} = render(<AutosaveNote savedAt='20:41' offline/>);
        expect(screen.getByRole('status').textContent).toMatch(/Mất kết nối/);
        rerender(<AutosaveNote savedAt='20:41' saving/>);
        expect(screen.getByRole('status').textContent).toBe('Đang lưu…');
        rerender(<AutosaveNote savedAt='20:41'/>);
        expect(screen.getByRole('status').textContent).toMatch(/Đã lưu tự động lúc 20:41/);
    });

    it('ExamBanner is an alert; ExamEnd disabled blocks the button', () => {
        render(<><ExamBanner>Còn dưới 5 phút</ExamBanner>
            <ExamEnd answered={1} total={2} onSubmit={() => {}} disabled/></>);
        expect(screen.getByRole('alert').textContent).toMatch(/Còn dưới 5 phút/);
        expect(screen.getByRole('button', {name: 'Nộp bài'})).toBeDisabled();
    });
});
