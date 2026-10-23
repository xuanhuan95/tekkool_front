import {useState} from 'react';
import {Link} from 'react-router-dom';

import {Button, Card, EmptyState, FilterChip, Medal, PageColumns, SkeletonCard, Tabs, TitleChip, buttonClass} from '../../components/ui';
import {IconEye, IconEyeOff} from '../../components/ui/icons';
import {useAuthStore} from '../../stores/authStore';
import {useBoard, useMeProfile, useSubjects} from '../../queries/student';
import type {BoardKind} from '../../queries/student';
import type {Board, BoardEntry} from '../../types/student';
import {LoadError, PageHead, hsPath} from './common';
import {formatPoints} from '../../lib/format';
import {boardIntro, meCard, rowName, rowSubline, rowTitle} from './ranking';

const KINDS: {value: BoardKind; label: string}[] = [
    {value: 'week', label: 'Tuần này'}, {value: 'achievements', label: 'Thành tích'},
];
const PAGE = 20;
const MAX = 50;   // BE MAX_LIMIT

function RankCell({rank}: {rank: number | null}) {
    return rank == null ? <span className='hs-rank-none' aria-label='Chưa có hạng'>–</span> : <Medal rank={rank}/>;
}

function Row({e, kind}: {e: BoardEntry; kind: BoardKind}) {
    return <li className={'hs-board-row' + (e.is_me ? ' hs-board-row--me' : '')} aria-current={e.is_me ? 'true' : undefined}>
        <RankCell rank={e.rank}/>
        {e.hidden && !e.is_me && <IconEyeOff size={18}/>}
        <span className='hs-board-name'>
            <b>{rowName(e)}{e.is_me && ' (Bạn)'}</b>
            {rowTitle(e)
                ? <span><TitleChip title={rowTitle(e)!}/></span>
                : <span className='hs-meta'>{rowSubline(e, kind)}</span>}
        </span>
        <span className='hs-board-pts vt-hand'>{formatPoints(e.points)}</span>
    </li>;
}

function MeCard({board, kind}: {board: Board; kind: BoardKind}) {
    const name = useAuthStore(s => s.user?.name);
    const c = meCard(board, kind, name);
    return <section className='vt-card vt-card--md hs-board-row hs-board-row--me hs-board-me' aria-label='Hạng của bạn'>
        <span className='hs-rank-none' style={{width: 34, fontSize: 26}}>{board.me?.rank ?? '–'}</span>
        <span className='hs-board-name'><b>{c.title}</b><span>{c.sub}</span>
            {board.me?.title && <span><TitleChip title={board.me.title}/></span>}</span>
        <span className='hs-board-pts vt-hand' style={{fontSize: 26}}>{formatPoints(board.me?.points ?? 0)}</span>
    </section>;
}

function PrivacyNote() {
    const p = useMeProfile();
    if (!p.data) return null;
    const hidden = p.data.hide_ranking_name;
    return <div className='vt-card vt-card--md hs-row' style={{padding: '10px 14px', justifyContent: 'flex-start', flexWrap: 'nowrap', fontSize: 13}}>
        {hidden ? <IconEyeOff size={18}/> : <IconEye size={18}/>}
        <span>{hidden ? 'Bạn đang ẩn tên với người khác' : 'Bạn đang hiện trên bảng'} · đổi trong <Link to={hsPath.me} className='vt-link'>Tài khoản</Link></span>
    </div>;
}

function BoardPanel({kind, folder}: {kind: BoardKind; folder: string | null}) {
    const [limit, setLimit] = useState(PAGE);
    const q = useBoard(kind, folder, limit);
    if (q.isPending) return <><SkeletonCard label='Đang tải bảng xếp hạng'/></>;
    if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} what='bảng xếp hạng'/>;
    const b = q.data;
    return <>
        <p className='hs-meta'>{boardIntro(b, kind)}</p>
        <MeCard board={b} kind={kind}/>
        {b.entries.length === 0
            ? <EmptyState title={kind === 'week' ? 'Tuần này chưa có ai trên bảng' : 'Chưa có thành tích nào'}
                          description='Hoàn thành một đề để ghi tên mình lên bảng.'
                          action={<Link to={hsPath.exams()} className={buttonClass({variant: 'primary'})}>Làm đề ngay</Link>}/>
            : <Card flush>
                <div className='hs-row hs-meta' style={{padding: '10px 14px', fontWeight: 500}} aria-hidden='true'>
                    <span>Hạng · Học sinh</span><span>Điểm</span>
                </div>
                <ol className='hs-board' aria-label={kind === 'week' ? 'Bảng tuần' : 'Bảng thành tích'}>
                    {b.entries.map((e, i) => <Row key={i + ':' + e.name} e={e} kind={kind}/>)}
                </ol>
            </Card>}
        {b.total > b.entries.length && limit < MAX &&
            <Button variant='secondary' onClick={() => setLimit(MAX)} loading={q.isFetching}>Xem thêm</Button>}
    </>;
}

/** HS-XepHang: week board (default) / achievements, subject filter, pinned "Bạn" row, anonymous rows. */
export default function RankingPage() {
    const [kind, setKind] = useState<BoardKind>('week');
    const [folder, setFolder] = useState<string | null>(null);
    const subjects = useSubjects();

    const filters = <div role='group' aria-label='Lọc theo môn' className='hs-chips'>
        <FilterChip selected={folder === null} onChange={() => setFolder(null)}>Tất cả môn</FilterChip>
        {(subjects.data || []).map(s =>
            <FilterChip key={s.id} selected={folder === s.id} onChange={() => setFolder(s.id)}>{s.name}</FilterChip>)}
    </div>;

    const board = <div className='hs-page' id={'hs-rank-panel-' + kind} role='tabpanel' aria-labelledby={'hs-rank-tab-' + kind}>
        <BoardPanel key={kind + (folder || '')} kind={kind} folder={folder}/>
    </div>;

    return <div className='hs-page'>
        <PageHead title='Bảng xếp hạng'/>
        <Tabs aria-label='Loại bảng' idPrefix='hs-rank' items={KINDS} value={kind} onChange={setKind}/>
        {filters}
        <PageColumns main={board} side={<PrivacyNote/>}/>
    </div>;
}
