import {useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';

import {EmptyState, ErrorState, Loading, PageTitle, TextField, buttonClass} from '../../components/ui';
import {errorText} from '../../lib/format';
import {useFolders} from '../../queries/exams';
import {useAuthStore} from '../../stores/authStore';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import StudentHome from '../student/StudentHome';
import {lastWorkedSubject} from './examMeta';
import SubjectDetail from './SubjectDetail';
import {SubjectCards, SubjectNav} from './SubjectList';
import {stripAccents} from './subjectStyle';
import './teacher-home.css';

/**
 * GV "Môn & đề" (canvas APP-teacher-subjects-v2): master–detail. ≥1024: subjects on the left, the open subject's exams
 * on the right; `/` opens the subject the teacher worked on last. Phone: `/` = one card per subject, `/subject/:id` = its exams.
 * Route `/` and `/subject/:subjectId` (the open subject is the URL param, so F5 and Back keep it).
 * ponytail: search runs on the FE over the loaded list; exam/list gives the numbers of every row, so no extra call per exam.
 */
export default function Dashboard() {
    const isTeacher = useAuthStore(s => s.user?.group) === 'teacher';
    return isTeacher ? <TeacherHome/> : <StudentHome/>;
}

function TeacherHome() {
    const {subjectId} = useParams();
    const web = useMediaQuery(DESKTOP);
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const folders = useFolders();

    // Subjects only (root folders); child folders are not shown (Q5: no rename/delete UI yet).
    const subjects = (folders.data || []).filter(f => !f.parent);
    const current = subjects.find(s => s.id === subjectId);

    // `/` on desktop: open the subject holding the most recently updated exam (`last_exam_at` of folder/list, one call).
    const pick = web && !current && !!folders.data;
    useEffect(() => {
        if (!pick) return;
        const best = lastWorkedSubject(subjects);
        if (best) navigate('/subject/' + best.id, {replace: true});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pick]);
    useEffect(() => { setQ(''); }, [subjectId]);

    if (folders.isError) return <ErrorState title='Không tải được kho đề' description={errorText(folders.error, 'Thử lại sau. Đề của cô vẫn an toàn.')}
                                            onRetry={() => folders.refetch()} retrying={folders.isFetching}/>;
    if (!folders.data) return <Loading/>;

    if (!subjects.length) return <div className='vt-th-page'>
        <PageTitle>Môn & đề</PageTitle>
        <EmptyState title='Chưa có môn học nào'
                    description='Môn học do Admin tạo. Khi Admin tạo xong, môn sẽ hiện ở đây để cô soạn đề. Cô báo Admin giúp nhé.'/>
    </div>;

    // Phone, one subject open: just its exams (the "← Môn & đề" link goes back to the cards).
    if (!web && subjectId) return <div className='vt-th-page'>
        {current ? <SubjectDetail subject={current} subjects={subjects} folders={folders.data} q=''/>
            : <EmptyState title='Không tìm thấy môn này' action={<Link to='/' className={buttonClass({variant: 'secondary'})}>Về Môn &amp; đề</Link>}/>}
    </div>;

    const match = (t: string) => stripAccents(t).includes(stripAccents(q));
    const shown = q ? subjects.filter(s => s.id === current?.id || match(s.name)) : subjects;
    return <div className='vt-th-page'>
        <div className='vt-th-head'>
            <PageTitle>Môn & đề</PageTitle>
            <TextField label='Tìm đề, tìm môn' placeholder='Tìm đề, tìm môn' value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        {web
            ? <div className='vt-th-md'>
                <SubjectNav subjects={shown} activeId={current?.id}/>
                {current ? <SubjectDetail subject={current} subjects={subjects} folders={folders.data} q={q}/> : <Loading/>}
            </div>
            : q && !shown.length
                ? <EmptyState title={`Không có môn nào khớp “${q}”`}/>
                : <SubjectCards subjects={shown}/>}
    </div>;
}
