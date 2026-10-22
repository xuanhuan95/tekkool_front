import type {Board, BoardEntry} from '../../types/student';
import type {BoardKind} from '../../queries/student';
import {formatIsoDay, plainText} from './format';

/** Second line under a name on the board. Titles of OTHER students: no API yet → activity instead. */
export function rowSubline(e: BoardEntry, kind: BoardKind): string {
    if (e.hidden && !e.is_me) return 'Đã ẩn tên';
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
    return {title: 'Bạn · hạng ' + me.rank, sub: (name ? name + ' · ' : '') + rowSubline({...me, hidden: false}, kind)};
}

export function boardIntro(board: Board | undefined, kind: BoardKind): string {
    if (kind === 'achievements') return 'Điểm cao nhất (thang 10) của mỗi học sinh, tính mọi lúc.';
    const week = board?.week_start && board.week_end
        ? ' Tuần ' + formatIsoDay(board.week_start) + ' – ' + formatIsoDay(board.week_end) + '.' : '';
    return 'Mỗi đề hoàn thành +10, cộng điểm bài; mỗi đề tính lần tốt nhất.' + week;
}

/** Name drawn on a row: yourself is always "Bạn"-highlighted but keeps your real name. */
export function rowName(e: BoardEntry): string {
    return e.name || (e.hidden ? 'Học sinh ẩn danh' : 'Học sinh');
}
