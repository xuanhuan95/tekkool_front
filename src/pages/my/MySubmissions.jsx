import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {Icon, Loader} from 'semantic-ui-react';
import Api from '../../services/api';
import {fmtDate, fmtDuration, ScoreLabel} from './fmt';

/** Danh sách bài học sinh đã nộp. */
export default class MySubmissions extends Component {
    state = {subs: null, error: null};

    componentDidMount = async () => {
        try {
            this.setState({subs: await Api.get('exam/my_submissions')});
        } catch (e) {
            this.setState({error: (e && (e.error || e.message)) || 'Không tải được danh sách'});
        }
    };

    render() {
        let {subs, error} = this.state;

        if (error) return <div className='tk'><div className='tk-wrap'>
            <div className='tk-empty'>
                <Icon name='exclamation triangle'/>
                <div className='tk-empty-title'>Có lỗi xảy ra</div>
                <div>{error}</div>
            </div>
        </div></div>;

        if (!subs) return <div className='tk'><div className='tk-wrap'>
            <Loader active inline='centered'/>
        </div></div>;

        return <div className='tk'><div className='tk-wrap'>
            <h1 className='tk-title'>Lịch sử làm bài</h1>
            <p className='tk-sub'>
                {subs.length ? subs.length + ' bài đã nộp' : 'Chưa có bài nào'}
            </p>

            {!subs.length
                ? <div className='tk-empty'>
                    <Icon name='file outline'/>
                    <div className='tk-empty-title'>Bạn chưa làm bài nào</div>
                    <div><Link to='/'>Xem danh sách đề thi thử</Link></div>
                </div>
                : <div className='tk-exam-list'>
                    {subs.map(s =>
                        <Link key={s.id} to={'/my-exams/' + s.id} className='tk-exam'>
                            <span className='tk-exam-icon'>
                                <Icon name='clipboard check' size='large'/>
                            </span>
                            <span className='tk-exam-main'>
                                <span className='tk-exam-name'>
                                    {s.exam_name || '(đề không tên)'}
                                </span>
                                <span className='tk-exam-meta'>
                                    <span><Icon name='calendar outline'/> {fmtDate(s.submitted_at)}</span>
                                    <span><Icon name='clock outline'/> {fmtDuration(s.duration_sec)}</span>
                                    {/* Hết giờ máy nộp thay -> phải biết vì sao bài dừng giữa chừng. */}
                                    {s.auto_submitted &&
                                    <span><Icon name='hourglass end'/> hết giờ, máy nộp</span>}
                                    {/* Nối sang hoá đơn của chính lượt này — yêu cầu "thanh toán
                                        gắn với làm bài nào". Đề miễn phí không có đơn. */}
                                    {s.invoice_number &&
                                    <span><Icon name='credit card outline'/> {s.invoice_number}</span>}
                                </span>
                            </span>
                            <span onClick={e => e.preventDefault()}>
                                <ScoreLabel sub={s}/>
                            </span>
                        </Link>
                    )}
                </div>}
        </div></div>;
    }
}
