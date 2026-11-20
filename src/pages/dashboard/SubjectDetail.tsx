import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';

import {Badge, Button, EmptyState, ErrorState, FilterChip, Loading, Refreshable, StatusBadge, buttonClass, notify} from '../../components/ui';
import {IconBankRows, IconEdit, IconWordDoc} from '../../components/ui/icons';
import {errorText} from '../../lib/format';
import {useSubjectExams} from '../../queries/exams';
import type {ExamSource, ExamSummary, Folder} from '../../types/exam';
import {BankAlert} from '../exam-creation/ImportAlerts';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {CreateMenu, CreateWays} from './CreateMenu';
import ExamMenu from './ExamMenu';
import {SOURCE_LABEL, examName, isPublished, statsText, whenText} from './examMeta';
import {stripAccents} from './subjectStyle';
import {examCountText} from './SubjectList';
import {useExamActions} from './useExamActions';
import type {ExamRef} from './useExamActions';

type Filter = 'all' | 'draft' | 'published';
/** Router state of "just created": ids of the new drafts (+ the name when it is a single exam); `toasted` once the toast was shown (survives F5). */
export type CreatedState = {created?: string[]; createdName?: string; toasted?: boolean};

export const SOURCE_ICON: Record<ExamSource, ReactNode> = {web: <IconEdit size={20}/>, word: <IconWordDoc/>, bank: <IconBankRows/>};

/** What the exam row says about how it was made (the same words on the exam page). */
export function SourceBadge({source}: {source?: ExamSource | null}) {
    return source ? <Badge tone='title'>{SOURCE_LABEL[source]}</Badge> : null;
}

const asRef = (e: ExamSummary, from: string): ExamRef => ({id: e.id, name: e.name, status: e.status, has_submissions: e.has_submissions, submissions: e.submission_count, from});

/**
 * Right half of "Môn & đề": the open subject, its exams as rows (how it was made, status, numbers, main action, ⋯).
 * Route `/subject/:subjectId` (F5 and Back keep the subject). `q` filters the rows by name.
 */
export default function SubjectDetail({subject, subjects, folders, q}: {subject: Folder; subjects: Folder[]; folders: Folder[]; q: string}) {
    const web = useMediaQuery(DESKTOP);
    const navigate = useNavigate();
    const {pathname, state} = useLocation();
    const landed = state as CreatedState | null;
    const {data, isError, error, isFetching, refetch} = useSubjectExams(subject.id, folders);
    const actions = useExamActions(subjects);
    const [filter, setFilter] = useState<Filter>('all');
    const created = landed?.created;
    const fresh = (e: ExamSummary) => !!created?.includes(e.id);

    // Toast "Đã tạo … (Nháp) · Xem đề" once: marked in the history entry so F5 / Back do not repeat it.
    const toasted = useRef(false);
    useEffect(() => {
        if (!created?.length || landed?.toasted || toasted.current || !data) return;
        toasted.current = true;
        if (created.length === 1) {
            const name = landed?.createdName || examName(data.find(e => e.id === created[0]) || {name: ''});
            notify.success(`Đã tạo “${name}” (Nháp)`, undefined, {label: 'Xem đề', to: '/exam/' + created[0]});
        } else notify.success(`Đã tạo ${created.length} đề nháp trong ${subject.name}`, 'Các đề mới nằm đầu danh sách, đánh dấu “Mới tạo”.');
        navigate(pathname, {replace: true, state: {...landed, toasted: true}});
    }, [created, landed, data, navigate, pathname, subject.name]);

    const all = data || [];
    const matched = q ? all.filter(e => stripAccents(examName(e)).includes(stripAccents(q))) : all;
    const has = (f: Filter, e: ExamSummary) => f === 'all' || (f === 'draft') === !isPublished(e);
    const rows = matched.filter(e => has(filter, e)).sort((a, b) => Number(fresh(b)) - Number(fresh(a)));   // stable: the rest keep their order
    const count = (f: Filter) => matched.filter(e => has(f, e)).length;
    const meta = examCountText(subject);

    return <section className='vt-th-detail' aria-label={'Đề của môn ' + subject.name} aria-busy={isFetching}>
        {!web && <Link to='/' className={buttonClass({variant: 'ghost'}) + ' vt-th-back'}>← Môn &amp; đề</Link>}
        <div className='vt-th-dhead'>
            <h2>{subject.name}</h2>
            <span className='vt-th-dmeta'>{[meta, 'học sinh chỉ thấy đề đã xuất bản'].filter(Boolean).join(' · ')}</span>
            <CreateMenu subject={subject}/>
        </div>
        {subject.hidden && <BankAlert tone='sun' title='Môn đang ẩn — học sinh không thấy đề của môn này'>
            Admin đã ẩn môn {subject.name}. Bạn vẫn sửa và làm thử được; khi Admin bật lại, đề đã xuất bản hiện lại cho học sinh.</BankAlert>}

        {isError ? <ErrorState title='Không tải được kho đề' description={errorText(error, 'Thử lại sau. Đề của cô vẫn an toàn.')}
                               onRetry={() => refetch()} retrying={isFetching}/>
            : !data ? <Loading/>
            : !all.length ? <CreateWays subject={subject}/>
            : <>
                <div className='vt-th-filters' role='group' aria-label='Lọc đề'>
                    {([['all', 'Tất cả'], ['draft', 'Nháp'], ['published', 'Đã xuất bản']] as const).map(([k, label]) =>
                        <FilterChip key={k} selected={filter === k} onChange={() => setFilter(k)}>{label} · {count(k)}</FilterChip>)}
                </div>
                {!rows.length
                    ? <EmptyState title={q ? `Không có đề nào khớp “${q}”` : filter === 'draft' ? 'Chưa có đề nháp nào' : 'Chưa có đề nào xuất bản'}/>
                    : <Refreshable><ul className='vt-th-exams'>
                        {rows.map(e => <ExamRow key={e.id} exam={e} subjectId={subject.id} fresh={fresh(e)} actions={actions}/>)}
                    </ul></Refreshable>}
            </>}
        {actions.dialogs}
    </section>;
}

function ExamRow({exam: e, subjectId, fresh, actions}: {exam: ExamSummary; subjectId: string; fresh: boolean; actions: ReturnType<typeof useExamActions>}) {
    const n = e.submission_count;
    const when = whenText(e.updated_at);
    const line2: ReactNode[] = [
        e.source === 'bank' && e.bank_names?.length ? <>ngân hàng <b>{e.bank_names.join(', ')}</b> · mỗi học sinh một đề khác</> : null,
        statsText(e),
        when && 'cập nhật ' + when,
        n == null ? (e.has_submissions ? 'đã có bài nộp' : null) : n ? <b>{n} bài nộp</b> : 'chưa có bài nộp',
    ].filter(Boolean);

    return <li className={'vt-card vt-th-exam' + (fresh ? ' is-new' : '')}>
        <span className={'vt-th-ic' + (e.source === 'bank' ? ' vt-th-ic--bank' : '')} title={e.source ? SOURCE_LABEL[e.source] : undefined}>
            {e.source && SOURCE_ICON[e.source]}</span>
        <div className='vt-th-line1'>
            <Link className='vt-th-name' to={'/exam/' + e.id}>{examName(e)}</Link>
            {fresh && <Badge tone='ok'>Mới tạo</Badge>}
            <StatusBadge status={isPublished(e) ? 'published' : 'draft'}/>
            <SourceBadge source={e.source}/>
        </div>
        <div className='vt-th-line2'>{line2.map((x, i) => <span key={i}>{x}</span>)}</div>
        <div className='vt-th-acts'>
            {!isPublished(e) && <Button variant='primary' size='sm' disabled={actions.busy} onClick={() => actions.publish(asRef(e, subjectId))}>Xuất bản</Button>}
            <Link to={'/edit-exam/' + e.id} className={buttonClass({variant: 'secondary', size: 'sm'})}>Sửa</Link>
            <Link to={`/do-exam/${e.id}?lam_lai=1`} className={buttonClass({variant: 'ghost', size: 'sm'})}>Làm thử</Link>
            <ExamMenu exam={asRef(e, subjectId)} submissions={n} actions={actions}/>
        </div>
    </li>;
}
