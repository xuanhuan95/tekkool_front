import React, {Component} from 'react';
import {Button, Checkbox, Header, Icon, List, Message, Segment} from 'semantic-ui-react';
import withRouter from '../../withRouter';
import {connectGlobalState} from '../../stateUtils';
import Api from '../../services/api';


class ImportExam extends Component {
    state = {
        loading: false,
        error: null,
        exams: [],
        warnings: [],
        picked: {},
        saving: false,
        folder: null,
    };

    componentDidMount = async () => {
        let id = new URLSearchParams(this.props.location.search).get('folder');
        if (!id) return;
        let folders = await Api.get('folder/list');
        this.setState({folder: folders.find(f => f.id === id) || null});
    };

    refFile = React.createRef();

    pickFile = () => this.refFile.current.click();

    upload = async ({target}) => {
        let file = target.files[0];
        if (!file) return;

        this.setState({loading: true, error: null, exams: [], warnings: []});

        try {
            let res = await Api.upload('import_docx/preview', file);
            // ponytail: mặc định tick HẾT. File 20 đề mà bỏ tick hết thì giáo
            // viên phải bấm 20 lần; bỏ bớt vài đề dễ hơn chọn lại từ đầu.
            let picked = {};
            res.exams.forEach(e => picked[e.id] = true);
            this.setState({exams: res.exams, warnings: res.warnings || [], picked});
        } catch (e) {
            this.setState({error: e.message || e.description || 'Không đọc được file'});
        } finally {
            // Cho phép chọn lại đúng file vừa chọn
            target.value = '';
            this.setState({loading: false});
        }
    };

    toggle = (id) => this.setState(({picked}) => ({picked: {...picked, [id]: !picked[id]}}));

    toggleAll = () => {
        let {exams, picked} = this.state;
        let all = exams.every(e => picked[e.id]);
        let next = {};
        exams.forEach(e => next[e.id] = !all);
        this.setState({picked: next});
    };

    save = async () => {
        let {exams, picked} = this.state;
        let chosen = exams.filter(e => picked[e.id]);
        if (!chosen.length) return;

        this.setState({saving: true, error: null});
        try {
            // ponytail: gọi tuần tự, không Promise.all. 20 đề x 12 câu = 240
            // lượt ghi Question; bắn song song dễ làm server 2 nhân nghẹn.
            let folder = new URLSearchParams(this.props.location.search).get('folder');
            for (let exam of chosen) {
                await Api.post('exam/create', exam);
                // exam/create không nhận folder -> dùng move_to_folder sẵn có.
                if (folder) await Api.post('exam/move_to_folder', {examId: exam.id, folderId: folder});
            }
            this.props.history.push('/');
        } catch (e) {
            this.setState({error: e.message || 'Lưu đề thất bại', saving: false});
        }
    };

    folderName = () => this.state.folder && this.state.folder.name;

    countQuestions = (exam) => exam.sections.reduce((n, s) => n + s.questions.length, 0);

    render() {
        let {loading, error, exams, warnings, picked, saving} = this.state;
        let chosen = exams.filter(e => picked[e.id]).length;

        return <div className='margin'>
            <Header as='h2'>
                <Icon name='file word outline'/>
                <Header.Content>
                    Nhập đề từ file Word
                    <Header.Subheader>
                        Xem trước rồi mới lưu — chưa ghi vào hệ thống
                        {this.folderName() && ` · lưu vào thư mục ${this.folderName()}`}
                    </Header.Subheader>
                </Header.Content>
            </Header>

            <input type='file' accept='.docx' ref={this.refFile}
                   onChange={this.upload} style={{display: 'none'}}/>

            <Button primary loading={loading} disabled={loading || saving} onClick={this.pickFile}>
                <Icon name='upload'/> Chọn file .docx
            </Button>

            {error && <Message negative>{error}</Message>}

            {warnings.length > 0 &&
            <Message warning>
                <Message.Header>Cần kiểm tra lại {warnings.length} chỗ</Message.Header>
                <Message.List items={warnings}/>
            </Message>}

            {exams.length > 0 && <Segment.Group className='margin-top'>
                <Segment secondary>
                    <Checkbox label={`Đọc được ${exams.length} đề — đã chọn ${chosen}`}
                              checked={chosen === exams.length}
                              indeterminate={chosen > 0 && chosen < exams.length}
                              onChange={this.toggleAll}/>
                </Segment>

                {exams.map(exam =>
                    <Segment key={exam.id}>
                        <Checkbox checked={!!picked[exam.id]} onChange={() => this.toggle(exam.id)}
                                  label={<label><b>{exam.name}</b>{' '}
                                      ({this.countQuestions(exam)} câu
                                      {exam.duration ? `, ${exam.duration} phút` : ''})</label>}/>

                        <List className='margin-top' size='small'>
                            {exam.sections.map(s =>
                                <List.Item key={s.id}>
                                    <Icon name='folder outline'/>
                                    <List.Content>{s.name} — {s.questions.length} câu</List.Content>
                                </List.Item>
                            )}
                        </List>
                    </Segment>
                )}

                <Segment>
                    <Button positive loading={saving} disabled={!chosen || saving} onClick={this.save}>
                        <Icon name='save'/> Lưu {chosen} đề
                    </Button>
                    <span style={{marginLeft: 10, color: '#888'}}>
                        Lưu xong vào từng đề để sửa lại nếu cần
                    </span>
                </Segment>
            </Segment.Group>}
        </div>;
    }
}

export default withRouter(connectGlobalState(ImportExam));
