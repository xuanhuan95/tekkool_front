import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import {Button, Card, Form, Header, Icon, Label, Loader, Message,
        Modal, Segment} from 'semantic-ui-react';
import Api from '../../services/api';

// Khối lớp: 1..12. Không bắt buộc — ngân hàng dùng chung nhiều khối là chuyện
// thường, nhưng giáo viên muốn ghi thì có chỗ ghi.
const KHOI = Array.from({length: 12}, (_, i) => ({
    key: i + 1, text: 'Khối ' + (i + 1), value: i + 1
}));

/**
 * Danh sách ngân hàng câu hỏi.
 *
 * Trước đây ngân hàng không phải một thứ giáo viên tạo ra: khối cứ trôi vào
 * một rổ chung, gắn tên môn đoán từ tên thư mục. Giờ ngân hàng có tên, có môn,
 * tạo bằng tay — môn là bắt buộc vì ma trận rút đề tra cứu theo tên môn.
 */
class BankList extends Component {
    state = {banks: null, subjects: [], open: false, saving: false,
             name: '', subject: '', grade: null, error: null};

    componentDidMount = async () => {
        let [banks, subjects] = await Promise.all([
            Api.get('question_bank/list'),
            Api.get('question_bank/subjects'),
        ]);
        this.setState({banks, subjects});
    };

    save = async () => {
        let {name, subject, grade} = this.state;
        if (!name.trim()) return this.setState({error: 'Chưa nhập tên ngân hàng'});
        if (!subject) return this.setState({error: 'Chưa chọn môn học'});

        this.setState({saving: true, error: null});
        let r = await Api.post('question_bank/create', {name, subject, grade});
        if (r && r.error)
            return this.setState({saving: false, error: r.error});

        this.setState({open: false, saving: false, name: '', subject: '',
                       grade: null, banks: await Api.get('question_bank/list')});
    };

    remove = async (b) => {
        if (!window.confirm('Xoá ngân hàng “' + b.name + '”? '
            + b.blocks + ' khối bên trong mất theo, không lấy lại được.')) return;
        await Api.post('question_bank/remove', {id: b.id});
        this.setState({banks: await Api.get('question_bank/list')});
    };

    render() {
        let {banks, subjects, open, saving, name, subject, grade, error} = this.state;
        if (!banks) return <Loader active inline='centered' className='margin'/>;

        let subjectOptions = subjects.map(s => ({key: s, text: s, value: s}));

        return <div className='tk-dash margin'>
            <div className='tk-dash-bar'>
                <Header as='h2' className='tk-dash-title'>
                    Ngân hàng câu hỏi
                    <Header.Subheader>
                        {banks.length} ngân hàng · nhập đề Word vào đây để rút đề ngẫu nhiên
                    </Header.Subheader>
                </Header>
                <Button primary icon labelPosition='left'
                        onClick={() => this.setState({open: true})}>
                    <Icon name='plus'/> Tạo ngân hàng mới
                </Button>
            </div>

            {!banks.length
                ? <Segment placeholder>
                    <Header icon>
                        <Icon name='database' color='grey'/>
                        Chưa có ngân hàng nào
                        <Header.Subheader>
                            Tạo một ngân hàng cho môn học, rồi nhập đề Word vào đó.
                            Mỗi học sinh sẽ rút được một đề khác nhau.
                        </Header.Subheader>
                    </Header>
                    <Button primary icon labelPosition='left'
                            onClick={() => this.setState({open: true})}>
                        <Icon name='plus'/> Tạo ngân hàng mới
                    </Button>
                </Segment>
                : <Card.Group itemsPerRow={3} stackable className='tk-folders'>
                    {banks.map(b =>
                        <Card key={b.id} className='tk-folder'>
                            <Card.Content>
                                <Card.Header>
                                    <Icon name='database' color='blue'/>
                                    {b.name}
                                </Card.Header>
                                <Card.Meta>
                                    {b.subject}{b.grade ? ' · Khối ' + b.grade : ''}
                                </Card.Meta>
                                <Card.Description>
                                    <Label basic color={b.blocks ? 'green' : 'grey'} size='small'>
                                        {b.blocks} khối
                                    </Label>
                                </Card.Description>
                            </Card.Content>
                            <Card.Content extra>
                                <Link to={'/import-exam?bank=' + b.id}>
                                    <Button size='mini' basic>
                                        <Icon name='file word outline'/> Nhập đề
                                    </Button>
                                </Link>
                                <Link to={'/draw-exam/bank/' + b.id}>
                                    <Button size='mini' basic primary disabled={!b.blocks}>
                                        <Icon name='random'/> Rút đề
                                    </Button>
                                </Link>
                                <Button size='mini' basic icon title='Xoá ngân hàng'
                                        onClick={() => this.remove(b)}>
                                    <Icon name='trash alternate outline' color='red'/>
                                </Button>
                            </Card.Content>
                        </Card>)}
                </Card.Group>}

            <Modal open={open} size='tiny'
                   onClose={() => this.setState({open: false, error: null})}>
                <Modal.Header>Tạo ngân hàng câu hỏi mới</Modal.Header>
                <Modal.Content>
                    <Form error={!!error}>
                        <Form.Input label='Tên ngân hàng' placeholder='Ví dụ: Ngữ văn 12 — HK1'
                                    value={name} autoFocus
                                    onChange={(e, {value}) => this.setState({name: value})}/>
                        <Form.Group widths='equal'>
                            {/* Môn BẮT BUỘC: ma trận rút đề tra theo tên môn, thiếu
                                môn thì không biết mỗi đề cần mấy khối loại nào. */}
                            <Form.Select label='Môn học' required
                                         placeholder='Chọn môn' options={subjectOptions}
                                         value={subject}
                                         onChange={(e, {value}) => this.setState({subject: value})}/>
                            <Form.Select label='Khối lớp' clearable
                                         placeholder='Không bắt buộc' options={KHOI}
                                         value={grade}
                                         onChange={(e, {value}) => this.setState({grade: value})}/>
                        </Form.Group>
                        <Message error content={error}/>
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button basic onClick={() => this.setState({open: false, error: null})}>
                        Huỷ
                    </Button>
                    <Button primary loading={saving} onClick={this.save}>
                        <Icon name='check'/> Lưu
                    </Button>
                </Modal.Actions>
            </Modal>
        </div>;
    }
}

export default withRouter(BankList);
