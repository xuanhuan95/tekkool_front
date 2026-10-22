import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';

import {Badge, Card, EmptyState, SegmentedControl, Skeleton, SkeletonCard, buttonClass} from '../../components/ui';
import {useInProgress} from '../../queries/inProgress';
import {useSubjectExams, useSubjects} from '../../queries/student';
import type {SubjectSummary} from '../../types/student';
import {LoadError, PageHead, hsPath} from './common';
import {durationLabel, examStatus, filterExams} from './examStatus';
import type {ExamFilter} from './examStatus';
import {plainText} from '../../lib/format';

const FILTERS: {value: ExamFilter; label: string}[] = [
    {value: 'all', label: 'Tất cả'}, {value: 'todo', label: 'Chưa làm'}, {value: 'done', label: 'Đã làm'},
];

function SubjectChips({subjects, value, onChange}: {subjects: SubjectSummary[]; value: string; onChange: (id: string) => void}) {
    return <div role='tablist' aria-label='Môn thi' className='hs-chips'>
        {subjects.map(s => <button key={s.id} type='button' role='tab' id={'mon-' + s.id} aria-controls='hs-exams-panel'
                                   aria-selected={s.id === value} className='hs-chip'
                                   onClick={() => onChange(s.id)}>{s.name}</button>)}
    </div>;
}

function ExamList({subject, filter}: {subject: SubjectSummary; filter: ExamFilter}) {
    const q = useSubjectExams(subject.id);
    const {data: cont} = useInProgress();
    if (q.isPending) return <div className='hs-exams' aria-busy='true'><SkeletonCard/><SkeletonCard/></div>;
    if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} what={'đề môn ' + subject.name}/>;
    const list = filterExams(q.data, filter, cont);
    if (q.data.length === 0)
        return <EmptyState title={'Môn ' + subject.name + ' chưa có đề'} description='Giáo viên đang soạn, bạn chọn môn khác nhé.'/>;
    if (list.length === 0)
        return <EmptyState title={filter === 'done' ? 'Bạn chưa làm đề nào môn này' : 'Bạn đã làm hết đề môn này'}
                           description={filter === 'done' ? 'Chọn một đề trong "Tất cả" để bắt đầu.' : 'Có thể làm lại để cải thiện điểm.'}/>;
    return <ul className='hs-exams'>
        {list.map(e => {
            const st = examStatus(e, cont);
            const name = plainText(e.name) || 'Đề không tên';
            return <Card as='li' key={e.id} className='hs-exam'>
                <div><Badge tone={st.tone}>{st.label}</Badge></div>
                <span className='hs-exam-name'>{name}</span>
                <div className='hs-row'>
                    <span className='hs-meta'>{durationLabel(e.duration)}</span>
                    <Link to={hsPath.exam(e.id, subject.id)} className={buttonClass({variant: 'secondary', size: 'sm'})}
                          aria-label={'Xem đề ' + name}>Xem đề</Link>
                </div>
            </Card>;
        })}
    </ul>;
}

/** HS-DeThi: subject tabs → filter → exam cards. `?mon=<subject id>` keeps the choice across reloads/back. */
export default function ExamsPage() {
    const [params, setParams] = useSearchParams();
    const [filter, setFilter] = useState<ExamFilter>('all');
    const subjects = useSubjects();
    const head = <PageHead title='Đề thi' sub='Chọn môn, rồi chọn đề để xem chi tiết.'/>;

    if (subjects.isPending) return <div className='hs-page'>{head}
        <div className='hs-chips' aria-busy='true'>{[1, 2, 3, 4].map(i => <Skeleton key={i} width={90} height={44} shape='btn'/>)}</div>
        <SkeletonCard/></div>;
    if (subjects.isError) return <div className='hs-page'>{head}
        <LoadError error={subjects.error} onRetry={() => subjects.refetch()} what='danh sách môn'/></div>;
    if (subjects.data.length === 0) return <div className='hs-page'>{head}
        <EmptyState title='Chưa có môn thi nào' description='Giáo viên đang soạn đề, bạn quay lại sau nhé.'/></div>;

    const sel = subjects.data.find(s => s.id === params.get('mon')) || subjects.data[0];
    return <div className='hs-page'>
        {head}
        <SubjectChips subjects={subjects.data} value={sel.id}
                      onChange={id => { setFilter('all'); setParams({mon: id}, {replace: true}); }}/>
        <div className='hs-row'>
            <SegmentedControl aria-label='Lọc đề' items={FILTERS} value={filter} onChange={setFilter}/>
            <span className='hs-meta vt-num'>{sel.exams} đề</span>
        </div>
        <div id='hs-exams-panel' role='tabpanel' aria-labelledby={'mon-' + sel.id}>
            <ExamList key={sel.id} subject={sel} filter={filter}/>
        </div>
    </div>;
}
