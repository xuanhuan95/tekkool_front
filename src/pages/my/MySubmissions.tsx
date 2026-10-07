import {Component} from 'react';
import Loading from '../../components/Loading';
import {Link} from 'react-router-dom';
import {Icon} from 'semantic-ui-react';
import Api from '../../services/api';
import type {Submission} from '../../types/submission';
import {fmtDate, fmtDuration, ScoreLabel} from './fmt';

/** List of attempts the student has submitted. */
type State = {subs: Submission[] | null; error: string | null};

export default class MySubmissions extends Component<{}, State> {
    state: State = {subs: null, error: null};

    componentDidMount = async () => {
        try {
            this.setState({subs: await Api.get('exam/my_submissions')});
        } catch (e: any) {
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
            <Loading/>
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
                                    {/* Time ran out and the machine submitted -> the student must know why the attempt stopped midway. */}
                                    {s.auto_submitted &&
                                    <span><Icon name='hourglass end'/> hết giờ, máy nộp</span>}
                                    {/* ponytail: dropped the invoice_number block. The BE does not return this field
                                        on exam/my_submissions — invoice_number only lives on
                                        Payment. Since selling by PACKAGE, one order is used for many exams so
                                        an attempt cannot point back to an order; invoices are at /billing. */}
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
