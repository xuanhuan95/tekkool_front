import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {Icon, Loader} from 'semantic-ui-react';
import Api from '../../services/api';
import {fmtDate, fmtMoney} from './fmt';

const STATUS = {
    PAID: {cls: 'free', text: 'Đã thanh toán', icon: 'check circle'},
    PENDING: {cls: 'paid', text: 'Chờ thanh toán', icon: 'clock outline'},
    FAILED: {cls: 'err', text: 'Thất bại', icon: 'times circle'},
};

/** Lịch sử thanh toán, mỗi đơn chỉ thẳng sang bài đã làm bằng đơn đó. */
export default class Billing extends Component {
    state = {orders: null, error: null};

    componentDidMount = async () => {
        try {
            this.setState({orders: await Api.get('payment/history')});
        } catch (e) {
            this.setState({error: (e && (e.error || e.message)) || 'Không tải được lịch sử'});
        }
    };

    render() {
        let {orders, error} = this.state;

        if (error) return <div className='tk'><div className='tk-wrap'>
            <div className='tk-empty'>
                <Icon name='exclamation triangle'/>
                <div className='tk-empty-title'>Có lỗi xảy ra</div>
                <div>{error}</div>
            </div>
        </div></div>;

        if (!orders) return <div className='tk'><div className='tk-wrap'>
            <Loader active inline='centered'/>
        </div></div>;

        // Chỉ cộng đơn ĐÃ trả — đơn treo chưa mất tiền, cộng vào là báo sai.
        let paid = orders.filter(o => o.status === 'PAID');
        let total = paid.reduce((n, o) => n + (o.amount || 0), 0);

        return <div className='tk'><div className='tk-wrap'>
            <h1 className='tk-title'>Lịch sử thanh toán</h1>
            <p className='tk-sub'>
                Đã chi <strong>{fmtMoney(total)}</strong> cho {paid.length} lượt thi.
            </p>

            {!orders.length
                ? <div className='tk-empty'>
                    <Icon name='credit card outline'/>
                    <div className='tk-empty-title'>Chưa có giao dịch nào</div>
                    <div>Các đề miễn phí không sinh hoá đơn.</div>
                </div>
                : <div className='tk-exam-list'>
                    {orders.map(o => {
                        let st = STATUS[o.status] || {cls: 'paid', text: o.status, icon: 'question circle'};
                        let name = (o.items || []).map(i => i.name).join(', ') || 'Lượt thi';

                        // Đơn đã dẫn tới một bài nộp -> cả dòng là link sang bài đó.
                        // Chưa có bài (chưa làm / đang làm dở) thì để thẻ tĩnh.
                        let body = <React.Fragment>
                            <span className='tk-exam-icon'>
                                <Icon name='file alternate outline' size='large'/>
                            </span>
                            <span className='tk-exam-main'>
                                <span className='tk-exam-name'>{name}</span>
                                <span className='tk-exam-meta'>
                                    <span><Icon name='calendar outline'/> {fmtDate(o.created_at)}</span>
                                    <span><Icon name='hashtag'/> {o.invoice_number}</span>
                                    <span><Icon name={st.icon}/> {st.text}</span>
                                    {o.submission_id
                                        ? <span><Icon name='clipboard check'/> Xem bài đã làm</span>
                                        : o.consumed_at
                                            ? <span><Icon name='check'/> đã dùng</span>
                                            : <span><Icon name='hourglass half'/> chưa dùng</span>}
                                </span>
                            </span>
                            <span className={'tk-price ' + (o.status === 'PAID' ? 'free' : 'paid')}>
                                {fmtMoney(o.amount)}
                            </span>
                        </React.Fragment>;

                        return o.submission_id
                            ? <Link key={o.invoice_number} className='tk-exam'
                                    to={'/my-exams/' + o.submission_id}>{body}</Link>
                            : <div key={o.invoice_number} className='tk-exam'
                                   style={{cursor: 'default'}}>{body}</div>;
                    })}
                </div>}
        </div></div>;
    }
}
