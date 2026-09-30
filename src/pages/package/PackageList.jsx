import React, {Component} from 'react';
import withRouter from '../../withRouter';
import {Button, Card, Form, Header, Icon, Label, Loader, Message,
        Modal, Segment, Statistic, Table} from 'semantic-ui-react';
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
        if (!goi) return <Loader active inline='centered' className='margin'/>;

        if (!this.laGiaoVien()) return this.renderMua(goi);

        return <div className='tk-dash margin'>
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
                            <Table.HeaderCell textAlign='right'>Mỗi lượt</Table.HeaderCell>
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
                                {/* Đơn giá mỗi lượt: cho giáo viên thấy gói to có
                                    thật sự rẻ hơn không, khỏi tự bấm máy tính. */}
                                <Table.Cell textAlign='right' style={{color: '#888'}}>
                                    {tien(Math.round(p.price / p.turns))}
                                </Table.Cell>
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

        return <div className='tk-dash margin'>
            <div className='tk-dash-bar'>
                <Header as='h2' className='tk-dash-title'>
                    Gói thi thử
                    <Header.Subheader>
                        Mua gói để lấy lượt thi. Mỗi lần bắt đầu vào thi trừ 1 lượt.
                    </Header.Subheader>
                </Header>
                {vi && <Statistic size='small' color={vi.remaining > 0 ? 'green' : 'red'}>
                    <Statistic.Value>{vi.remaining}</Statistic.Value>
                    <Statistic.Label>lượt còn lại</Statistic.Label>
                </Statistic>}
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
                : <Card.Group itemsPerRow={3} stackable>
                    {goi.map(p =>
                        <Card key={p.id}>
                            <Card.Content>
                                <Card.Header>{p.name}</Card.Header>
                                <Card.Meta>{p.turns} lượt thi thử</Card.Meta>
                                {p.description && <Card.Description>{p.description}</Card.Description>}
                            </Card.Content>
                            <Card.Content>
                                <div style={{fontSize: '1.6em'}}><b>{tien(p.price)}</b></div>
                                <div style={{color: '#888', fontSize: '.9em'}}>
                                    {tien(Math.round(p.price / p.turns))} mỗi lượt
                                </div>
                            </Card.Content>
                            <Card.Content extra>
                                <Button primary fluid
                                        onClick={() => this.props.history.push('/payment/' + p.id)}>
                                    <Icon name='credit card'/> Mua gói này
                                </Button>
                            </Card.Content>
                        </Card>)}
                </Card.Group>}
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
                    {f.turns > 0 && f.price > 0 &&
                        <Message size='mini' info
                                 content={'Mỗi lượt ' + tien(Math.round(f.price / f.turns))}/>}
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
