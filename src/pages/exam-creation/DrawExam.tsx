import {useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {Button, Header, Icon, Label, Message, Segment, Table} from 'semantic-ui-react';

import Loading from '../../components/Loading';
import Api from '../../services/api';
import type {BankCapacity, BankStats} from '../../types/exam';
import {TEN_LOAI} from './blockTypes';

const ten = (t: string) => (TEN_LOAI as Record<string, string>)[t] || t;

const loi = (e: any, mac_dinh: string) => (e && (e.error || e.message)) || mac_dinh;

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
export default function DrawExam() {
    const [stats, setStats] = useState<BankStats | null>(null);
    const [cap, setCap] = useState<BankCapacity | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [drawing, setDrawing] = useState(false);
    const [warn, setWarn] = useState<string | null>(null);
    const navigate = useNavigate();

    // Rút theo NGÂN HÀNG là đường chính. Đường cũ (/draw-exam/:subject) giữ lại
    // cho 80 khối import trước khi có model QuestionBank — chúng chỉ có subject.
    const {bankId = '', subject = ''} = useParams();

    // Ma trận vẫn phải theo môn: không lọc môn thì mặc định lấy ma trận Ngữ văn.
    const maTran = subject || 'Ngữ văn';

    // Có bank thì BE tự suy môn từ bank, FE khỏi đoán.
    const than = bankId ? {bank: bankId} : {subject, matran: maTran};

    useEffect(() => {
        let huy = false;
        (async () => {
            try {
                const q = bankId ? 'bank=' + bankId
                                 : 'subject=' + encodeURIComponent(subject);
                const [s, c] = await Promise.all([
                    Api.get('question_bank/stats?' + q) as Promise<BankStats>,
                    Api.post('question_bank/capacity', than) as Promise<BankCapacity>,
                ]);
                if (huy) return;
                setStats(s);
                setCap(c);
            } catch (e) {
                if (!huy) setError(loi(e, 'Không tải được ngân hàng'));
            }
        })();
        // Đổi bank/môn giữa chừng thì bỏ kết quả cũ, khỏi ghi đè lên cái mới.
        return () => { huy = true; };
    }, [bankId, subject]);

    const draw = async () => {
        setDrawing(true);
        setWarn(null);
        try {
            const r: any = await Api.post('question_bank/draw', than);
            // 409 (thiếu khối) về qua resolve chứ không throw: JsonResponse chỉ
            // gắn 'code' cho abort(), còn `return {...}, 409` giữ nguyên body.
            if (r.error) {
                setDrawing(false);
                return setWarn(r.error);
            }
            // ponytail: bug gốc — gọi `this.props.navigate`, nhưng withRouter chỉ
            // truyền match/location/history. Nút rút đề ném TypeError thay vì
            // chuyển trang. Function component dùng thẳng useNavigate.
            navigate('/do-exam/' + r.id);
        } catch (e) {
            setDrawing(false);
            setWarn(loi(e, 'Rút đề thất bại'));
        }
    };

    if (error) return <Message negative className='margin'>{error}</Message>;
    if (!stats || !cap) return <Loading/>;

    const per = stats.per_type || {};
    const slots = cap.slots || {};
    const lan = cap.capacity || 0;
    const nghen = cap.bottleneck;

    // Loại có trong ngân hàng nhưng không nằm trong ma trận -> không bao giờ
    // được rút. Hiện ra để giáo viên biết mình đang có hàng tồn.
    const ngoai = Object.keys(per).filter(t => !slots[t]);

    return <div className='margin'>
        <Header as='h2'>
            Rút đề từ ngân hàng
            <Header.Subheader>{cap.subject || subject || 'Tất cả môn'}</Header.Subheader>
        </Header>

        {/* Con số duy nhất đáng quan tâm: MỘT học sinh làm lại được mấy
            lần mà không gặp lại khối cũ. BE loại khối đã gặp ở lượt trước
            khi rút, nên đây là lời hứa giữ được, không phải ước lượng.
            Trùng đề giữa hai học sinh thì không sao — mỗi em một lượt riêng. */}
        {lan > 0
            ? <Message positive icon>
                <Icon name='check circle'/>
                <Message.Content>
                    <Message.Header>Mỗi học sinh làm lại được {lan} lần</Message.Header>
                    Lượt sau không gặp lại khối nào của lượt trước.
                    {nghen && <span> Nghẽn ở <b>{ten(nghen[0])}</b> — soạn
                        thêm loại này thì làm lại được nhiều lần hơn.</span>}
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
                    <Table.HeaderCell textAlign='center'>Làm lại được</Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {Object.keys(slots).map(t => {
                    const co = per[t] || 0, can = slots[t];
                    const duoc = Math.floor(co / can);
                    return <Table.Row key={t} negative={duoc < 1}>
                        <Table.Cell>{ten(t)}</Table.Cell>
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
                    <Table.Cell>{ten(t)}</Table.Cell>
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
                    onClick={draw}>
                <Icon name='random'/>
                Rút một đề và làm thử
            </Button>
            <div style={{marginTop: '.6em', color: '#888'}}>
                Mỗi lượt làm là một đề khác, không lặp lại khối của lượt trước.
            </div>
        </Segment>

        <Segment basic textAlign='center'>
            <Link to={bankId ? '/import-exam?bank=' + bankId : '/import-exam'}>
                Ngân hàng còn thiếu? Nhập thêm đề
            </Link>
        </Segment>
    </div>;
}
