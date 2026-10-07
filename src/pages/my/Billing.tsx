import React, {Component} from 'react';
import Loading from '../../components/Loading';
import {Icon} from 'semantic-ui-react';
import type {SemanticICONS} from 'semantic-ui-react';
import Api from '../../services/api';
import type {Payment} from '../../types/payment';
import {fmtDate, fmtMoney} from './fmt';

type StatusStyle = {cls: string; text: string; icon: SemanticICONS};

const STATUS: Record<string, StatusStyle> = {
    PAID: {cls: 'free', text: 'Đã thanh toán', icon: 'check circle'},
    PENDING: {cls: 'paid', text: 'Chờ thanh toán', icon: 'clock outline'},
    FAILED: {cls: 'err', text: 'Thất bại', icon: 'times circle'},
};

/** Payment history; each order points straight to the attempt made with it. */
type State = {orders: Payment[] | null; error: string | null};

export default class Billing extends Component<{}, State> {
    state: State = {orders: null, error: null};

    componentDidMount = async () => {
        try {
            this.setState({orders: await Api.get('payment/history')});
        } catch (e: any) {
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
            <Loading/>
        </div></div>;

        // Only sum orders that are PAID — a pending order has not cost money yet, counting it would overstate.
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

                        // ponytail: NO link to the attempt any more. An order is now
                        // N turns usable on many different exams, so it cannot point at
                        // a single attempt — attempt history lives at /my-exams.
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
                                </span>
                            </span>
                            <span className={'tk-price ' + (o.status === 'PAID' ? 'free' : 'paid')}>
                                {fmtMoney(o.amount)}
                            </span>
                        </React.Fragment>;

                        return <div key={o.invoice_number} className='tk-exam'
                                    style={{cursor: 'default'}}>{body}</div>;
                    })}
                </div>}
        </div></div>;
    }
}
