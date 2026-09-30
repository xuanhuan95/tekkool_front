import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import {Button, Header, Icon, Label, Loader, Message, Segment, Table} from 'semantic-ui-react';
import Api from '../../services/api';
import {TEN_LOAI} from './blockTypes';


/**
 * Rút đề từ ngân hàng câu hỏi.
 *
 * Ngân hàng lâu nay là cửa một chiều: import vào được, không ra được. Màn này
 * là cửa ra — xem còn bao nhiêu khối mỗi loại, rút được mấy lần không trùng,
 * rồi bấm rút một đề.
 *
 * ponytail: chưa cho sửa ma trận ở đây — BE tự lấy MA_TRAN của môn (bảng Excel).
 * Thêm ô nhập khi giáo viên cần đề lệch chuẩn.
 */
class DrawExam extends Component {
    state = {stats: null, cap: null, error: null, drawing: false, warn: null,
             bank: null};

    // Rút theo NGÂN HÀNG là đường chính. Đường cũ (/draw-exam/:subject) giữ lại
    // cho 80 khối import trước khi có model QuestionBank — chúng chỉ có subject.
    bankId = () => this.props.match.params.bankId || '';
    subject = () => this.props.match.params.subject || '';

    // Ma trận vẫn phải theo môn: không lọc môn thì mặc định lấy ma trận Ngữ văn.
    maTran = () => this.subject() || 'Ngữ văn';

    componentDidMount = async () => {
        try {
            let bankId = this.bankId(), subject = this.subject();
            let q = bankId ? 'bank=' + bankId
                           : 'subject=' + encodeURIComponent(subject);
            let stats = await Api.get('question_bank/stats?' + q);
            // slots rỗng -> BE lấy đúng MA_TRAN của môn, không phải đoán ở FE.
            // Có bank thì BE tự suy môn từ bank, FE khỏi đoán.
            let cap = await Api.post('question_bank/capacity',
                                     bankId ? {bank: bankId}
                                            : {subject, matran: this.maTran()});
            this.setState({stats, cap});
        } catch (e) {
            this.setState({error: (e && (e.error || e.message)) || 'Không tải được ngân hàng'});
        }
    };

    draw = async () => {
        this.setState({drawing: true, warn: null});
        try {
            let r = await Api.post('question_bank/draw',
                                   this.bankId()
                                       ? {bank: this.bankId()}
                                       : {subject: this.subject(), matran: this.maTran()});
            // 409 (thiếu khối) về qua resolve chứ không throw: JsonResponse chỉ
            // gắn 'code' cho abort(), còn `return {...}, 409` giữ nguyên body.
            if (r.error) return this.setState({drawing: false, warn: r.error});
            this.props.navigate('/do-exam/' + r.id);
        } catch (e) {
            this.setState({drawing: false,
                           warn: (e && (e.error || e.message)) || 'Rút đề thất bại'});
        }
    };

    render() {
        let {stats, cap, error, drawing, warn} = this.state;

        if (error) return <Message negative className='margin'>{error}</Message>;
        if (!stats || !cap) return <Loader active inline='centered' className='margin'/>;

        let per = stats.per_type || {};
        let slots = cap.slots || {};
        let lan = cap.capacity || 0;
        let nghen = cap.bottleneck;

        // Loại có trong ngân hàng nhưng không nằm trong ma trận -> không bao giờ
        // được rút. Hiện ra để giáo viên biết mình đang có hàng tồn.
        let ngoai = Object.keys(per).filter(t => !slots[t]);

        return <div className='margin'>
            <Header as='h2'>
                Rút đề từ ngân hàng
                <Header.Subheader>
                    {(cap && cap.subject) || this.subject() || 'Tất cả môn'}
                </Header.Subheader>
            </Header>

            {lan > 0
                ? <Message positive icon>
                    <Icon name='check circle'/>
                    <Message.Content>
                        <Message.Header>Rút được {lan} đề không trùng khối</Message.Header>
                        {nghen && <span>Nghẽn ở <b>{TEN_LOAI[nghen[0]] || nghen[0]}</b> — soạn
                            thêm loại này thì rút được nhiều đề hơn.</span>}
                    </Message.Content>
                </Message>
                : <Message warning icon>
                    <Icon name='warning sign'/>
                    <Message.Content>
                        <Message.Header>Chưa đủ khối để rút một đề</Message.Header>
                        Cần thêm khối ở những loại đang thiếu bên dưới.
                    </Message.Content>
                </Message>}

            <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Loại câu</Table.HeaderCell>
                        <Table.HeaderCell textAlign='center'>Mỗi đề cần</Table.HeaderCell>
                        <Table.HeaderCell textAlign='center'>Đang có</Table.HeaderCell>
                        <Table.HeaderCell textAlign='center'>Rút được</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {Object.keys(slots).map(t => {
                        let co = per[t] || 0, can = slots[t];
                        let duoc = Math.floor(co / can);
                        return <Table.Row key={t} negative={duoc < 1}>
                            <Table.Cell>{TEN_LOAI[t] || t}</Table.Cell>
                            <Table.Cell textAlign='center'>{can}</Table.Cell>
                            <Table.Cell textAlign='center'>{co}</Table.Cell>
                            <Table.Cell textAlign='center'>
                                <Label circular color={duoc < 1 ? 'red' : duoc < 4 ? 'yellow' : 'green'}>
                                    {duoc}
                                </Label>
                            </Table.Cell>
                        </Table.Row>;
                    })}
                    {ngoai.map(t => <Table.Row key={t} warning>
                        <Table.Cell>{TEN_LOAI[t] || t}</Table.Cell>
                        <Table.Cell colSpan='3' textAlign='center'>
                            <Icon name='info circle'/>
                            {per[t]} khối, không nằm trong ma trận môn này nên không được rút
                        </Table.Cell>
                    </Table.Row>)}
                </Table.Body>
            </Table>

            {warn && <Message negative>{warn}</Message>}

            <Segment basic textAlign='center'>
                <Button primary size='large' icon labelPosition='left'
                        disabled={lan < 1 || drawing} loading={drawing}
                        onClick={this.draw}>
                    <Icon name='random'/>
                    Rút một đề và làm thử
                </Button>
                <div style={{marginTop: '.6em', color: '#888'}}>
                    Mỗi học sinh rút ra một đề khác nhau, vào lại vẫn đúng đề cũ.
                </div>
            </Segment>

            <Segment basic textAlign='center'>
                <Link to={this.bankId() ? '/import-exam?bank=' + this.bankId()
                                        : '/import-exam'}>
                    Ngân hàng còn thiếu? Nhập thêm đề
                </Link>
            </Segment>
        </div>;
    }
}

export default withRouter(DrawExam);
