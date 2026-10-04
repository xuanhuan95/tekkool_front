import withRouter from '../../withRouter';
import React, {Component} from 'react';
import Loading from '../../components/Loading';
import {Link} from 'react-router-dom';
import {Button, Card, Header, Icon, Input, Segment} from 'semantic-ui-react';
import {connectGlobalState} from "../../stateUtils";
import Api from '../../services/api';
import ExamFile from './ExamFile';
import SubjectBrowser from './SubjectBrowser';

// Bỏ dấu để gõ "toan" vẫn ra "Toán" — giáo viên tìm đề không phải gõ đủ dấu.
const bodau = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
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
class Dashboard extends Component {
    state = {
        folders: null,      // null = đang tải, [] = chưa có thư mục nào
        activeFolder: null,
        folderExams: [],
        loadingExams: false,
        q: '',
    };

    componentDidMount = async () => {
        // ponytail: KHÔNG chặn theo isTeacher() ở đây. connectGlobalState chỉ
        // đăng ký watcher khi globalState được đọc trong render, nên lúc
        // componentDidMount chạy `auth` có thể chưa sẵn sàng -> isTeacher()
        // trả false và GIÁO VIÊN bị return sớm, folder không bao giờ load
        // (đúng lỗi "Folder/Document rỗng"). Cứ gọi API: học sinh nhận []
        // là xong, rẻ hơn nhiều so với một màn hình trắng.
        let exams = await Api.get('exam/list');
        let folders = await Api.get('folder/list');

        this.setGlobalState({exams});
        this.setState({folders});
    };

    // group là string id ('teacher' | 'student' | 'visitor').
    isTeacher = () => {
        let {auth} = this.globalState;
        return !!(auth && auth.user && auth.user.group === 'teacher');
    };

    // Tạo đề ngay trong folder: đề mới nằm sẵn trong môn, khỏi phải kéo tay.
    // Quan trọng hơn thế: ImportExam lấy TÊN MÔN từ folder để gắn vào khối
    // ngân hàng — import ngoài thư mục thì subject rỗng, màn rút đề trắng trơn.
    addExam = (path, folderId) => this.props.history.push(path + '?folder=' + folderId);

    createFolder = async () => {
        let name = prompt('Tên môn / bộ đề mới:');
        if (!name) return;

        await Api.post('folder/create', {name});
        this.setState({folders: await Api.get('folder/list')});
    };

    moveToFolder = async (examId, folderId) => {
        await Api.post('exam/move_to_folder', {examId, folderId});
        this.setGlobalState({exams: await Api.get('exam/list')});
        this.openFolder(folderId);
    };

    // Bấm lại đúng thư mục đang mở thì đóng lại — không có lối đóng nào khác.
    openFolder = async (folderId) => {
        if (this.state.activeFolder === folderId)
            return this.setState({activeFolder: null, folderExams: []});

        this.setState({activeFolder: folderId, folderExams: [], loadingExams: true});
        let exams = await Api.get('exam/list?folder=' + folderId);
        // Bấm nhanh sang thư mục khác trong lúc đang tải -> bỏ kết quả cũ,
        // nếu không đề của môn trước hiện dưới tên môn sau.
        if (this.state.activeFolder !== folderId) return;
        this.setState({folderExams: exams, loadingExams: false});
    };

    render() {
        if (!this.isTeacher()) return <SubjectBrowser/>;

        let {folders, activeFolder, folderExams, loadingExams, q} = this.state;
        let {exams} = this.globalState;
        if (!exams) exams = [];

        if (!folders) return <Loading/>;

        let folderOptions = folders.map(f => ({text: f.name, value: f.id}));
        folderOptions.unshift({text: '(ngoài thư mục)', value: null});

        let khop = t => bodau(t).includes(bodau(q));
        let hienFolder = q ? folders.filter(f => khop(f.name)) : folders;
        let hienNgoai = q ? exams.filter(e => khop(e.name)) : exams;
        let hienTrong = q ? folderExams.filter(e => khop(e.name)) : folderExams;

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
                <Button primary icon labelPosition='left' onClick={this.createFolder}>
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
                       value={q} onChange={(e, {value}) => this.setState({q: value})}/>
                {/* Loi vao ngan hang: mot man rieng vi ngan hang gio la thuc the
                    co ten, khong con la thu doan ra tu ten thu muc. */}
                <Link to='/question-bank'>
                    <Button basic icon labelPosition='left'>
                        <Icon name='database'/> Ngân hàng câu hỏi
                    </Button>
                </Link>
                {/* Goi thi thu: hoc sinh mua luot o day, khong mua tung de nua. */}
                <Link to='/packages'>
                    <Button basic icon labelPosition='left'>
                        <Icon name='cube'/> Gói thi thử
                    </Button>
                </Link>
                <Button primary icon labelPosition='left' onClick={this.createFolder}>
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
                          onClick={() => this.openFolder(f.id)}>
                        <Card.Content>
                            {/* Icon nam TRONG Card.Header: de ngoai thi Header la
                                block, icon roi xuong dong rieng, the cao gap doi. */}
                            <Card.Header>
                                <Icon name={activeFolder === f.id ? 'folder open' : 'folder'}
                                      color={activeFolder === f.id ? 'blue' : 'grey'}/>
                                {f.name}
                            </Card.Header>
                        </Card.Content>
                        {/* Hai lối tạo đề luôn HIỆN, không giấu sau hover: bàn phím
                            và màn cảm ứng không có hover, giấu đi là mất lối vào. */}
                        <Card.Content extra onClick={e => e.stopPropagation()}>
                            <Button size='mini' basic
                                    onClick={() => this.addExam('/create-exam', f.id)}>
                                <Icon name='edit outline'/> Tự soạn
                            </Button>
                            <Button size='mini' basic
                                    onClick={() => this.addExam('/import-exam', f.id)}>
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
                        {(folders.find(f => f.id === activeFolder) || {}).name}
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
                                      moveToFolder={this.moveToFolder}/>
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
                                  moveToFolder={this.moveToFolder}/>
                    </div>)}
            </Segment>}
        </div>
    }
}

export default withRouter(connectGlobalState(Dashboard));
