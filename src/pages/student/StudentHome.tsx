import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {EmptyState, Loading} from '../../components/ui';
import {initialsOf, Medal} from '../../components/ui/Avatar';
import {useAuthStore} from '../../stores/authStore';
import {useInProgress} from '../../queries/inProgress';
import type {InProgress} from '../../queries/inProgress';
import {useBoard, useMeProfile, useMySubmissions, useSubjects} from '../../queries/student';
import type {Board, BoardEntry, MeProfile, Streak} from '../../types/student';
import type {Submission} from '../../types/submission';
import {useMediaQuery, DESKTOP} from '../useMediaQuery';
import {LoadError, greetName, hsPath, titleHint} from '../hs/common';
import {SubjectIcon, sjClass} from '../hs/SubjectPicker';
import {IconCrown} from '../../components/ui/icons';
import {formatMinutes, formatPoints, formatScore, formatShortDateTime, minutesLeft, score10, withSubject} from '../../lib/format';
import {
    chainGeometry, gapToThird, greetingWord, sameSubject, scoreLevel, splitSubjects, streakState, subjectStats, weekStrip,
} from './homeLogic';
import type {SubjectStat} from './homeLogic';
import './home.css';

const RECENT = 4;
const TOP_LIMIT = 8;

/** Score ring (`.bd`): arc = score/10, colour by level; `pending` = provisional score of a not-yet-graded essay. */
function ScoreRing({value, pending}: {value: number; pending?: boolean}) {
    const text = formatScore(value);
    const level = pending ? 'pend' : scoreLevel(value);
    return <span className={`bd bd--${level} bd--sm`}
                 title={pending ? `Chờ chấm tự luận, điểm tạm tính ${text}` : `Điểm ${text} trên 10`}>
        <span className='bd-ring'>
            <svg className='bd-svg' viewBox='0 0 40 40' aria-hidden='true' focusable='false'>
                <circle className='bd-track' cx='20' cy='20' r='17'/>
                <circle className='bd-arc' cx='20' cy='20' r='17' pathLength={100}
                        style={{'--p': pending ? 0 : value} as React.CSSProperties}/>
            </svg>
            <span className='bd-n'>{text}</span>
        </span>
        {pending && <span className='bd-tmp'>Chờ chấm</span>}
    </span>;
}

const FLAME = <svg width='56' height='56' viewBox='5 1.5 14 17.5' fill='none' stroke='currentColor' strokeWidth='2'
                   strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>
    <path d='M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z'/></svg>;

const MASCOT = <svg width='150' height='170' viewBox='0 0 120 150' aria-hidden='true' focusable='false'>
    <g transform='rotate(14 60 80)' stroke='#1c1917' strokeWidth='3' strokeLinejoin='round' strokeLinecap='round'>
        <rect x='42' y='8' width='36' height='16' rx='5' fill='#f9a8b8'/>
        <rect x='42' y='24' width='36' height='9' fill='#d6d3d1'/>
        <rect x='42' y='33' width='36' height='81' fill='#faad05'/>
        <path d='M42 114 L60 146 L78 114 Z' fill='#f3d9b1'/>
        <path d='M54 134 L60 146 L66 134 Z' fill='#1c1917'/>
        <path d='M51 33 V114 M69 33 V114' strokeWidth='1.5' opacity='.35'/>
        <circle cx='52' cy='62' r='3.4' fill='#1c1917' stroke='none'/>
        <circle cx='68' cy='62' r='3.4' fill='#1c1917' stroke='none'/>
        <path d='M52 74 Q60 83 68 74' fill='none'/>
        <circle cx='46' cy='72' r='3.6' fill='#fb7185' stroke='none' opacity='.75'/>
        <circle cx='74' cy='72' r='3.6' fill='#fb7185' stroke='none' opacity='.75'/>
    </g></svg>;

/** Greeting + weekly streak (SPT-138: no CTA button, subjects below lead to the exams). `streak` null (still loading / old BE) → no streak block. */
function Banner({name, streak}: {name?: string; streak?: Streak | null}) {
    const now = new Date();
    const week = streak ? weekStrip(streak.this_week, now) : null;
    const state = streak ? streakState(streak) : null;
    return <section className='vt-card c-banner rise' aria-label='Chào mừng'>
        <div className='c-hello'>
            <div className='hs-head'><h1 className='hs-head-title'>Chào buổi {greetingWord(now)}, {greetName(name) || 'bạn'}!</h1></div>
            {streak && week && state && <div className={'c-sk c-sk--' + state} aria-label='Chuỗi liên tiếp của em'>
                <div className='c-sk-body'>
                    <div className='c-sk-fl'><span>{FLAME}<b>{streak.current}</b></span><em>tuần</em></div>
                    <div className='c-sk-week' role='img' aria-label={`${week.label}, đã luyện ${week.practised} ngày`}>
                        {week.days.map(d => <span key={d.label}
                                                  className={'c-sk-d' + (d.on ? ' on' : '') + (d.today ? ' today' : '') + (d.future ? ' fut' : '')}>
                            {d.label}<i>{d.day}</i></span>)}
                    </div>
                </div>
                <div className='c-sk-foot'>
                    {state === 'done' && <span className='hs-meta'>Kỷ lục {streak.best} tuần</span>}
                    {state === 'keep' && <><p className='c-sk-note'>Làm 1 bài tuần này để giữ chuỗi</p>
                        {streak.best > streak.current && <span className='hs-meta'>Kỷ lục {streak.best} tuần</span>}</>}
                    {state === 'zero' && <p className='c-sk-note'>Làm 1 bài tuần này để bắt đầu chuỗi</p>}
                </div>
            </div>}
        </div>
        <div className='c-mascot' aria-hidden='true'>{MASCOT}</div>
    </section>;
}

type Subj = {id: string; name: string; exams: number; done: number};

function PracticeCard({s, stat, doing}: {s: Subj; stat?: SubjectStat; doing: InProgress | null}) {
    const count = stat?.count ?? 0;
    let sub = 'Chưa làm bài nào';
    if (doing) sub = `${doing.answered}/${doing.total} câu · ${minutesLeft(doing.remaining_sec)}`;
    else if (stat?.best != null) sub = `${count} lượt · cao nhất ${formatScore(stat.best)}`;
    else if (count > 0) sub = `${count} lượt · chờ chấm`;
    const ring = stat?.best != null ? <ScoreRing value={stat.best}/>
        : stat?.provisional != null ? <ScoreRing value={stat.provisional} pending/> : null;
    return <Link className={'c-card' + (doing ? ' c-card--doing ' : ' ') + sjClass(s.name)}
                 to={doing ? hsPath.take(doing.exam_id, false) : hsPath.exams(s.id)}>
        <SubjectIcon name={s.name}/>
        <span className='c-main'><span className='c-name'>{s.name}</span><span className='c-sub'>{sub}</span></span>
        {doing
            ? <>
                <span className='vt-btn vt-btn--primary c-doing-go'>Làm tiếp →</span>
                <span className='c-doing-bar' role='progressbar' aria-label='Số câu đã làm' aria-valuemin={0}
                      aria-valuemax={doing.total} aria-valuenow={doing.answered}>
                    <i style={{width: (doing.total ? Math.min(100, doing.answered / doing.total * 100) : 0).toFixed(1) + '%'}}/>
                </span>
            </>
            : ring}
    </Link>;
}

function Chain({subjects}: {subjects: Subj[]}) {
    const open = subjects.filter(s => s.exams > 0).length;
    const g = chainGeometry(subjects.length, open);
    return <div className='c-chain'>
        <svg className='c-chain-path' viewBox={g.viewBox} preserveAspectRatio='none' aria-hidden='true'>
            {g.soon && <path className='is-soon' d={g.soon}/>}
            {g.open && <path className='is-open' d={g.open}/>}
        </svg>
        {subjects.map((s, i) => {
            const style = {'--i': i, left: g.nodes[i].left, top: g.nodes[i].top + 'px'} as React.CSSProperties;
            const body = <>
                <SubjectIcon name={s.name}/><b>{s.name}</b><small>{s.exams > 0 ? 'Vào thi →' : 'Sắp có'}</small>
            </>;
            return s.exams > 0
                ? <Link key={s.id} className={'c-node ' + sjClass(s.name)} style={style} to={hsPath.exams(s.id)}>{body}</Link>
                : <div key={s.id} className={'c-node c-node--soon ' + sjClass(s.name)} style={style}>{body}</div>;
        })}
    </div>;
}

function SubjectSections({chosen}: {chosen: string[]}) {
    const q = useSubjects();
    const subs = useMySubmissions();
    const {data: doing} = useInProgress();
    const head = (title: string, action?: ReactNode) => <div className='hs-row'>
        <div className='hs-col2'><h2 className='hs-h2'>{title}</h2></div>{action}</div>;

    if (q.isPending) return <section className='hs-sec'>{head('Môn đang luyện')}<Loading/></section>;
    if (q.isError) return <section className='hs-sec'>{head('Môn đang luyện')}
        <LoadError error={q.error} onRetry={() => q.refetch()} what='danh sách môn'/></section>;
    if (q.data.length === 0) return <section className='hs-sec'>{head('Môn đang luyện')}
        <EmptyState title='Chưa có môn thi nào' description='Giáo viên đang soạn đề, em quay lại sau nhé.'/></section>;

    const stats = subjectStats(subs.data ?? []);
    const {practising, more} = splitSubjects(q.data, chosen, stats);
    const anyAttempt = practising.some(s => (stats.get(s.id)?.count ?? 0) > 0);
    const doingFor = (s: Subj) => doing && sameSubject(doing.subject, s.name) ? doing : null;
    // The running attempt always has a card, even when its subject is not among the chosen ones.
    const orphan = doing && !practising.some(s => doingFor(s)) ? doing : null;
    return <>
        <section className='hs-sec'>
            {head('Môn đang luyện')}
            {practising.length === 0 && !orphan
                ? <EmptyState title='Em chưa chọn môn nào' description='Chọn môn em thi để trang chủ gợi ý đúng việc cần làm.'/>
                : !anyAttempt && !doing
                    ? <div className='c-more-grid'>{practising.map(s => <Link key={s.id} className={'c-more ' + sjClass(s.name)} to={hsPath.exams(s.id)}>
                        <SubjectIcon name={s.name} small/><span><b>{s.name}</b></span><span className='go'>Vào thi →</span></Link>)}</div>
                    : <div className='c-grid'>
                        {orphan && <PracticeCard s={{id: '', name: orphan.subject || 'Đề đang làm', exams: 1, done: 0}} doing={orphan}/>}
                        {practising.map(s => <PracticeCard key={s.id} s={s} stat={stats.get(s.id)} doing={doingFor(s)}/>)}
                    </div>}
        </section>
        {more.length > 0 && <section className='hs-sec'>{head('Thử sức thêm')}<Chain subjects={more}/></section>}
    </>;
}

function RecentSection() {
    const q = useMySubmissions();
    const head = <div className='hs-row'><h2 className='hs-h2'>Bài làm gần đây</h2>
        {q.data && q.data.length > 0 && <Link className='vt-link' to={hsPath.history}>Xem lịch sử</Link>}</div>;
    if (q.isPending) return null;   // one loading block per screen: the subjects section carries it
    if (q.isError) return <section className='hs-sec'>{head}<LoadError error={q.error} onRetry={() => q.refetch()} what='bài làm gần đây'/></section>;
    const rows = q.data.slice(0, RECENT);
    if (rows.length === 0) return <section className='hs-sec'>{head}
        <div className='vt-card empty-recent'>
            <span className='empty-ico'><svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'
                                              strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>
                <path d='M6 3h9l4 4v14H6z'/><path d='M14 3v5h5'/><path d='M9 13h6M9 17h4'/></svg></span>
            <div className='hs-col2'><b>Chưa có bài làm nào</b></div>
            <Link className='vt-btn' to={hsPath.exams()}>Chọn đề đầu tiên →</Link>
        </div></section>;
    return <section className='hs-sec'>{head}
        <div className='vt-card c-rec'>
            <div className='c-rec-head' aria-hidden='true'><span>Tên đề</span><span>Thời gian làm</span><span>Hoàn thành</span><span>Điểm</span></div>
            {rows.map((s: Submission) => {
                const v = score10(s.score, s.max_score);
                const pending = s.status === 'GRADING' || s.pending_count > 0;
                return <Link key={s.id} className={'c-rec-row ' + sjClass(s.subject?.name)} to={hsPath.result(s.id)}>
                    <span className='c-rec-info'><SubjectIcon name={s.subject?.name} small/>
                        <b>{withSubject(s.subject?.name, s.exam_name, ' — ') || 'Đề không tên'}</b></span>
                    <span className='c-rec-when'>
                        <span className='c-rec-dur vt-num'>{formatMinutes(s.duration_sec)}</span>
                        <span className='c-rec-at vt-num'>{formatShortDateTime(s.submitted_at)}</span>
                    </span>
                    <span className='c-rec-sc'>{v != null ? <ScoreRing value={v} pending={pending}/> : '—'}</span>
                </Link>;
            })}
        </div></section>;
}

/** Row avatar of someone else: first letter of the given name (artboard: "Phạm Thu Trang" → T). */
const initial = (n: string) => (n.trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase();

function RankRow({e, name}: {e: BoardEntry; name: string}) {
    const none = e.rank == null;
    return <li className={'c-rk-row' + (e.is_me ? ' c-rk-row--me' : '') + (e.is_me && none ? ' c-rk-row--none' : '')}>
        <span className='c-rk'>{none ? '—' : e.rank}</span>
        <span className='vt-avatar' aria-hidden='true'>{e.is_me ? initialsOf(name.replace(/^Em · /, '')) : initial(name)}</span>
        <span className='c-rk-name'>{none ? 'Em chưa có hạng tuần này' : name}</span>
        <b>{none ? '—' : formatPoints(e.points)}</b>
    </li>;
}

function WeekTop({myName}: {myName?: string}) {
    const q = useBoard('week', null, TOP_LIMIT);
    if (q.isPending) return null;
    if (q.isError) return null;   // side widget: the full board has its own error state
    const b: Board = q.data;
    const name = (e: BoardEntry) => e.is_me ? 'Em · ' + (greetName(myName) || 'bạn') : e.name;
    const top = b.entries.filter(e => e.rank != null && e.rank <= 3);
    const rest = b.entries.filter(e => e.rank == null || e.rank > 3);
    const meOut = b.me && !b.entries.some(e => e.is_me) ? b.me : null;
    const gap = meOut ? gapToThird(top.find(e => e.rank === 3)?.points, meOut.points, meOut.rank) : null;
    const pod = (rank: number) => {
        const e = top.find(x => x.rank === rank);
        return e && <div key={rank} className={'c-pod c-pod--' + rank}>
            {rank === 1 && <IconCrown size={20} color='var(--vt-sun)'/>}
            <Medal rank={rank}/><span className='c-pod-name'>{name(e)}</span><b>{formatPoints(e.points)}</b><i/>
        </div>;
    };
    return <section aria-label='Top tuần này' className='vt-card hs-mini'>
        <div className='hs-row'><h2 className='hs-h2'>Top tuần này</h2><Link className='vt-link' to={hsPath.ranking}>Xem tất cả</Link></div>
        {b.entries.length === 0
            ? <p className='hs-meta'>Tuần này chưa có ai hoàn thành đề. Làm đề đầu tiên để lên bảng!</p>
            : <>
                {top.length > 0 && <div className='c-podium'>{pod(2)}{pod(1)}{pod(3)}</div>}
                <ol className='c-rank'>
                    {rest.map(e => <RankRow key={(e.rank ?? 0) + e.name} e={e} name={name(e)}/>)}
                    {meOut && <><li className='c-rk-more' aria-hidden='true'>···</li><RankRow e={meOut} name={name(meOut)}/></>}
                </ol>
                {gap && <div className='c-gap'>Cách hạng 3: <b>{gap}</b> điểm</div>}
            </>}
    </section>;
}

function TitleBlock({profile, web}: {profile?: MeProfile; web: boolean}) {
    const next = titleHint(profile);
    if (!profile || (!profile.title && !next)) return null;
    return <section className={'vt-card vt-card--md hs-title' + (web ? ' hs-title--web' : '')} aria-label='Danh hiệu'>
        <span className='hs-title-icon'><IconCrown size={20}/></span>
        <div className='hs-title-main'>
            <span className='hs-col2'><span className='hs-meta'>Danh hiệu</span>
                <span className='hs-title-name'>{profile.title ? profile.title.name : 'Chưa có danh hiệu'}</span></span>
            {next ? <span className='hs-meta'>{next.hint}.</span>
                : <span className='hs-meta'>Em đang ở bậc cao nhất. Giữ phong độ nhé!</span>}
        </div>
    </section>;
}

/** Student home (APP-student-home-vC): banner + streak → Môn đang luyện → Thử sức thêm → Bài làm gần đây; ≥1024px adds Top tuần + Danh hiệu on the right. */
export default function StudentHome() {
    const web = useMediaQuery(DESKTOP);
    const name = useAuthStore(s => s.user?.name);
    const profile = useMeProfile();

    const main = <div className='hs-page'>
        <Banner name={name} streak={profile.data?.streak}/>
        <SubjectSections chosen={profile.data?.exam_subjects ?? []}/>
        <RecentSection/>
        {!web && <TitleBlock profile={profile.data} web={false}/>}
    </div>;
    if (!web) return main;
    return <div className='c-layout'>
        {main}
        <aside className='c-side'><div className='c-side-in'>
            <WeekTop myName={name}/>
            <TitleBlock profile={profile.data} web/>
        </div></aside>
    </div>;
}
