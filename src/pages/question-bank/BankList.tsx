import {Component} from 'react';
import Loading from '../../components/Loading';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import type {RouterProps} from '../../withRouter';
import {Button, Card, Form, Header, Icon, Label, Message, Modal, Segment} from 'semantic-ui-react';
import Api from '../../services/api';

/** A question bank. `blocks` = number of passage blocks it currently holds. */
type Bank = {id: string; name: string; subject: string; blocks: number};

type State = {
    banks: Bank[] | null;
    subjects: string[];
    open: boolean;
    saving: boolean;
    name: string;
    subject: string;
    error: string | null;
};

/**
 * List of question banks.
 *
 * Previously a bank was not something teachers created: blocks drifted into
 * one shared basket, tagged with a subject guessed from the folder name. Now a
 * bank has a name and a subject and is created by hand — subject is required
 * because the exam-draw matrix looks up by subject name.
 */
class BankList extends Component<RouterProps, State> {
    state: State = {banks: null, subjects: [], open: false, saving: false,
             name: '', subject: '', error: null};

    componentDidMount = async () => {
        let [banks, subjects] = await Promise.all([
            Api.get('question_bank/list'),
            Api.get('question_bank/subjects'),
        ]);
        this.setState({banks, subjects});
    };

    save = async () => {
        let {name, subject} = this.state;
        if (!name.trim()) { this.setState({error: 'Chưa nhập tên ngân hàng'}); return; }
        if (!subject) { this.setState({error: 'Chưa chọn môn học'}); return; }

        this.setState({saving: true, error: null});
        let r = await Api.post('question_bank/create', {name, subject});
        if (r && r.error) {
            this.setState({saving: false, error: r.error});
            return;
        }

        this.setState({open: false, saving: false, name: '', subject: '',
                       banks: await Api.get('question_bank/list')});
    };

    remove = async (b: Bank) => {
        if (!window.confirm('Xoá ngân hàng “' + b.name + '”? '
            + b.blocks + ' khối bên trong mất theo, không lấy lại được.')) return;
        await Api.post('question_bank/remove', {id: b.id});
        this.setState({banks: await Api.get('question_bank/list')});
    };

    render() {
        let {banks, subjects, open, saving, name, subject, error} = this.state;
        if (!banks) return <Loading/>;

        let subjectOptions = subjects.map(s => ({key: s, text: s, value: s}));

        return <div className='tk-dash'>
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
                                <Card.Meta>{b.subject}</Card.Meta>
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
                                {/* The bank's main output: a named EXAM that
                                    students can take. "Draw exam" below is only
                                    for teachers to try one out. */}
                                <Link to={'/create-from-bank?bank=' + b.id}>
                                    <Button size='mini' primary disabled={!b.blocks}>
                                        <Icon name='clipboard list'/> Tạo đề
                                    </Button>
                                </Link>
                                <Link to={'/draw-exam/bank/' + b.id}>
                                    <Button size='mini' basic disabled={!b.blocks}>
                                        <Icon name='random'/> Làm thử
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
                                    onChange={(_e, {value}) => this.setState({name: value})}/>
                        {/* Subject is REQUIRED: the draw matrix looks up by subject
                            name; without it we can't tell how many blocks of each
                            type an exam needs. */}
                        <Form.Select label='Môn học' required
                                     placeholder='Chọn môn' options={subjectOptions}
                                     value={subject}
                                     onChange={(_e, {value}) => this.setState({subject: String(value ?? '')})}/>
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
