import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Icon, Loader} from 'semantic-ui-react';
import striptags from 'striptags';

import Api from '../../services/api';

// Icon + màu nhận theo TÊN môn, không theo thứ tự trong danh sách — giáo viên
// thêm môn mới đứng trước là mọi môn sau đó đổi icon, Toán thành chiếc lá.
//
// Tên icon đã đối chiếu với semantic-ui-css/components/icon.css: gõ sai tên
// thì Semantic render ô trống chứ không báo lỗi. 'atom', 'microscope',
// 'landmark' KHÔNG có trong bộ này — đừng thay vào.
const SUBJECTS = [
    {key: 'van',     icon: 'pencil alternate', bg: 'linear-gradient(135deg,#f97316,#ea580c)', match: ['van', 'ngu van']},
    {key: 'anh',     icon: 'language',   bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', match: ['tieng anh', 'anh', 'english', 'ngoai ngu']},
    {key: 'toan',    icon: 'calculator', bg: 'linear-gradient(135deg,#6366f1,#4338ca)', match: ['toan']},
    {key: 'ly',      icon: 'magnet',     bg: 'linear-gradient(135deg,#f59e0b,#b45309)', match: ['ly', 'vat ly']},
    {key: 'hoa',     icon: 'flask',      bg: 'linear-gradient(135deg,#14b8a6,#0f766e)', match: ['hoa', 'hoa hoc']},
    {key: 'sinh',    icon: 'dna',        bg: 'linear-gradient(135deg,#16a34a,#15803d)', match: ['sinh', 'sinh hoc']},
    {key: 'su',      icon: 'hourglass half', bg: 'linear-gradient(135deg,#b45309,#78350f)', match: ['lich su', 'su']},
    {key: 'dia',     icon: 'map outline', bg: 'linear-gradient(135deg,#0891b2,#155e75)', match: ['dia ly', 'dia li', 'dia']},
    {key: 'gdcd',    icon: 'balance scale', bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', match: ['gdcd', 'giao duc cong dan', 'cong dan']},
    {key: 'tin',     icon: 'laptop',     bg: 'linear-gradient(135deg,#64748b,#334155)', match: ['tin hoc', 'tin']},
];

// Môn lạ (giáo viên tự đặt tên) vẫn phải có icon — không để trống.
const FALLBACK = {icon: 'folder open', bg: 'linear-gradient(135deg,#94a3b8,#475569)'};

// Bỏ dấu để 'Hoá' và 'Hóa', 'Địa lý' và 'Dia ly' cùng khớp một mục.
// ponytail: normalize('NFD') + xoá dấu thanh là cách stdlib, không cần thư viện
// bỏ dấu tiếng Việt. Riêng 'đ' không phải ký tự có dấu tổ hợp nên xử riêng.
function bodau(s) {
    return (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().trim();
}

function subjectStyle(name) {
    const n = bodau(name);
    // Khớp cả cụm trước, rồi mới khớp tiền tố — 'Lịch sử' phải ra 'su' chứ
    // không dính vào 'sinh'. So bằng ranh giới từ, không dùng includes().
    for (const s of SUBJECTS) {
        if (s.match.some(m => n === m)) return s;
    }
    for (const s of SUBJECTS) {
        if (s.match.some(m => n.startsWith(m + ' ') || n.endsWith(' ' + m))) return s;
    }
    return FALLBACK;
}


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

    const [subjects, setSubjects] = useState(null);
    const [folders, setFolders] = useState([]);   // bộ đề con của môn
    const [folderId, setFolderId] = useState(null); // null = xem đề ngay trong môn
    const [exams, setExams] = useState(null);
    const [error, setError] = useState(null);

    // Môn đang mở lấy từ danh sách đã tải, không giữ bản sao trong state —
    // vào thẳng /subject/<id> thì `subjects` còn null, chờ tải xong mới có.
    const subject = subjects && subjectId
        ? subjects.find(f => f.id === subjectId)
        : null;

    useEffect(() => {
        Api.get('folder/subjects')
            .then(setSubjects)
            .catch(e => setError(e.error || e.message || 'Không tải được danh sách môn học'));
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
            .catch(e => setError(e.error || e.message || 'Không tải được danh sách đề'));
    }, [subjectId]);

    // Chọn bộ đề trong môn: KHÔNG đổi URL. Bộ đề là bộ lọc trong một trang,
    // không phải trang mới — đẩy vào URL nữa thì Back phải bấm nhiều lần mới
    // ra khỏi môn.
    const pickFolder = (id) => {
        setFolderId(id);
        setExams(null);
        Api.get('exam/browse?folder=' + (id === null ? subjectId : id))
            .then(setExams)
            .catch(e => setError(e.error || e.message || 'Không tải được danh sách đề'));
    };

    // Vào thẳng đề. Hết lượt thì BE trả 402 và DoExam tự đẩy sang trang mua
    // gói — KHÔNG chặn ở đây, vì số lượt còn lại là chuyện của ví chứ không
    // phải của từng đề, hỏi trước mỗi lần bấm là thừa một vòng mạng.
    const openExam = (exam) => navigate('/do-exam/' + exam.id);

    if (error) return <div className='tk'><div className='tk-wrap'>
        <div className='tk-empty'>
            <Icon name='exclamation triangle'/>
            <div className='tk-empty-title'>Có lỗi xảy ra</div>
            <div>{error}</div>
        </div>
    </div></div>;

    if (!subjects) return <div className='tk'><div className='tk-wrap'>
        <Loader active inline='centered'/>
    </div></div>;

    // Link hỏng hoặc môn đã bị xoá: subjects tải xong rồi mà không khớp id nào.
    // Không bắt được ca này thì trang treo Loader vĩnh viễn.
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

        {!exams ? <Loader active inline='centered'/>
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
                                    {exam.duration > 0 &&
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
    </div></div>;
}
