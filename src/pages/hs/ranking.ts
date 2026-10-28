import type {Board, BoardEntry} from '../../types/student';
import type {BoardKind} from '../../queries/student';
import {plainText} from '../../lib/format';

/** Title shown under a name (SPT-64): the student's tier from BE; null → the activity line below is shown instead. */
export function rowTitle(e: BoardEntry): {key: string; name: string} | null {
    return e.title ?? null;
}

/** Second line under a name on the board when there is no title: activity. */
export function rowSubline(e: BoardEntry, kind: BoardKind): string {
    const tmp = e.provisional ? ' · tạm tính' : '';
    if (kind === 'week') return (e.exams ?? 0) + ' đề tuần này' + tmp;
    return (plainText(e.exam_name) || 'Đề đã xoá') + tmp;
}

/** The pinned "Bạn" card: always present (BE adds a rank-null row when you have nothing on this board). */
export function meCard(board: Board, kind: BoardKind, myName?: string | null): {title: string; sub: string} {
    const me = board.me;
    const name = (myName || me?.name || '').trim();
    if (!me || me.rank == null) {
        const none = kind === 'week' ? 'chưa có bài tuần này' : 'chưa có bài được chấm';
        return {title: 'Bạn · chưa có hạng', sub: (name ? name + ' · ' : '') + none};
    }
    return {title: 'Bạn · hạng ' + me.rank, sub: (name ? name + ' · ' : '') + rowSubline(me, kind)};
}

/** Name drawn on a row. */
export function rowName(e: BoardEntry): string {
    return e.name || 'Học sinh';
}
