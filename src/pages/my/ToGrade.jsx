import React, {Component} from 'react';
import Loading from '../../components/Loading';
import {Link} from 'react-router-dom';
import withRouter from '../../withRouter';
import {Header, Icon, Label, Message, Segment, Table} from 'semantic-ui-react';
import Api from '../../services/api';
import {fmtDate, fmtDuration, ScoreLabel} from './fmt';

/**
 * Bài học sinh nộp — giáo viên vào đây để chấm.
 *
 * Hai chế độ, MỘT file vì bảng hiển thị y hệt nhau:
 *  - /to-grade/:examId  → bài nộp vào một đề
 *  - /to-grade          → mọi bài đang chờ chấm, gom từ mọi đề
 *
 * ponytail: tách hai file là hai chỗ phải sửa mỗi lần đổi cách hiện bảng.
 */
class ToGrade extends Component {
    state = {subs: null, error: null};

    all = () => !this.props.match.params.examId;

    componentDidMount = async () => {
        try {
            let url = this.all() ? 'exam/pending'
                                 : 'exam/to_grade/' + this.props.match.params.examId;
            this.setState({subs: await Api.get(url)});
        } catch (e) {
            this.setState({error: (e && (e.error || e.message)) || 'Không tải được danh sách'});
        }
    };

    render() {
        let {subs, error} = this.state;

        if (error) return <Message negative className='margin'>{error}</Message>;
        if (!subs) return <Loading/>;

        if (!subs.length) return <Segment placeholder className='margin'>
            <Header icon>
                <Icon name={this.all() ? 'check circle outline' : 'inbox'} color='grey'/>
                {this.all() ? 'Không còn bài nào chờ chấm'
                            : 'Chưa có học sinh nào nộp bài'}
            </Header>
        </Segment>;

        let all = this.all();
        let pending = subs.filter(s => s.pending_count > 0).length;

        return <div className='margin'>
            <Header as='h2'>
                {all ? 'Bài chờ chấm' : 'Bài nộp: ' + (subs[0].exam_name || '(đề không tên)')}
                <Header.Subheader>
                    {subs.length} bài
                    {!all && pending > 0 && ' · ' + pending + ' bài chờ chấm'}
                </Header.Subheader>
            </Header>

            <Table selectable>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Học sinh</Table.HeaderCell>
                        {all && <Table.HeaderCell>Đề</Table.HeaderCell>}
                        <Table.HeaderCell collapsing>Nộp lúc</Table.HeaderCell>
                        <Table.HeaderCell collapsing>Thời gian làm</Table.HeaderCell>
                        <Table.HeaderCell collapsing textAlign='center'>Điểm</Table.HeaderCell>
                        <Table.HeaderCell collapsing/>
                    </Table.Row>
                </Table.Header>

                <Table.Body>
                    {subs.map(s =>
                        <Table.Row key={s.id} warning={s.pending_count > 0}>
                            <Table.Cell>{s.student || '(không rõ)'}</Table.Cell>
                            {all && <Table.Cell>{s.exam_name || '(đề không tên)'}</Table.Cell>}
                            <Table.Cell collapsing>{fmtDate(s.submitted_at)}</Table.Cell>
                            <Table.Cell collapsing>{fmtDuration(s.duration_sec)}</Table.Cell>
                            <Table.Cell collapsing textAlign='center'><ScoreLabel sub={s}/></Table.Cell>
                            <Table.Cell collapsing>
                                <Link to={'/my-exams/' + s.id}>
                                    {s.pending_count > 0 ? 'Chấm bài' : 'Xem lại'}
                                </Link>
                            </Table.Cell>
                        </Table.Row>
                    )}
                </Table.Body>
            </Table>
        </div>;
    }
}

export default withRouter(ToGrade);
