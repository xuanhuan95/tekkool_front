import {useEffect, useState} from 'react';
import Loading from '../../components/Loading';
import {useNavigate, useParams} from 'react-router-dom';
import {Icon} from 'semantic-ui-react';
import striptags from 'striptags';

import Api from '../../services/api';

import {subjectStyle} from './subjectStyle';
import type {Folder, ExamSummary} from '../../types/exam';


/**
 * Student screen: pick a subject -> pick an exam set (child folder) -> pick an exam.
 *
 * The URL is the source of truth, not state: `/` is the subject list,
 * `/subject/<id>` is one subject. That way F5 does not bounce to the home page, the
 * browser Back button works correctly, and a link straight to one subject can be sent to a student.
 */
export default function SubjectBrowser() {
    const navigate = useNavigate();
    const {subjectId} = useParams();   // undefined = on the home page

    const [subjects, setSubjects] = useState<Folder[] | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);   // the subject's child exam sets
    const [folderId, setFolderId] = useState<string | null>(null); // null = view exams directly in the subject
    const [exams, setExams] = useState<ExamSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // The open subject is taken from the loaded list, no copy kept in state —
    // landing directly on /subject/<id> leaves `subjects` null until loading finishes.
    const subject = subjects && subjectId
        ? subjects.find((f: Folder) => f.id === subjectId)
        : null;

    useEffect(() => {
        Api.get('folder/subjects')
            .then(setSubjects)
            .catch((e: any) => setError(e.error || e.message || 'Không tải được danh sách môn học'));
    }, []);

    // When the subject changes (card click, F5, Back), reload that subject's exam sets + exams.
    useEffect(() => {
        if (!subjectId) return;
        setFolderId(null);
        setFolders([]);
        setExams(null);

        // Having no child folders is not an error — just show the subject's exams.
        Api.get('folder/children?parent=' + subjectId)
            .then(setFolders)
            .catch(() => setFolders([]));

        Api.get('exam/browse?folder=' + subjectId)
            .then(setExams)
            .catch((e: any) => setError(e.error || e.message || 'Không tải được danh sách đề'));
    }, [subjectId]);

    // Picking an exam set within a subject: do NOT change the URL. An exam set is a filter on
    // one page, not a new page — pushing it into the URL would make Back need many presses
    // to leave the subject.
    const pickFolder = (id: string | null) => {
        setFolderId(id);
        setExams(null);
        Api.get('exam/browse?folder=' + (id === null ? subjectId : id))
            .then(setExams)
            .catch((e: any) => setError(e.error || e.message || 'Không tải được danh sách đề'));
    };

    // Go straight into the exam. When turns run out the BE returns 402 and DoExam shows
    // OutOfTurnsModal to block on the spot — do NOT ask beforehand here, because remaining
    // turns belong to the wallet, not to each exam, and asking on every click is a wasted
    // network round trip.
    // ?lam_lai=1: clicking an exam from the list means the student DELIBERATELY wants to
    // take it. Without this flag the BE treats every entry within 15 minutes after submit as
    // "F5 to review the result" and pushes to the old attempt's result screen — the student
    // clicks the exam but cannot get in, and thinks the app is broken.
    const openExam = (exam: ExamSummary) => navigate('/do-exam/' + exam.id + '?lam_lai=1');

    if (error) return <div className='tk'><div className='tk-wrap'>
        <div className='tk-empty'>
            <Icon name='exclamation triangle'/>
            <div className='tk-empty-title'>Có lỗi xảy ra</div>
            <div>{error}</div>
        </div>
    </div></div>;

    if (!subjects) return <div className='tk'><div className='tk-wrap'>
        <Loading/>
    </div></div>;

    // Broken link or deleted subject: subjects finished loading but no id matches.
    // Without catching this case the page hangs on the loading screen forever.
    if (subjectId && !subject) return <div className='tk'><div className='tk-wrap'>
        <div className='tk-empty'>
            <Icon name='question circle outline'/>
            <div className='tk-empty-title'>Không tìm thấy môn này</div>
            <div>Môn có thể đã bị xoá hoặc đổi tên.</div>
            <div style={{marginTop: 12}}>
                <button type='button' className='tk-back' onClick={() => navigate('/')}>
                    <Icon name='arrow left'/> Tất cả môn học
                </button>
            </div>
        </div>
    </div></div>;

    /* ---------- Home page: subject list ---------- */
    if (!subject) return <div className='tk'><div className='tk-wrap'>
        <h1 className='tk-title'>Thi thử SPT</h1>

        {!subjects.length
            ? <div className='tk-empty'>
                <Icon name='folder open outline'/>
                <div className='tk-empty-title'>Chưa có môn học nào</div>
                <div>Giáo viên chưa tạo môn nào. Quay lại sau nhé.</div>
            </div>
            : <div className='tk-grid'>
                {subjects.map(f => {
                    let tone = subjectStyle(f.name);
                    return <button key={f.id} type='button' className='tk-subject'
                                   onClick={() => navigate('/subject/' + f.id)}>
                        <div className='tk-subject-top' style={{background: tone.bg}}>
                            <Icon name={tone.icon} aria-hidden='true'/>
                        </div>
                        <div className='tk-subject-body'>
                            <div className='tk-subject-name'>{f.name}</div>
                            <div className='tk-subject-meta'>Xem đề thi thử</div>
                        </div>
                    </button>;
                })}
            </div>}
    </div></div>;

    /* ---------- Single subject screen: exam sets + exam list ---------- */
    return <div className='tk'><div className='tk-wrap'>
        <button type='button' className='tk-back' onClick={() => navigate('/')}>
            <Icon name='arrow left'/> Tất cả môn học
        </button>

        <h1 className='tk-title'>{subject.name}</h1>
        <p className='tk-sub'>
            {exams ? exams.length + ' đề' : 'Đang tải…'}
            {folders.length ? ' · ' + folders.length + ' bộ đề' : ''}
        </p>

        {/* Exam sets only show when the subject has child folders — a flat subject
            does not need a pointless extra row of buttons. */}
        {folders.length > 0 &&
        <div className='tk-folder-row'>
            <button type='button'
                    className={'tk-chip' + (folderId === null ? ' active' : '')}
                    onClick={() => pickFolder(null)}>
                <Icon name='th'/> Tất cả
            </button>
            {folders.map(f =>
                <button key={f.id} type='button'
                        className={'tk-chip' + (folderId === f.id ? ' active' : '')}
                        onClick={() => pickFolder(f.id)}>
                    <Icon name='folder outline'/> {f.name}
                </button>
            )}
        </div>}

        {/* Overlay rather than replacing: changing exam set keeps the subject name and chip row
            still, only the list area dims. Previously `!exams` returned Loading INSTEAD OF
            the whole block, the block shrank then expanded -> the page jerked on every click. */}
        <div className='tk-load-host'>
        {!exams ? <Loading overlay/>
            : !exams.length
                ? <div className='tk-empty'>
                    <Icon name='file outline'/>
                    <div className='tk-empty-title'>Chưa có đề nào</div>
                    <div>{folderId ? 'Bộ đề này còn trống.' : 'Môn này chưa có đề thi thử.'}</div>
                </div>
                : <div className='tk-exam-list'>
                    {exams.map(exam =>
                        <button key={exam.id} type='button' className='tk-exam'
                                onClick={() => openExam(exam)}>
                            <span className='tk-exam-icon'>
                                <Icon name='file alternate outline' size='large'/>
                            </span>
                            <span className='tk-exam-main'>
                                <span className='tk-exam-name'>
                                    {striptags(exam.name) || 'Đề không tên'}
                                </span>
                                <span className='tk-exam-meta'>
                                    {!!exam.duration && exam.duration > 0 &&
                                    <span><Icon name='clock outline'/> {exam.duration} phút</span>}
                                    <span><Icon name='play circle outline'/> Bắt đầu làm bài</span>
                                </span>
                            </span>
                            {/* Exams no longer have their own price — every exam entry deducts
                                exactly 1 turn from the purchased package. */}
                            <span className='tk-price paid'>1 lượt</span>
                        </button>
                    )}
                </div>}
        </div>
    </div></div>;
}
