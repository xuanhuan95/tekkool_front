import {useState} from 'react';
import type React from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Button, Card, Header, Icon, Input, Segment} from 'semantic-ui-react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import Loading from '../../components/Loading';
import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import {useExams, useFolders, useRefreshExams} from '../../queries/exams';
import type {ExamSummary} from '../../types/exam';
import ExamFile from './ExamFile';
import type {FolderOption} from './ExamFile';
import SubjectBrowser from './SubjectBrowser';

// Bỏ dấu để gõ "toan" vẫn ra "Toán" — giáo viên tìm đề không phải gõ đủ dấu.
const bodau = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Trang chủ giáo viên: thư mục môn ở dạng thẻ, mở một thẻ ra danh sách đề.
 *
 * Bố cục cũ là <List> lồng với hai chữ 'Folder'/'Document' trần làm tiêu đề,
 * mọi đề nằm chung một cột dài. Giờ tách hai tầng rõ: chọn môn -> xem đề trong
 * môn. Đề ngoài thư mục gom riêng cuối trang.
 *
 * ponytail: lọc tìm kiếm chạy ở FE trên danh sách đã tải. Một giáo viên có
 * vài chục đề, gọi API tìm kiếm là thừa một endpoint và một vòng mạng.
 */
export default function Dashboard() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    // group là string id ('teacher' | 'student' | 'visitor').
    const isTeacher = useAuthStore(s => s.user?.group) === 'teacher';

    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    const [q, setQ] = useState('');

    // Học sinh không bao giờ vẽ phần dưới -> `enabled` chặn luôn hai request.
    // Bản cũ phải gọi vô điều kiện vì `auth` chưa chắc sẵn sàng lúc
    // componentDidMount; store zustand có giá trị ngay từ lần vẽ đầu nên
    // không còn cái bẫy đó.
    const {data: exams = []} = useExams(isTeacher);
    const {data: folders} = useFolders(isTeacher);
    const refreshExams = useRefreshExams();

    const {data: folderExams = [], isFetching: loadingExams} = useQuery({
        queryKey: ['exam', 'list', activeFolder],
        queryFn: () => Api.get<ExamSummary[]>('exam/list?folder=' + activeFolder),
        enabled: !!activeFolder,
    });

    const createFolder = async () => {
        const name = prompt('Tên môn / bộ đề mới:');
        if (!name) return;
        await Api.post('folder/create', {name});
        qc.invalidateQueries({queryKey: ['folder', 'list']});
    };

    const moveToFolder = async (examId: string, folderId: string | null) => {
        await Api.post('exam/move_to_folder', {examId, folderId});
        refreshExams();
        qc.invalidateQueries({queryKey: ['exam', 'list', folderId]});
        setActiveFolder(folderId);
    };

    // Tạo đề ngay trong folder: đề mới nằm sẵn trong môn, khỏi phải kéo tay.
    // Quan trọng hơn thế: ImportExam lấy TÊN MÔN từ folder để gắn vào khối
    // ngân hàng — import ngoài thư mục thì subject rỗng, màn rút đề trắng trơn.
    const addExam = (path: string, folderId: string) =>
        navigate(path + '?folder=' + folderId);

    // Bấm lại đúng thư mục đang mở thì đóng lại — không có lối đóng nào khác.
    const openFolder = (folderId: string) =>
        setActiveFolder(activeFolder === folderId ? null : folderId);

    if (!isTeacher) return <SubjectBrowser/>;
    if (!folders) return <Loading/>;

    const folderOptions: FolderOption[] = [
        {text: '(ngoài thư mục)', value: ''},
        ...folders.map(f => ({text: f.name, value: f.id})),
    ];

    const khop = (t?: string) => bodau(t).includes(bodau(q));
    const hienFolder = q ? folders.filter(f => khop(f.name)) : folders;
    const hienNgoai = q ? exams.filter(e => khop(e.name)) : exams;
    const hienTrong = q ? folderExams.filter(e => khop(e.name)) : folderExams;

    // Chưa có gì cả: chỉ một lối đi, đừng bày ba nút.
    if (!folders.length && !exams.length) return <div className='margin'>
        <Segment placeholder>
            <Header icon>
                <Icon name='folder open outline' color='grey'/>
                Chưa có đề nào
                <Header.Subheader>
                    Tạo một thư mục cho môn học trước, rồi thêm đề vào trong đó.
                </Header.Subheader>
            </Header>
            <Button primary icon labelPosition='left' onClick={createFolder}>
                <Icon name='folder'/> Tạo thư mục môn học
            </Button>
        </Segment>
    </div>;

    return <div className='tk-dash'>
        <div className='tk-dash-bar'>
            <Header as='h2' className='tk-dash-title'>
                Kho đề của tôi
                <Header.Subheader>
                    {folders.length} thư mục · {exams.length} đề ngoài thư mục
                </Header.Subheader>
            </Header>
            <Input icon='search' iconPosition='left' placeholder='Tìm đề, tìm môn...'
                   value={q} onChange={(_e, {value}) => setQ(value)}/>
            {/* Lối vào ngân hàng: một màn riêng vì ngân hàng giờ là thực thể
                có tên, không còn là thứ đoán ra từ tên thư mục. */}
            <Link to='/question-bank'>
                <Button basic icon labelPosition='left'>
                    <Icon name='database'/> Ngân hàng câu hỏi
                </Button>
            </Link>
            {/* Gói thi thử: học sinh mua lượt ở đây, không mua từng đề nữa. */}
            <Link to='/packages'>
                <Button basic icon labelPosition='left'>
                    <Icon name='cube'/> Gói thi thử
                </Button>
            </Link>
            <Button primary icon labelPosition='left' onClick={createFolder}>
                <Icon name='plus'/> Thư mục mới
            </Button>
        </div>

        {q && !hienFolder.length && !hienNgoai.length && !hienTrong.length &&
        <Segment placeholder>
            <Header icon>
                <Icon name='search' color='grey'/>
                Không có mục nào khớp “{q}”
            </Header>
        </Segment>}

        <Card.Group itemsPerRow={3} stackable className='tk-folders'>
            {hienFolder.map(f =>
                <Card key={f.id} link
                      className={activeFolder === f.id ? 'tk-folder active' : 'tk-folder'}
                      onClick={() => openFolder(f.id)}>
                    <Card.Content>
                        {/* Icon nằm TRONG Card.Header: để ngoài thì Header là
                            block, icon rơi xuống dòng riêng, thẻ cao gấp đôi. */}
                        <Card.Header>
                            <Icon name={activeFolder === f.id ? 'folder open' : 'folder'}
                                  color={activeFolder === f.id ? 'blue' : 'grey'}/>
                            {f.name}
                        </Card.Header>
                    </Card.Content>
                    {/* Hai lối tạo đề luôn HIỆN, không giấu sau hover: bàn phím
                        và màn cảm ứng không có hover, giấu đi là mất lối vào. */}
                    <Card.Content extra onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Button size='mini' basic
                                onClick={() => addExam('/create-exam', f.id)}>
                            <Icon name='edit outline'/> Tự soạn
                        </Button>
                        <Button size='mini' basic
                                onClick={() => addExam('/import-exam', f.id)}>
                            <Icon name='file word outline'/> Nhập Word
                        </Button>
                    </Card.Content>
                </Card>
            )}
        </Card.Group>

        {activeFolder && <Segment className='tk-exams tk-load-host'>
            <Header as='h4'>
                <Icon name='folder open outline'/>
                <Header.Content>
                    {folders.find(f => f.id === activeFolder)?.name}
                </Header.Content>
            </Header>
            {/* Overlay chứ không thay chỗ: tên thư mục và khung Segment đứng
                yên trong lúc tải, bấm sang thư mục khác không thấy trang
                nhảy. `tk-load-host` cho overlay chỗ bám. */}
            {loadingExams && <Loading overlay/>}
            {!hienTrong.length
                ? !loadingExams && <p className='text-muted'>
                    {q ? 'Không có đề nào khớp trong thư mục này.'
                       : 'Thư mục trống — dùng “Tự soạn” hoặc “Nhập Word” ở thẻ trên.'}
                </p>
                : hienTrong.map(exam =>
                    <div className='tk-exam-row' key={exam.id}>
                        <ExamFile exam={exam} folderOptions={folderOptions}
                                  moveToFolder={moveToFolder}/>
                    </div>)}
        </Segment>}

        {!!hienNgoai.length && <Segment className='tk-exams'>
            <Header as='h4'>
                <Icon name='file outline'/>
                <Header.Content>
                    Đề ngoài thư mục
                    <Header.Subheader>
                        Đề ở đây chưa gắn môn — kéo vào một thư mục để rút được từ ngân hàng.
                    </Header.Subheader>
                </Header.Content>
            </Header>
            {hienNgoai.map(exam =>
                <div className='tk-exam-row' key={exam.id}>
                    <ExamFile exam={exam} folderOptions={folderOptions}
                              moveToFolder={moveToFolder}/>
                </div>)}
        </Segment>}
    </div>;
}
