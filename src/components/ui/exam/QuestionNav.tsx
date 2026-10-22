import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';

import Button from '../Button';
import {IconGrid} from '../icons';
import {cx} from '../cx';
import {questionCellLabel} from './types';
import type {QuestionStatus} from './types';

function Cell({q, current, onJump}: {q: QuestionStatus; current: boolean; onJump: (n: number) => void}) {
    return <button type='button' data-q={q.number}
                   className={cx('vt-qcell', q.answered && 'vt-qcell--done')}
                   aria-current={current ? 'true' : undefined}
                   aria-label={questionCellLabel(q, current)}
                   onClick={() => onJump(q.number)}>
        {q.number}
        {q.flagged && <span aria-hidden='true' className='vt-qcell-flag'/>}
    </button>;
}

export interface QuestionNumberStripProps {
    questions: QuestionStatus[];
    /** Question in view (bold ink border). */
    current?: number;
    /** Jump to a question — the page scrolls to it (the strip does not scroll the page itself). */
    onJump: (number: number) => void;
    /** "Tất cả câu" — opens the "Đi tới câu" sheet. */
    onOpenAll?: () => void;
    className?: string;
}

/**
 * Phone strip under the exam header: horizontally scrolling 36px cells (44px touch area) —
 * done = blue, not done = white, current = thick ink border, flagged = sun dot.
 * Keeps the current cell scrolled into view (strip only, never the page).
 * Hidden on web (≥1024px), where QuestionGrid sits in the sticky side column.
 */
export function QuestionNumberStrip({questions, current, onJump, onOpenAll, className}: QuestionNumberStripProps) {
    const row = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const box = row.current;
        const cell = box?.querySelector<HTMLElement>(`[data-q="${current}"]`);
        if (!box || !cell) return;
        const left = cell.offsetLeft - box.offsetLeft;
        if (left < box.scrollLeft || left + cell.offsetWidth > box.scrollLeft + box.clientWidth) {
            box.scrollLeft = left - (box.clientWidth - cell.offsetWidth) / 2;
        }
    }, [current]);

    return <nav aria-label='Đi tới câu' className={cx('vt-strip', className)}>
        <div ref={row} className='vt-strip-cells'>
            {questions.map(q => <Cell key={q.number} q={q} current={q.number === current} onJump={onJump}/>)}
        </div>
        {onOpenAll && <Button variant='secondary' className='vt-strip-all' icon={<IconGrid/>}
                              aria-haspopup='dialog' onClick={onOpenAll}>Tất cả câu</Button>}
    </nav>;
}

export interface QuestionGridPart {
    title: string;
    questions: QuestionStatus[];
}

export interface QuestionGridProps {
    parts: QuestionGridPart[];
    current?: number;
    onJump: (number: number) => void;
    /** Show the "Đi tới câu" heading + count (web side column). The sheet has its own title. */
    showHeading?: boolean;
    /** Under the legend: e.g. "Đã làm 11 / 23" + Nộp bài. */
    footer?: ReactNode;
    className?: string;
}

/** Grid of question cells grouped by part, with the colour legend (web side column and phone sheet). */
export function QuestionGrid({parts, current, onJump, showHeading, footer, className}: QuestionGridProps) {
    const all = parts.flatMap(p => p.questions);
    const done = all.filter(q => q.answered).length;
    return <div className={cx('vt-qgrid', className)}>
        {showHeading && <div className='vt-qgrid-head'>
            <span className='vt-qgrid-title'>Đi tới câu</span>
            <span className='vt-qgrid-count'>{done} / {all.length} đã làm</span>
        </div>}
        {/* Body scrolls on its own in the web side column, so the footer (Nộp bài) is always visible. */}
        <div className='vt-qgrid-body'>
            {parts.map(p => <div key={p.title} className='vt-qgrid-part' role='group' aria-label={p.title}>
                <span className='vt-qgrid-part-title' aria-hidden='true'>{p.title}</span>
                <div className='vt-qgrid-cells'>
                    {p.questions.map(q => <Cell key={q.number} q={q} current={q.number === current} onJump={onJump}/>)}
                </div>
            </div>)}
            <div className='vt-qlegend' aria-hidden='true'>
                <span><i className='is-done'/>Đã làm</span>
                <span><i className='is-todo'/>Chưa làm</span>
                <span><i className='is-current'/>Đang xem</span>
                <span><i className='is-flag'/>Xem lại sau</span>
            </div>
        </div>
        {footer && <div className='vt-qgrid-foot'>{footer}</div>}
    </div>;
}
