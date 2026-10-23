import {Link, useNavigate, useParams} from 'react-router-dom';

import {Badge, Button, Card, ErrorState, PageTitle, SkeletonCard, buttonClass} from '../../components/ui';
import {errorText} from '../../lib/format';
import {useDrawExam, useDrawInfo} from '../../queries/questionBank';
import {blockLabel} from './blockTypes';
import './create-from-bank.css';

/**
 * GV-TaoDeTuNganHang sub-screen: see how many blocks of each type remain, how many
 * non-overlapping draws are possible, then draw an exam and try it.
 *
 * ponytail: the matrix can't be edited here — the BE takes the subject's MA_TRAN.
 * Add an input when teachers need a non-standard exam.
 */
export default function DrawExam() {
    // Drawing by BANK is the main path. /draw-exam/:subject is kept for the blocks imported before banks existed.
    const {bankId = '', subject = ''} = useParams();
    const navigate = useNavigate();
    const info = useDrawInfo(bankId, subject);
    const draw = useDrawExam(bankId, subject);

    const back = <Link to='/question-bank' className={buttonClass({variant: 'ghost'})}>← Ngân hàng câu hỏi</Link>;

    if (info.isError) return <div className='vt-draw'>{back}
        <ErrorState title='Không tải được ngân hàng' description={errorText(info.error, 'Kiểm tra mạng rồi thử lại.')}
                    onRetry={() => info.refetch()} retrying={info.isFetching}/></div>;
    if (!info.data) return <div className='vt-draw'>{back}<SkeletonCard/></div>;

    const {stats, capacity} = info.data;
    const per = stats.per_type || {};
    const slots = capacity.slots || {};
    const runs = capacity.capacity || 0;
    const bottleneck = capacity.bottleneck;
    // Types present in the bank but absent from the matrix are never drawn — shown so the teacher sees unused stock.
    const unusedTypes = Object.keys(per).filter(t => !slots[t]);

    const onDraw = () => draw.mutate(undefined, {onSuccess: r => navigate('/do-exam/' + r.id)});

    return <div className='vt-draw'>
        {back}
        <PageTitle>Rút đề từ ngân hàng</PageTitle>
        <p className='vt-cfb-lead'>{capacity.subject || subject || 'Tất cả môn'}</p>

        {/* The only number that matters: how many times ONE student can retake without seeing an old block.
            The BE excludes blocks seen in earlier attempts, so this is a promise, not an estimate. */}
        {runs > 0
            ? <div className='vt-draw-note ok' role='status'>
                <b>Mỗi học sinh làm lại được {runs} lần</b>
                <span>Lượt sau không gặp lại khối nào của lượt trước.
                    {bottleneck && <> Nghẽn ở <b>{blockLabel(bottleneck[0])}</b> — soạn thêm loại này thì làm lại được nhiều lần hơn.</>}</span>
            </div>
            : <div className='vt-draw-note warn' role='status'>
                <b>Chưa đủ khối để rút một đề</b>
                <span>Cần thêm khối ở những loại đang thiếu bên dưới.</span>
            </div>}

        <Card flush className='vt-draw-card'>
            <div className='vt-draw-scroll'>
                <table className='vt-draw-table'>
                    <thead><tr>
                        <th scope='col'>Loại câu</th><th scope='col'>Mỗi đề cần</th><th scope='col'>Đang có</th><th scope='col'>Làm lại được</th>
                    </tr></thead>
                    <tbody>
                        {Object.keys(slots).map(t => {
                            const have = per[t] || 0, need = slots[t];
                            const retakes = Math.floor(have / need);
                            return <tr key={t}>
                                <th scope='row'>{blockLabel(t)}</th>
                                <td>{need}</td><td>{have}</td>
                                <td><Badge tone={retakes < 1 ? 'err' : retakes < 4 ? 'sun' : 'ok'}>{retakes}</Badge></td>
                            </tr>;
                        })}
                        {unusedTypes.map(t => <tr key={t} className='unused'>
                            <th scope='row'>{blockLabel(t)}</th>
                            <td colSpan={3}>{per[t]} khối, không nằm trong ma trận môn này nên không được rút</td>
                        </tr>)}
                    </tbody>
                </table>
            </div>
        </Card>

        {draw.isError && <p className='vt-cfb-err' role='alert'>{errorText(draw.error, 'Rút đề thất bại')}</p>}

        <div className='vt-draw-actions'>
            <Button variant='primary' size='lg' disabled={runs < 1 || draw.isPending} loading={draw.isPending} onClick={onDraw}>
                Rút một đề và làm thử
            </Button>
            <Link to={bankId ? '/import-exam?bank=' + bankId : '/import-exam'} className={buttonClass({variant: 'secondary', size: 'lg'})}>
                Nhập thêm đề
            </Link>
        </div>
        <p className='vt-cfb-hint'>Mỗi lượt làm là một đề khác, không lặp lại khối của lượt trước.</p>
    </div>;
}
