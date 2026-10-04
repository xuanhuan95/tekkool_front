import {useEffect, useState} from 'react';
import Loading from '../../components/Loading';
import {useNavigate, useParams} from 'react-router-dom';
import {Icon} from 'semantic-ui-react';
import striptags from 'striptags';

import Api from '../../services/api';

import {subjectStyle} from './subjectStyle';
import type {Folder, ExamSummary} from '../../types/exam';


/**
 * Màn hình học sinh: chọn môn -> chọn bộ đề (folder con) -> chọn đề.
 *
 * URL là nguồn sự thật, không phải state: `/` là danh sách môn,
 * `/subject/<id>` là một môn. Nhờ vậy F5 không văng về trang chủ, nút Back
 * của trình duyệt chạy đúng, và gửi được link thẳng một môn cho học sinh.
 */
export default function SubjectBrowser() {
    const navigate = useNavigate();
    const {subjectId} = useParams();   // undefined = đang ở trang chủ

    const [subjects, setSubjects] = useState<Folder[] | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);   // bộ đề con của môn
    const [folderId, setFolderId] = useState<string | null>(null); // null = xem đề ngay trong môn
    const [exams, setExams] = useState<ExamSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Môn đang mở lấy từ danh sách đã tải, không giữ bản sao trong state —
    // vào thẳng /subject/<id> thì `subjects` còn null, chờ tải xong mới có.
    const subject = subjects && subjectId
        ? subjects.find((f: Folder) => f.id === subjectId)
        : null;

    useEffect(() => {
        Api.get('folder/subjects')
            .then(setSubjects)
            .catch((e: any) => setError(e.error || e.message || 'Không tải được danh sách môn học'));
    }, []);

    // Đổi môn (bấm thẻ, F5, Back) thì tải lại bộ đề + đề của môn đó.
    useEffect(() => {
        if (!subjectId) return;
        setFolderId(null);
        setFolders([]);
        setExams(null);

        // Không có folder con không phải lỗi — cứ hiện đề của môn.
        Api.get('folder/children?parent=' + subjectId)
            .then(setFolders)
            .catch(() => setFolders([]));

        Api.get('exam/browse?folder=' + subjectId)
            .then(setExams)
            .catch((e: any) => setError(e.error || e.message || 'Không tải được danh sách đề'));
    }, [subjectId]);

    // Chọn bộ đề trong môn: KHÔNG đổi URL. Bộ đề là bộ lọc trong một trang,
    // không phải trang mới — đẩy vào URL nữa thì Back phải bấm nhiều lần mới
    // ra khỏi môn.
    const pickFolder = (id: string | null) => {
        setFolderId(id);
        setExams(null);
        Api.get('exam/browse?folder=' + (id === null ? subjectId : id))
            .then(setExams)
            .catch((e: any) => setError(e.error || e.message || 'Không tải được danh sách đề'));
    };

    // Vào thẳng đề. Hết lượt thì BE trả 402 và DoExam bật HetLuotModal chặn
    // tại chỗ — KHÔNG hỏi trước ở đây, vì số lượt còn lại là chuyện của ví
    // chứ không phải của từng đề, hỏi mỗi lần bấm là thừa một vòng mạng.
    const openExam = (exam: ExamSummary) => navigate('/do-exam/' + exam.id);

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

    // Link hỏng hoặc môn đã bị xoá: subjects tải xong rồi mà không khớp id nào.
    // Không bắt được ca này thì trang treo màn đang tải vĩnh viễn.
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

    /* ---------- Trang chủ: danh sách môn ---------- */
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

    /* ---------- Màn một môn: bộ đề + danh sách đề ---------- */
    return <div className='tk'><div className='tk-wrap'>
        <button type='button' className='tk-back' onClick={() => navigate('/')}>
            <Icon name='arrow left'/> Tất cả môn học
        </button>

        <h1 className='tk-title'>{subject.name}</h1>
        <p className='tk-sub'>
            {exams ? exams.length + ' đề' : 'Đang tải…'}
            {folders.length ? ' · ' + folders.length + ' bộ đề' : ''}
        </p>

        {/* Bộ đề chỉ hiện khi môn có folder con — môn phẳng thì khỏi thêm
            một hàng nút vô nghĩa. */}
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

        {/* Overlay chứ không thay chỗ: đổi bộ đề thì tên môn và hàng chip đứng
            yên, chỉ vùng danh sách mờ đi. Trước đây `!exams` trả Loading THAY
            cho cả khối, khối co lại rồi bung ra -> trang giật mỗi lần bấm. */}
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
                            {/* Đề không có giá riêng nữa — vào thi nào cũng trừ
                                đúng 1 lượt trong gói đã mua. */}
                            <span className='tk-price paid'>1 lượt</span>
                        </button>
                    )}
                </div>}
        </div>
    </div></div>;
}
