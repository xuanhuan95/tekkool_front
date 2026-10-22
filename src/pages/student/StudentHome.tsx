import {useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {useQueries, useQuery} from '@tanstack/react-query';
import striptags from 'striptags';

import Api from '../../services/api';
import Loading from '../../components/Loading';
import {useAuthStore} from '../../stores/authStore';
import {useInProgress, remainingLabel} from '../../queries/inProgress';
import {useRanking} from '../../queries/ranking';
import {formatMetricValue} from '../ranking/rankingQuery';
import {useMediaQuery, DESKTOP} from '../useMediaQuery';
import {subjectStyle, stripAccents} from '../dashboard/subjectStyle';
import type {SubjectStyle} from '../dashboard/subjectStyle';
import type {ExamSummary, Folder} from '../../types/exam';
import {initial, TurnsChip} from './StudentShell';
import {IconArrow, IconBack, IconPlay} from './icons';

type Subject = Folder & {style: SubjectStyle; exams: ExamSummary[] | undefined};
type Filter = 'all' | 'todo' | 'done';

const MEDALS = [['#FFD66B', '#6B4200'], ['#E3E8F2', '#4A5778'], ['#F5C9A0', '#7A3E0A']];

function greeting(d = new Date()) {
    const h = d.getHours();
    return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

const givenName = (name?: string | null) => (name || '').trim().split(/\s+/).pop() || '';
const isDone = (e: ExamSummary) => (e.attempts || 0) > 0;
const doneCount = (s: Subject) => (s.exams || []).filter(isDone).length;
const examCode = (i: number) => 'Đề số ' + String(i + 1).padStart(2, '0');
const examMeta = (e: ExamSummary) =>
    [e.question_count ? e.question_count + ' câu' : '', e.duration ? e.duration + ' phút' : ''].filter(Boolean).join(' · ');

/** Score on the 10-point scale, Vietnamese decimal comma: 8.6 -> "8,6". */
function score10(e: ExamSummary): string | null {
    if (e.last_status === 'GRADING') return null;
    if (e.last_score == null || !e.last_max) return null;
    return String(Math.round(e.last_score / e.last_max * 100) / 10).replace('.', ',');
}

function Scene({className}: {className: string}) {
    return <div className={className}>
        <div className='scene'>
            <img src='/mascot/hero-scene.svg' alt=''/>
            <img src='/mascot/wave.svg' alt=''/>
        </div>
    </div>;
}

function Bar({pct, color, className}: {pct: number; color?: string; className?: string}) {
    return <span className={'spt-bar ' + (className || '')}>
        <span style={{width: pct + '%', background: color}}/>
    </span>;
}

function ExamAction({exam, onOpen}: {exam: ExamSummary; onOpen: (e: ExamSummary) => void}) {
    const s = score10(exam);
    if (isDone(exam)) return <button type='button' className='spt-score' title='Làm lại đề này' onClick={() => onOpen(exam)}>
        {s ? <><b>{s}</b>điểm</> : <span>Chờ chấm</span>}
    </button>;
    return <button type='button' className='spt-btn sm' onClick={() => onOpen(exam)}>Làm bài</button>;
}

export default function StudentHome() {
    const navigate = useNavigate();
    const desktop = useMediaQuery(DESKTOP);
    const {subjectId} = useParams();
    const [params] = useSearchParams();
    const q = stripAccents(params.get('q'));
    const user = useAuthStore(s => s.user);
    const [filter, setFilter] = useState<Filter>('all');

    const subjectsQ = useQuery({queryKey: ['folder', 'subjects'], queryFn: () => Api.get<Folder[]>('folder/subjects')});
    // ponytail: one browse call per subject (8 today) to count done/total; a counts endpoint if subjects grow past ~20.
    const examsQ = useQueries({
        queries: (subjectsQ.data || []).map(f => ({
            queryKey: ['exam', 'browse', f.id],
            queryFn: () => Api.get<ExamSummary[]>('exam/browse?folder=' + f.id),
        })),
    });
    const {data: cont} = useInProgress();
    const board = useRanking(desktop ? {queryString: 'preset=top_score'} : null);

    // ?lam_lai=1: a click in the list means "take it again", see SubjectBrowser.openExam.
    const openExam = (e: ExamSummary) => navigate('/do-exam/' + e.id + '?lam_lai=1');
    const resume = () => cont && navigate('/do-exam/' + cont.exam_id);

    if (subjectsQ.error) return <div className='spt-empty'>Không tải được danh sách môn học.</div>;
    if (!subjectsQ.data) return <Loading/>;

    const subjects: Subject[] = subjectsQ.data.map((f, i) => ({...f, style: subjectStyle(f.name), exams: examsQ[i]?.data}));
    const totalExams = subjects.reduce((n, s) => n + (s.exams?.length || 0), 0);
    const matches = (s: string) => !q || stripAccents(striptags(s)).includes(q);
    const shown = q ? subjects.filter(s => matches(s.name) || (s.exams || []).some(e => matches(e.name))) : subjects;

    const sel = subjects.find(s => s.id === subjectId) || (desktop ? shown[0] : undefined);
    if (subjectId && !subjects.some(s => s.id === subjectId))
        return <div className='spt-empty'>Không tìm thấy môn này. Môn có thể đã bị xoá hoặc đổi tên.</div>;

    const selExams = (sel?.exams || []).filter(e => !q || matches(e.name) || matches(sel!.name));
    const firstTodo = () => {
        for (const s of sel ? [sel, ...subjects] : subjects) {
            const e = (s.exams || []).find(x => !isDone(x));
            if (e) return e;
        }
    };
    const heroGo = () => {
        if (cont) return resume();
        const e = firstTodo();
        if (e) openExam(e);
    };
    const contStyle = subjectStyle(cont?.subject);
    const contPct = cont && cont.total ? Math.round(cont.answered / cont.total * 100) : 0;
    const contTitle = cont ? (cont.subject ? cont.subject + ' – ' : '') + striptags(cont.exam_name) : '';
    const firstName = givenName(user?.name);

    /* ---------- mobile: one subject (Main.dc.html isExams) ---------- */
    if (!desktop && sel) {
        const all = sel.exams || [];
        const list = all.filter(e => filter === 'all' || (filter === 'done') === isDone(e));
        const done = doneCount(sel);
        return <div className='spt-mx'>
            <div className='spt-mx-head'>
                <button type='button' className='spt-icon-btn' aria-label='Quay lại' onClick={() => navigate('/')}><IconBack/></button>
                <h1>Đề {sel.name}</h1>
            </div>
            <div className='spt-mx-sum' style={{background: sel.style.tint}}>
                <span className='spt-disc' style={{background: sel.style.fg}}>{sel.style.glyph}</span>
                <span className='spt-mx-sum-main'>
                    <span><span>Tiến độ</span><span>{done}/{all.length} đề</span></span>
                    <Bar pct={all.length ? done / all.length * 100 : 0} color={sel.style.fg}/>
                    <small>{all.length} đề · cấu trúc đề 2027</small>
                </span>
            </div>
            <div className='spt-filters' role='group' aria-label='Lọc đề'>
                {([['all', 'Tất cả'], ['todo', 'Chưa làm'], ['done', 'Đã làm']] as const).map(([k, label]) =>
                    <button key={k} type='button' className={'spt-filter' + (filter === k ? ' on' : '')}
                            aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
            </div>
            <div className='spt-mx-list'>
                {!sel.exams ? <Loading/> : !list.length ? <div className='spt-empty'>Chưa có đề nào.</div> :
                    list.map(e => <div key={e.id} className='spt-card spt-mx-exam'>
                        <span className='spt-exam-main'>
                            <small>{examCode(all.indexOf(e))}</small>
                            <b>{striptags(e.name) || 'Đề không tên'}</b>
                            <small>{examMeta(e)}</small>
                        </span>
                        <ExamAction exam={e} onOpen={openExam}/>
                    </div>)}
            </div>
        </div>;
    }

    const subjectGrid = (cls: string) => <div className={cls}>
        {shown.map(s => {
            const on = desktop && s.id === sel?.id;
            return <button key={s.id} type='button' className='spt-subj' aria-pressed={desktop ? on : undefined}
                           style={{background: s.style.tint, borderColor: on ? s.style.fg : undefined}}
                           onClick={() => navigate('/subject/' + s.id + (q ? '?q=' + encodeURIComponent(params.get('q')!) : ''))}>
                <span className='spt-disc' style={{background: s.style.fg}}>{s.style.glyph}</span>
                <span className='spt-subj-name'>
                    <b>{s.name}</b>
                    <small>{s.exams ? doneCount(s) + '/' + s.exams.length + ' đề' : '…'}</small>
                </span>
            </button>;
        })}
    </div>;

    /* ---------- mobile: home (Main.dc.html isSubjects) ---------- */
    if (!desktop) return <div className='spt-m'>
        {/* ponytail: streak chip hidden until streak data exists */}
        <header className='spt-m-head'>
            <span className='spt-av'>{initial(user?.name)}</span>
            <span className='spt-me-name'><small>{user?.email}</small><b>{user?.name}</b></span>
            <TurnsChip compact/>
        </header>
        <section className='spt-m-hero'>
            <Scene className='scene-wrap'/>
            <div className='spt-m-hero-text'>
                <h1>{greeting()}, <span>{firstName}!</span></h1>
                <p>Thêm một đề nữa là gần hơn với giảng đường.</p>
                <button type='button' className='spt-btn' onClick={heroGo}>Làm đề tiếp <IconArrow size={16}/></button>
            </div>
        </section>
        {cont && <section className='spt-card spt-m-cont'>
            <span className='spt-cont-glyph' style={{background: contStyle.tint, color: contStyle.fg}}>{contStyle.glyph}</span>
            <span className='spt-m-cont-main'>
                <small>Đang làm dở · Câu {cont.answered}/{cont.total}</small>
                <b>{contTitle}</b>
                <Bar pct={contPct}/>
            </span>
            <button type='button' className='spt-play' aria-label={'Tiếp tục làm ' + contTitle} onClick={resume}><IconPlay size={16}/></button>
        </section>}
        <section className='spt-m-sec'>
            <div className='spt-sec-head'>
                <h2 className='spt-h2'>Luyện theo môn</h2>
                <small>{subjects.length} môn · {totalExams} đề</small>
            </div>
            {shown.length ? subjectGrid('spt-m-subjects') : <div className='spt-empty'>Không tìm thấy môn hay đề nào.</div>}
        </section>
    </div>;

    /* ---------- desktop (HomeDesktop.dc.html) ---------- */
    const selDone = sel ? doneCount(sel) : 0;
    const selCount = sel?.exams?.length || 0;
    const top = board.data ? board.data.entries.slice(0, 5) : [];
    const me = board.data?.me;
    const rows = me && !top.some(r => r.is_me) ? [...top.slice(0, 4), me] : top;
    const crit = board.data?.criteria[0];

    return <div className='spt-home'>
        <div className='spt-main'>
            <section className='spt-hero'>
                <Scene className='spt-hero-scene'/>
                <div className='spt-hero-text'>
                    <span className='spt-eyebrow'>KỲ THI THPT 2027</span>
                    <h1>{greeting()},<br/><span>{firstName}!</span></h1>
                    <p>Thêm một đề nữa là gần hơn một bước với giảng đường đại học.</p>
                    <button type='button' className='spt-btn' onClick={heroGo}>Làm đề tiếp <IconArrow/></button>
                </div>
            </section>

            {cont && <section className='spt-sec'>
                <h2 className='spt-h2'>Tiếp tục làm bài</h2>
                <div className='spt-card spt-cont'>
                    <span className='spt-cont-glyph' style={{background: contStyle.tint, color: contStyle.fg}}>{contStyle.glyph}</span>
                    <span className='spt-cont-main'>
                        <b>{contTitle}</b>
                        <small>Câu {cont.answered}/{cont.total} · {remainingLabel(cont.remaining_sec)}</small>
                        <span className='spt-cont-prog'><Bar pct={contPct}/>{contPct}%</span>
                    </span>
                    <button type='button' className='spt-btn' onClick={resume}><IconPlay/> Tiếp tục</button>
                </div>
            </section>}

            <section className='spt-sec'>
                <div className='spt-sec-head'>
                    <h2 className='spt-h2'>Luyện theo môn</h2>
                    <small>{subjects.length} môn · {totalExams} đề</small>
                </div>
                {shown.length ? subjectGrid('spt-subjects') : <div className='spt-empty'>Không tìm thấy môn hay đề nào.</div>}
            </section>

            {sel && <section className='spt-card spt-exams'>
                <div className='spt-exams-head'>
                    <span>
                        <span className='spt-disc' style={{background: sel.style.fg}}>{sel.style.glyph}</span>
                        <h2 className='spt-h2'>Đề {sel.name}</h2>
                    </span>
                    <span className='spt-exams-meta' style={{display: 'flex', alignItems: 'center', gap: 10}}>
                        <Bar pct={selCount ? selDone / selCount * 100 : 0} color={sel.style.fg}/>{selDone}/{selCount}
                    </span>
                </div>
                {!sel.exams ? <Loading/> : !selExams.length ? <div className='spt-empty'>Môn này chưa có đề thi thử.</div> :
                    selExams.map(e => <div key={e.id} className='spt-exam'>
                        <span className='spt-exam-code'>{examCode(sel.exams!.indexOf(e))}</span>
                        <span className='spt-exam-main'>
                            <b>{striptags(e.name) || 'Đề không tên'}</b>
                            <small>{examMeta(e)}</small>
                        </span>
                        <ExamAction exam={e} onOpen={openExam}/>
                    </div>)}
            </section>}
        </div>

        {/* 403 = student has no graded attempt yet: the board simply stays hidden. */}
        {rows.length > 0 && <aside className='spt-rail'>
            <section className='spt-card spt-rail-card'>
                <div className='spt-sec-head'>
                    <h2>Bảng xếp hạng</h2>
                    <a href='/ranking' onClick={ev => { ev.preventDefault(); navigate('/ranking'); }}>Xem tất cả</a>
                </div>
                {rows.map(r => {
                    const medal = MEDALS[r.rank - 1];
                    const st = subjects[(r.rank - 1) % Math.max(subjects.length, 1)]?.style;
                    return <div key={r.rank + r.name} className={'spt-board-row' + (r.is_me ? ' me' : '')}>
                        <span className='spt-medal' style={medal ? {background: medal[0], color: medal[1]} : undefined}>{r.rank}</span>
                        <span className='spt-av' style={r.is_me ? {background: 'var(--primary)', color: 'var(--on-primary)'} : st ? {background: st.tint, color: st.fg} : undefined}>
                            {initial(r.name)}
                        </span>
                        <b>{r.is_me ? 'Bạn' : r.name}</b>
                        <span>{crit ? formatMetricValue(r.values[crit.name], crit.format) : ''}</span>
                    </div>;
                })}
            </section>
        </aside>}
    </div>;
}
