import withRouter from '../../withRouter';
import React, {Component, Fragment} from 'react';
import {Button, Icon, Menu, Input, Dropdown, List, Popup} from 'semantic-ui-react';
import {connectGlobalState} from "../../stateUtils";
import {Link} from 'react-router-dom';
import Api from '../../services/api';
import ExamFile from './ExamFile';


class Dashboard extends Component {
    state = {
        folders: [],
        activeItem: 'mine',
        activeFolder: null,
        folderExams: [],
        nextUrl: '',
    };

    handleItemClick = (e, {name}) => this.setState({activeItem: name});

    examCreation = () => {
        this.props.history.push('/create-exam');
    };

    componentDidMount = async () => {
        let exams = await Api.get('exam/list');
        let folders = await Api.get('folder/list');

        // get params next url
        let params = new URLSearchParams(this.props.location.search);
        let nextUrl = params.get('nextUrl');

        this.setGlobalState({exams});
        this.setState({folders, nextUrl});
    };

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
        let {activeItem, folders, folderExams, nextUrl} = this.state;
        let folderOptions = folders.map(f => ({text: f.name, value: f.id}));
        folderOptions.unshift({text: '---root---', value: null});
        let {auth, exams} = this.globalState;
        let {user} = auth;

        if(!exams) exams = [];

        return <div id='ExamCreation' className='margin'>
            <Menu id='leftMenu' vertical pointing>
                <Menu.Item>
                    <Link to='/create-exam'>
                        <Button fluid primary>Create Exam</Button>
                    </Link>
                </Menu.Item>

                <Menu.Item name='mine' active={activeItem === 'mine'} onClick={this.handleItemClick}>
                    <Icon name='database'/> My tests
                </Menu.Item>

                <Menu.Item name='shared' active={activeItem === 'shared'} onClick={this.handleItemClick}>
                    <Icon name='cloud'/> Shared with me
                </Menu.Item>
            </Menu>

            {user.group === 'visitor' ?
                <div id='content' className='margin-top'>
                    <h3>You are visitor, please paste link do exam to brower</h3>
                    <Fragment>
                        {nextUrl &&
                        <Link to={nextUrl}>
                            <Button>Do Exam</Button>
                        </Link>
                        }
                    </Fragment>
                </div>
                :
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
                                    <List.Header as='h2'>{folder.name}</List.Header>

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
            }
        </div>
    }
}

export default withRouter(connectGlobalState(Dashboard));
