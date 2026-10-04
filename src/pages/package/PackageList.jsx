import React, {Component} from 'react';
import Loading from '../../components/Loading';
import withRouter from '../../withRouter';
import {Button, Form, Header, Icon, Label, Message, Modal, Segment, Table} from 'semantic-ui-react';
import {connectGlobalState} from '../../stateUtils';
import Api from '../../services/api';


/** Số tiền kiểu 100000 -> "100.000 đ". */
const tien = (n) => (n || 0).toLocaleString('vi-VN') + ' đ';


/**
 * Quản lý gói thi thử.
 *
 * Thay cho việc bán từng đề: học sinh mua một gói, được N lượt vào thi, dùng
 * cho đề nào cũng được. Lượt trừ lúc BẮT ĐẦU vào thi, không phải lúc nộp.
 */
class PackageList extends Component {
    state = {goi: null, vi: null, form: null, saving: false, error: null, msg: null};

    componentDidMount = () => this.load();

    // group là string id ('teacher' | 'student' | 'visitor').
    laGiaoVien = () => {
        let {auth} = this.globalState;
        return !!(auth && auth.user && auth.user.group === 'teacher');
    };

    load = async () => {
        let gv = this.laGiaoVien();
        // ?all=1: giáo viên thấy cả gói đã ẩn để sửa lại hoặc bật lên.
        // Học sinh chỉ thấy gói đang bán — BE tự lọc, tham số này chỉ mở thêm.
        this.setState({goi: await Api.get('package/list' + (gv ? '?all=1' : ''))});

        // Số lượt còn lại: chỉ học sinh cần. Giáo viên không tốn lượt nào.
        if (!gv) this.setState({vi: await Api.get('payment/wallet')});
    };

    moTao = () => this.setState({
        form: {name: '', turns: 4, price: 100000, description: '', order: 0,
               active: true},
        error: null,
    });

    moSua = (p) => this.setState({form: {...p}, error: null});

    luu = async () => {
        let f = this.state.form;
        if (!(f.name || '').trim()) return this.setState({error: 'Chưa đặt tên gói'});
        if (!(f.turns > 0)) return this.setState({error: 'Số lượt phải từ 1 trở lên'});

        this.setState({saving: true, error: null});
        let r = await Api.post(f.id ? 'package/update/' + f.id : 'package/create', f);
        if (r && r.error) return this.setState({saving: false, error: r.error});

        this.setState({form: null, saving: false});
        this.load();
    };

    xoa = async (p) => {
        if (!window.confirm('Xoá gói “' + p.name + '”?')) return;
        let r = await Api.post('package/remove/' + p.id, {});
        // Gói đã bán được thì BE chỉ ẩn đi — nói rõ cho giáo viên biết.
        this.setState({msg: r && r.message ? r.message : null});
        this.load();
    };

    render() {
        let {goi, form, saving, error, msg} = this.state;
        if (!goi) return <Loading/>;

        if (!this.laGiaoVien()) return this.renderMua(goi);

        return <div className='tk-dash'>
            <div className='tk-dash-bar'>
                <Header as='h2' className='tk-dash-title'>
                    Gói thi thử
                    <Header.Subheader>
                        Học sinh mua gói để lấy lượt thi. Mỗi lần bắt đầu vào thi trừ 1 lượt.
                    </Header.Subheader>
                </Header>
                <Button primary icon labelPosition='left' onClick={this.moTao}>
                    <Icon name='plus'/> Tạo gói mới
                </Button>
            </div>

            {msg && <Message info onDismiss={() => this.setState({msg: null})} content={msg}/>}

            {!goi.length
                ? <Segment placeholder>
                    <Header icon>
                        <Icon name='cube' color='grey'/>
                        Chưa có gói nào
                        <Header.Subheader>
                            Chưa có gói thì học sinh không mua được lượt thi nào.
                        </Header.Subheader>
                    </Header>
                    <Button primary icon labelPosition='left' onClick={this.moTao}>
                        <Icon name='plus'/> Tạo gói mới
                    </Button>
                </Segment>
                : <Table celled>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Gói</Table.HeaderCell>
                            <Table.HeaderCell textAlign='center'>Số lượt</Table.HeaderCell>
                            <Table.HeaderCell textAlign='right'>Giá</Table.HeaderCell>
                            <Table.HeaderCell textAlign='center'>Trạng thái</Table.HeaderCell>
                            <Table.HeaderCell/>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {goi.map(p =>
                            <Table.Row key={p.id} disabled={!p.active}>
                                <Table.Cell>
                                    <b>{p.name}</b>
                                    {p.description &&
                                        <div style={{color: '#888', fontSize: '.9em'}}>
                                            {p.description}
                                        </div>}
                                </Table.Cell>
                                <Table.Cell textAlign='center'>
                                    <Label circular color='blue'>{p.turns}</Label>
                                </Table.Cell>
                                <Table.Cell textAlign='right'>{tien(p.price)}</Table.Cell>
                                <Table.Cell textAlign='center'>
                                    {p.active
                                        ? <Label basic color='green' size='small'>Đang bán</Label>
                                        : <Label basic size='small'>Đã ẩn</Label>}
                                </Table.Cell>
                                <Table.Cell textAlign='right' collapsing>
                                    <Button size='mini' basic onClick={() => this.moSua(p)}>
                                        <Icon name='edit'/> Sửa
                                    </Button>
                                    <Button size='mini' basic icon title='Xoá gói'
                                            onClick={() => this.xoa(p)}>
                                        <Icon name='trash alternate outline' color='red'/>
                                    </Button>
                                </Table.Cell>
                            </Table.Row>)}
                    </Table.Body>
                </Table>}

            {form && this.renderForm(form, saving, error)}
        </div>;
    }

    /** Màn học sinh: chọn gói để mua. Không có nút sửa/xoá nào. */
    renderMua(goi) {
        let {vi} = this.state;
        // ?het-luot=1: DoExam đẩy sang đây khi vào thi mà ví rỗng — nói thẳng
        // lý do, không để học sinh tự đoán vì sao bị đá ra khỏi đề.
        let hetLuot = (this.props.location.search || '').indexOf('het-luot=1') >= 0;

        return <div className='tk-dash'>
            <div className='tk-dash-bar'>
                <Header as='h2' className='tk-dash-title'>Gói thi thử</Header>
                {/* Không dùng <Statistic> của Semantic: component đó ép font
                    serif cho số và in hoa cho nhãn, lạc hẳn khỏi phần còn lại
                    của trang. Một thẻ nhỏ cùng hệ chữ là đủ. */}
                {vi && <div className={'tk-vi' + (vi.remaining > 0 ? '' : ' het')}>
                    <span className='tk-vi-so'>{vi.remaining}</span>
                    <span className='tk-vi-nhan'>lượt còn lại</span>
                </div>}
            </div>

            {hetLuot && <Message warning icon>
                <Icon name='hourglass end'/>
                <Message.Content>
                    <Message.Header>Bạn đã hết lượt thi</Message.Header>
                    Chọn một gói bên dưới để tiếp tục làm bài.
                </Message.Content>
            </Message>}

            {!goi.length
                ? <Segment placeholder>
                    <Header icon>
                        <Icon name='cube' color='grey'/>
                        Chưa có gói nào đang bán
                        <Header.Subheader>
                            Giáo viên chưa mở bán gói nào — liên hệ giáo viên của bạn.
                        </Header.Subheader>
                    </Header>
                </Segment>
                : <div className='tk-goi-list'>
                    {goi.map(p =>
                        <button key={p.id} type='button' className='tk-goi'
                                onClick={() => this.props.history.push('/payment/' + p.id)}>
                            <div className='tk-goi-ten'>{p.name}</div>
                            <div className='tk-goi-luot'>{p.turns} lượt thi thử</div>
                            <div className='tk-goi-gia'>{tien(p.price)}</div>
                            {p.description &&
                                <div className='tk-goi-mota'>{p.description}</div>}
                        </button>)}
                </div>}
        </div>;
    }

    renderForm(f, saving, error) {
        let dat = (k, v) => this.setState({form: {...f, [k]: v}});

        return <Modal open size='tiny' onClose={() => this.setState({form: null})}>
            <Modal.Header>{f.id ? 'Sửa gói' : 'Tạo gói mới'}</Modal.Header>
            <Modal.Content>
                <Form error={!!error}>
                    <Form.Input label='Tên gói' value={f.name} autoFocus
                                placeholder='Ví dụ: Cơ bản'
                                onChange={(e, {value}) => dat('name', value)}/>
                    <Form.Group widths='equal' className='tk-pkg-nums'>
                        <Form.Input label='Số lượt thi' type='number' min='1'
                                    value={f.turns}
                                    onChange={(e, {value}) => dat('turns', parseInt(value) || 0)}/>
                        <Form.Input label='Giá (đ)' type='number' min='0' step='10000'
                                    value={f.price}
                                    onChange={(e, {value}) => dat('price', parseInt(value) || 0)}/>
                        <Form.Input label='Thứ tự hiện' type='number'
                                    value={f.order}
                                    onChange={(e, {value}) => dat('order', parseInt(value) || 0)}/>
                    </Form.Group>
                    <Form.TextArea label='Mô tả' rows={2} value={f.description || ''}
                                   placeholder='Hiện trên trang bán gói cho học sinh'
                                   onChange={(e, {value}) => dat('description', value)}/>
                    <Form.Checkbox label='Đang bán (bỏ chọn để ẩn khỏi trang bán)'
                                   checked={!!f.active}
                                   onChange={(e, {checked}) => dat('active', checked)}/>
                    <Message error content={error}/>
                </Form>
            </Modal.Content>
            <Modal.Actions>
                <Button basic onClick={() => this.setState({form: null})}>Huỷ</Button>
                <Button primary loading={saving} onClick={this.luu}>
                    <Icon name='check'/> Lưu
                </Button>
            </Modal.Actions>
        </Modal>;
    }
}

export default withRouter(connectGlobalState(PackageList));
