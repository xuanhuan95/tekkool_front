import withRouter from '../../withRouter';
import React, {Component} from 'react';
import {Button, Icon, Menu, Input, Dropdown, List, Popup} from 'semantic-ui-react';
import {connectGlobalState} from "../../stateUtils";
import {Link} from 'react-router-dom';
import Api from '../../services/api';
import ExamFile from './ExamFile';
import SubjectBrowser from './SubjectBrowser';


class Dashboard extends Component {
    state = {
        folders: [],
        activeFolder: null,
        folderExams: [],
        nextUrl: '',
    };


    examCreation = () => {
        this.props.history.push('/create-exam');
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

        // get params next url
        let params = new URLSearchParams(this.props.location.search);
        let nextUrl = params.get('nextUrl');

        this.setGlobalState({exams});
        this.setState({folders, nextUrl});
    };

    // group là string id ('teacher' | 'student' | 'visitor').
    isTeacher = () => {
        let {auth} = this.globalState;
        return !!(auth && auth.user && auth.user.group === 'teacher');
    };

    // Tạo đề ngay trong folder: đề mới nằm sẵn trong môn, khỏi phải kéo tay.
    addExam = (path, folderId) => this.props.history.push(path + '?folder=' + folderId);

    createFolder = async () => {
        let name = prompt('Your folder name');
        if (!name) return;

        await Api.post('folder/create', {name});

        let folders = await Api.get('folder/list');
        this.setState({folders});
    };

    moveToFolder = async (examId, folderId) => {
        await Api.post('exam/move_to_folder', {examId, folderId});
        let exams = await Api.get('exam/list');

        this.setGlobalState({exams});
        this.setActiveFolder(folderId);
    };

    isActiveFolder = (folderId) => {
        let {activeFolder} = this.state;
        return activeFolder === folderId;
    };

    setActiveFolder = async (folderId) => {
        let exams = await Api.get('exam/list?folder=' + folderId);
        this.setState({activeFolder: folderId, folderExams: exams})
    };

    render() {
        let {folders, folderExams} = this.state;
        let folderOptions = folders.map(f => ({text: f.name, value: f.id}));
        folderOptions.unshift({text: '---root---', value: null});
        let {exams} = this.globalState;
        if (!exams) exams = [];

        if (!this.isTeacher()) return <SubjectBrowser/>;

        return <div id='ExamCreation' className='margin'>
            {/* Chi con 2 nut tao de. `pointing` da bo: khong con muc nao de tro. */}
            <Menu id='leftMenu' vertical>
                <Menu.Item>
                    <Link to='/create-exam'>
                        <Button fluid primary>Create Exam</Button>
                    </Link>
                    <Link to='/import-exam'>
                        <Button fluid className='margin-top'>
                            <Icon name='file word outline'/> Nhập từ Word
                        </Button>
                    </Link>
                    <Link to='/draw-exam'>
                        <Button fluid className='margin-top'>
                            <Icon name='random'/> Rút từ ngân hàng
                        </Button>
                    </Link>
                </Menu.Item>
            </Menu>

            <div id='content' className='margin-top'>
                {/* ponytail: giữ nguyên size="medium" của bản 2018 dù semantic-ui
                    không có size này (chỉ mini/small/large/big/huge/massive).
                    Nó bị bỏ qua khi render -> vô hại, chỉ warning trong console. */}
                <Input style={{float: 'right'}}
                       size="medium"
                       icon={{name: 'search', circular: true, link: true}}
                       placeholder='Search...'
                />

                <Button onClick={this.createFolder}>Create folder</Button>

                <List className='margin-top' verticalAlign='middle'>
                    Folder
                    {folders.map(folder =>
                        <List.Item onClick={() => this.setActiveFolder(folder.id)}
                                   key={folder.id}
                                   className='cursor'
                        >
                            <List.Icon size='big'
                                       name={this.isActiveFolder(folder.id) ? 'folder open outline' : 'folder outline'}/>
                            <List.Content>
                                <List.Header as='h2'>
                                    {folder.name}
                                    {/* ponytail: stopPropagation bắt buộc — List.Item cha có
                                        onClick mở/đóng folder, không chặn thì bấm + vừa mở
                                        menu vừa đóng folder. */}
                                    <Dropdown icon={null} className='addExam'
                                              onClick={e => e.stopPropagation()}
                                              trigger={<Icon name='plus' link/>}>
                                        <Dropdown.Menu>
                                            <Dropdown.Item icon='edit outline' text='Tự soạn đề'
                                                           onClick={() => this.addExam('/create-exam', folder.id)}/>
                                            <Dropdown.Item icon='file word outline' text='Nhập từ file Word'
                                                           onClick={() => this.addExam('/import-exam', folder.id)}/>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </List.Header>

                                {this.isActiveFolder(folder.id) &&
                                <List.List>
                                    {folderExams.map(exam =>
                                        <List.Item key={exam.id}>
                                            <ExamFile exam={exam} folderOptions={folderOptions}
                                                      moveToFolder={this.moveToFolder}/>
                                        </List.Item>
                                    )}
                                </List.List>
                                }
                            </List.Content>
                        </List.Item>
                    )}

                    Document
                    {exams.map(exam =>
                        <List.Item key={exam.id}>
                            <ExamFile exam={exam} folderOptions={folderOptions} moveToFolder={this.moveToFolder}/>
                        </List.Item>
                    )}
                </List>
            </div>
        </div>
    }
}

export default withRouter(connectGlobalState(Dashboard));
