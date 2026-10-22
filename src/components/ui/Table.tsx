import {useEffect, useRef, useState} from 'react';
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
    /** Stick to the right edge while the table scrolls sideways (the "Thao tác" column on phones). */
    sticky?: boolean;
}

/**
 * Which sides still have hidden columns. Drives the edge shadows that tell a phone user the
 * table scrolls sideways (QC B4) — the page itself never scrolls horizontally.
 */
const MAX_STICKY_SHARE = 0.45;

function useScrollEdges() {
    const ref = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({left: false, right: false, noSticky: false});
    useEffect(() => {
        const box = ref.current;
        if (!box) return;
        const update = () => {
            const left = box.scrollLeft > 1;
            const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
            // A pinned column wider than 45% of what is visible hides the row it belongs to (QC B4b):
            // then it simply scrolls with the rest.
            const pinned = box.querySelector<HTMLElement>('th.vt-td--sticky');
            const noSticky = !!pinned && pinned.offsetWidth > box.clientWidth * MAX_STICKY_SHARE;
            setEdges(e => e.left === left && e.right === right && e.noSticky === noSticky ? e : {left, right, noSticky});
        };
        update();
        box.addEventListener('scroll', update, {passive: true});
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
        ro?.observe(box);
        window.addEventListener('resize', update);
        return () => {
            box.removeEventListener('scroll', update);
            ro?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, []);
    return {ref, edges};
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
    /** Title / filters drawn INSIDE the card above the table, with a soft rule under them (design D). */
    toolbar?: ReactNode;
    /** No card of its own: the caller already put the table inside a card. */
    bare?: boolean;
}

/** Compact table inside a card: 13px muted header, 1.5px soft rules, tabular numbers, overflow-x on phones. */
export default function Table<T>({columns, rows, rowKey, caption, showCaption, minWidth = 520, isHighlighted, empty, className,
                                  toolbar, bare}: TableProps<T>) {
    const cell = (c: Column<T>) => cx(c.align === 'right' && 'vt-td--right', c.align === 'center' && 'vt-td--center',
        c.emphasis && 'vt-td--' + c.emphasis, c.sticky && 'vt-td--sticky') || undefined;
    const {ref, edges} = useScrollEdges();

    return <div className={cx(!bare && 'vt-card', !bare && 'vt-card--flush', className)}>
        {toolbar && <div className='vt-table-toolbar'>{toolbar}</div>}
        {/* tabIndex: lets keyboard users scroll a table wider than the phone. */}
        <div ref={ref} role='region' aria-label={caption} tabIndex={0}
             className={cx('vt-table-scroll', edges.left && 'vt-table-scroll--left', edges.right && 'vt-table-scroll--right',
                                edges.noSticky && 'vt-table-scroll--nosticky')}>
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
