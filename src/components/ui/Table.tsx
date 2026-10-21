import type {ReactNode} from 'react';

import {cx} from './cx';

export interface Column<T> {
    key: string;
    header: ReactNode;
    /** Cell content; defaults to row[key]. */
    render?: (row: T, index: number) => ReactNode;
    align?: 'left' | 'right' | 'center';
    /** strong = 600 (names), bold = 700 (scores), muted = secondary text (dates). */
    emphasis?: 'strong' | 'bold' | 'muted';
}

export interface TableProps<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T, index: number) => string | number;
    /** Accessible name; also the label of the horizontal scroll region. */
    caption: string;
    /** Draw the caption above the table (otherwise screen-reader only). */
    showCaption?: boolean;
    /** Wide tables keep this width and scroll sideways on phones. */
    minWidth?: number;
    /** Row painted blue — "Bạn" on the leaderboard. */
    isHighlighted?: (row: T) => boolean;
    empty?: ReactNode;
    className?: string;
}

/** Compact table inside a card: 13px muted header, 1.5px soft rules, tabular numbers, overflow-x on phones. */
export default function Table<T>({columns, rows, rowKey, caption, showCaption, minWidth = 520, isHighlighted, empty, className}: TableProps<T>) {
    const cell = (c: Column<T>) => cx(c.align === 'right' && 'vt-td--right', c.align === 'center' && 'vt-td--center',
        c.emphasis && 'vt-td--' + c.emphasis) || undefined;

    return <div className={cx('vt-card', 'vt-card--flush', className)}>
        {/* tabIndex: lets keyboard users scroll a table wider than the phone. */}
        <div className='vt-table-scroll' role='region' aria-label={caption} tabIndex={0}>
            <table className='vt-table' style={{minWidth}}>
                <caption className={showCaption ? undefined : 'vt-sr-only'}>{caption}</caption>
                <thead>
                    <tr>{columns.map(c => <th key={c.key} scope='col' className={cell({...c, emphasis: undefined})}>{c.header}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.length === 0
                        ? <tr><td colSpan={columns.length} className='vt-table-empty'>{empty ?? 'Chưa có dữ liệu'}</td></tr>
                        : rows.map((r, i) =>
                            <tr key={rowKey(r, i)} className={isHighlighted?.(r) ? 'vt-tr--me' : undefined}>
                                {columns.map(c => <td key={c.key} className={cell(c)}>
                                    {c.render ? c.render(r, i) : (r as Record<string, ReactNode>)[c.key]}
                                </td>)}
                            </tr>)}
                </tbody>
            </table>
        </div>
    </div>;
}
