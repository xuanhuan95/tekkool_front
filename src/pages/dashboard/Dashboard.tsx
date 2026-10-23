import {useState} from 'react';
import type React from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Button, Card, Dropdown, Header, Icon, Input, Segment} from 'semantic-ui-react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import Loading from '../../components/Loading';
import Api from '../../services/api';
import {useAuthStore} from '../../stores/authStore';
import {useExams, useFolders, useRefreshExams} from '../../queries/exams';
import type {ExamSummary} from '../../types/exam';
import ExamFile from './ExamFile';
import type {FolderOption} from './ExamFile';
import StudentHome from '../student/StudentHome';

// Strip accents so typing "toan" still matches "Toán" — teachers searching for exams need not type full accents.
const stripAccents = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Teacher home: subject folders as cards, open a card to get the exam list.
 *
 * The old layout was a nested <List> with bare 'Folder'/'Document' words as headings,
 * with every exam in one long column. Now two clear levels: pick a subject -> see the
 * exams in it. Exams outside any folder are grouped separately at the bottom.
 *
 * ponytail: search filtering runs on the FE over the already-loaded list. A teacher has
 * a few dozen exams, so calling a search API is an extra endpoint and a network round trip.
 */
export default function Dashboard() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    // group is a string id ('teacher' | 'student' | 'visitor').
    const isTeacher = useAuthStore(s => s.user?.group) === 'teacher';

    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    const [q, setQ] = useState('');

    // Students never render the part below -> `enabled` blocks both requests.
    // The old version had to call unconditionally because `auth` might not be ready at
    // componentDidMount; the zustand store has a value from the first render so
    // that trap is gone.
    const {data: exams = []} = useExams(isTeacher);
    const {data: folders} = useFolders(isTeacher);
    const refreshExams = useRefreshExams();

    const {data: folderExams = [], isFetching: loadingExams} = useQuery({
        queryKey: ['exam', 'list', activeFolder],
        queryFn: () => Api.get<ExamSummary[]>('exam/list?folder=' + activeFolder),
        enabled: !!activeFolder,
    });

    const moveToFolder = async (examId: string, folderId: string | null) => {
        await Api.post('exam/move_to_folder', {examId, folderId});
        refreshExams();
        qc.invalidateQueries({queryKey: ['exam', 'list', folderId]});
        setActiveFolder(folderId);
    };

    // Create an exam right inside the folder: the new exam already sits in the subject, no manual drag.
    // More importantly: ImportExam takes the SUBJECT NAME from the folder to attach to the
    // bank block — importing outside a folder leaves subject empty and the draw screen blank.
    const addExam = (path: string, folderId: string) =>
        navigate(path + '?folder=' + folderId);

    // Clicking the folder that is already open closes it — there is no other way to close.
    const openFolder = (folderId: string) =>
        setActiveFolder(activeFolder === folderId ? null : folderId);

    if (!isTeacher) return <StudentHome/>;
    if (!folders) return <Loading/>;

    const folderOptions: FolderOption[] = [
        {text: '(ngoài thư mục)', value: ''},
        ...folders.map(f => ({text: f.name, value: f.id})),
    ];

    const matches = (t?: string) => stripAccents(t).includes(stripAccents(q));
    const shownFolders = q ? folders.filter(f => matches(f.name)) : folders;
    const shownLoose = q ? exams.filter(e => matches(e.name)) : exams;
    const shownInFolder = q ? folderExams.filter(e => matches(e.name)) : folderExams;

    // Nothing yet: a single path, don't lay out three buttons.
    if (!folders.length && !exams.length) return <div className='margin'>
        <Segment placeholder>
            <Header icon>
                <Icon name='folder open outline' color='grey'/>
                Chưa có môn học
                <Header.Subheader>
                    Chưa có môn học — liên hệ Admin để thêm môn.
                </Header.Subheader>
            </Header>
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
            {/* Entry to the bank: a separate screen because a bank is now a named
                entity, no longer something guessed from the folder name. */}
            <Link to='/question-bank'>
                <Button basic icon labelPosition='left'>
                    <Icon name='database'/> Ngân hàng câu hỏi
                </Button>
            </Link>
        </div>

        {q && !shownFolders.length && !shownLoose.length && !shownInFolder.length &&
        <Segment placeholder>
            <Header icon>
                <Icon name='search' color='grey'/>
                Không có mục nào khớp “{q}”
            </Header>
        </Segment>}

        <Card.Group itemsPerRow={3} stackable className='tk-folders'>
            {shownFolders.map(f =>
                <Card key={f.id} link
                      className={activeFolder === f.id ? 'tk-folder active' : 'tk-folder'}
                      onClick={() => openFolder(f.id)}>
                    <Card.Content>
                        {/* Icon sits INSIDE Card.Header: outside, Header is a
                            block, the icon drops to its own line and the card doubles in height. */}
                        <Card.Header>
                            <Icon name={activeFolder === f.id ? 'folder open' : 'folder'}
                                  color={activeFolder === f.id ? 'blue' : 'grey'}/>
                            {f.name}
                        </Card.Header>
                    </Card.Content>
                    {/* The "Create exam" button is always VISIBLE, not hidden behind hover: keyboards
                        and touch screens have no hover, hiding it loses the entry point. */}
                    <Card.Content extra onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Dropdown button className='mini basic icon tk-add-exam'
                                  labeled icon='plus' text='Tạo đề'>
                            <Dropdown.Menu>
                                <Dropdown.Item icon='edit outline' text='Tự soạn'
                                               onClick={() => addExam('/create-exam', f.id)}/>
                                <Dropdown.Item icon='file word outline' text='Nhập Word'
                                               onClick={() => addExam('/import-exam', f.id)}/>
                                <Dropdown.Item icon='random' text='Từ ngân hàng đề'
                                               onClick={() => addExam('/create-from-bank', f.id)}/>
                            </Dropdown.Menu>
                        </Dropdown>
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
            {/* Overlay rather than replacing: the folder name and Segment frame stay
                still while loading, switching to another folder makes no page
                jump. `tk-load-host` gives the overlay something to anchor to. */}
            {loadingExams && <Loading overlay/>}
            {!shownInFolder.length
                ? !loadingExams && <p className='text-muted'>
                    {q ? 'Không có đề nào khớp trong thư mục này.'
                       : 'Thư mục trống — bấm “Tạo đề” ở thẻ trên.'}
                </p>
                : shownInFolder.map(exam =>
                    <div className='tk-exam-row' key={exam.id}>
                        <ExamFile exam={exam} folderOptions={folderOptions}
                                  moveToFolder={moveToFolder}/>
                    </div>)}
        </Segment>}

        {!!shownLoose.length && <Segment className='tk-exams'>
            <Header as='h4'>
                <Icon name='file outline'/>
                <Header.Content>
                    Đề ngoài thư mục
                    <Header.Subheader>
                        Đề ở đây chưa gắn môn — kéo vào một thư mục để rút được từ ngân hàng.
                    </Header.Subheader>
                </Header.Content>
            </Header>
            {shownLoose.map(exam =>
                <div className='tk-exam-row' key={exam.id}>
                    <ExamFile exam={exam} folderOptions={folderOptions}
                              moveToFolder={moveToFolder}/>
                </div>)}
        </Segment>}
    </div>;
}
