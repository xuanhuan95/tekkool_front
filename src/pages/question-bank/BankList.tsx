import {Component} from 'react';
import Loading from '../../components/Loading';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import type {RouterProps} from '../../withRouter';
import {Button, Card, Form, Header, Icon, Label, Message, Modal, Segment} from 'semantic-ui-react';
import Api from '../../services/api';
import {TEN_LOAI} from '../exam-creation/blockTypes';
import type {BlockType} from '../exam-creation/blockTypes';
import type {Folder} from '../../types/exam';

/** Một ngân hàng câu hỏi. `blocks` = số khối ngữ liệu đang có bên trong. */
type Bank = {id: string; name: string; subject: string; blocks: number};

/** Form "tạo đề từ ngân hàng". matran/per_type khoá theo mã loại khối. */
type DeForm = {
    name?: string;
    duration?: number;
    folder?: string;
    /** Số khối mỗi loại mà đề sẽ rút. */
    matran?: Record<string, number>;
    /** Số khối mỗi loại ngân hàng ĐANG có — để báo thiếu. */
    per_type?: Record<string, number>;
};

type State = {
    banks: Bank[] | null;
    subjects: string[];
    open: boolean;
    saving: boolean;
    name: string;
    subject: string;
    error: string | null;
    de: Bank | null;
    deForm: DeForm;
    deSaving: boolean;
    deError: string | null;
    folders: Folder[];
    daTao: {name: string; folder?: string} | null;
};

/**
 * Danh sách ngân hàng câu hỏi.
 *
 * Trước đây ngân hàng không phải một thứ giáo viên tạo ra: khối cứ trôi vào
 * một rổ chung, gắn tên môn đoán từ tên thư mục. Giờ ngân hàng có tên, có môn,
 * tạo bằng tay — môn là bắt buộc vì ma trận rút đề tra cứu theo tên môn.
 */
class BankList extends Component<RouterProps, State> {
    state: State = {banks: null, subjects: [], open: false, saving: false,
             name: '', subject: '', error: null,
             // Form "Tao de tu ngan hang": de = ten + thoi gian + gia + ma tran.
             de: null, deForm: {}, deSaving: false, deError: null,
             folders: [], daTao: null};

    componentDidMount = async () => {
        let [banks, subjects, folders] = await Promise.all([
            Api.get('question_bank/list'),
            Api.get('question_bank/subjects'),
            Api.get('folder/list'),
        ]);
        this.setState({banks, subjects, folders});
    };

    /** Mở form tạo đề. Ma trận lấy từ BE (chuẩn của môn) chứ không chép bảng
     *  sang FE — hai bảng lệch nhau thì giáo viên đặt một đằng, rút một nẻo. */
    moTaoDe = async (b: Bank) => {
        this.setState({de: b, deError: null, deForm: {}, deSaving: false});
        let cap = await Api.post('question_bank/capacity', {bank: b.id});
        this.setState({deForm: {
            name: b.name, duration: 90,
            folder: '', matran: cap.slots || {}, per_type: cap.per_type || {},
        }});
    };

    taoDe = async () => {
        let {de, deForm} = this.state;
        // Chỉ bấm được từ trong modal nên `de` luôn có. Chặn cho chắc: thiếu
        // `de` mà vẫn gọi thì BE nhận bank=undefined và tạo đề rỗng.
        if (!de) return;
        if (!(deForm.name || '').trim()) {
            this.setState({deError: 'Chưa đặt tên đề'});
            return;
        }

        this.setState({deSaving: true, deError: null});
        let r = await Api.post('exam/create_from_bank', {
            bank: de.id, name: deForm.name, duration: deForm.duration,
            folder: deForm.folder || null,
            matran: deForm.matran,
        });
        if (r && r.error) {
            this.setState({deSaving: false, deError: r.error});
            return;
        }
        // Khong vao /edit-exam: de ngan hang khong co cau co dinh de sua.
        // Ve dung thu muc vua xep de vao, giao vien thay de nam o dau.
        this.setState({de: null, deSaving: false,
                       daTao: {name: r.name, folder: deForm.folder}});
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

    /** Modal tạo đề. Bốn thứ giáo viên đặt: tên, thời gian, giá, ma trận. */
    renderTaoDe() {
        let {de, deForm, deSaving, deError, folders} = this.state;
        if (!de) return null;

        let f = deForm, mt = f.matran || {}, co = f.per_type || {};
        let dat = (k: keyof DeForm, v: unknown) => this.setState({deForm: {...f, [k]: v}});
        let datMT = (t: string, v: unknown) => dat('matran', {...mt, [t]: Math.max(0, parseInt(String(v)) || 0)});
        // Không cho lưu đề mà ngân hàng chưa đủ khối — học sinh sẽ vào và gặp 409.
        let thieu = Object.keys(mt).filter(t => mt[t] > 0 && (co[t] || 0) < mt[t]);
        const tenLoai = (t: string) => TEN_LOAI[t as BlockType] || t;

        return <Modal open size='small' onClose={() => this.setState({de: null})}>
            <Modal.Header>Tạo đề từ “{de.name}”</Modal.Header>
            <Modal.Content>
                <Form error={!!deError}>
                    <Form.Input label='Tên đề' value={f.name || ''} autoFocus
                                placeholder='Ví dụ: Kiểm tra giữa kỳ I'
                                onChange={(_e, {value}) => dat('name', value)}/>
                    <Form.Group widths='equal'>
                        <Form.Input label='Thời gian (phút)' type='number' min='0'
                                    value={f.duration}
                                    onChange={(_e, {value}) => dat('duration', parseInt(value) || 0)}/>
                        <Form.Select label='Thư mục' placeholder='Không xếp thư mục'
                                     value={f.folder || ''}
                                     options={[{key: '', text: '— Không xếp —', value: ''}]
                                         .concat(folders.map(x => ({key: x.id, text: x.name, value: x.id})))}
                                     onChange={(_e, {value}) => dat('folder', value)}/>
                    </Form.Group>

                    <Header as='h5'>
                        Format đề
                        <Header.Subheader>
                            Mỗi lượt làm rút đúng số khối này, mỗi học sinh một bộ khác nhau.
                        </Header.Subheader>
                    </Header>
                    <Form.Group widths='equal'>
                        {Object.keys(mt).map(t =>
                            <Form.Input key={t} type='number' min='0' value={mt[t]}
                                        label={tenLoai(t) + ' (có ' + (co[t] || 0) + ')'}
                                        error={mt[t] > 0 && (co[t] || 0) < mt[t]}
                                        onChange={(_e, {value}) => datMT(t, value)}/>)}
                    </Form.Group>

                    {!!thieu.length && <Message warning
                        header='Ngân hàng chưa đủ khối'
                        content={'Thiếu: ' + thieu.map(tenLoai).join(', ')
                                 + '. Nhập thêm đề hoặc giảm số khối lại.'}/>}
                    <Message error content={deError}/>
                </Form>
            </Modal.Content>
            <Modal.Actions>
                <Button basic onClick={() => this.setState({de: null})}>Huỷ</Button>
                <Button primary loading={deSaving} disabled={!!thieu.length || deSaving}
                        onClick={this.taoDe}>
                    <Icon name='check'/> Tạo đề
                </Button>
            </Modal.Actions>
        </Modal>;
    }

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

            {this.state.daTao && <Message positive
                onDismiss={() => this.setState({daTao: null})}
                header={'Đã tạo đề “' + this.state.daTao.name + '”'}
                content={this.state.daTao.folder
                    ? 'Đề nằm trong thư mục đã chọn, học sinh vào môn đó là thấy.'
                    : 'Đề chưa xếp thư mục — học sinh chưa thấy. Xếp vào một thư mục môn ở trang chủ.'}/>}

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
                                {/* Duong ra chinh cua ngan hang: ra mot DE co
                                    ten, hoc sinh vao lam duoc. "Rut de" ben
                                    duoi chi de giao vien lam thu mot ban. */}
                                <Button size='mini' primary disabled={!b.blocks}
                                        onClick={() => this.moTaoDe(b)}>
                                    <Icon name='clipboard list'/> Tạo đề
                                </Button>
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
                        {/* Môn BẮT BUỘC: ma trận rút đề tra theo tên môn, thiếu
                            môn thì không biết mỗi đề cần mấy khối loại nào. */}
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

            {this.renderTaoDe()}
        </div>;
    }
}

export default withRouter(BankList);
