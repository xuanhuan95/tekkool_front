import {useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {Button, Header, Icon, Label, Message, Segment, Table} from 'semantic-ui-react';

import Loading from '../../components/Loading';
import Api from '../../services/api';
import type {BankCapacity, BankStats} from '../../types/exam';
import {blockLabel} from './blockTypes';

const errorMessage = (e: any, fallback: string) => (e && (e.error || e.message)) || fallback;

/**
 * Draw an exam from the question bank.
 *
 * The bank used to be a one-way door: you could import into it but not take
 * anything out. This screen is the way out — see how many blocks of each type
 * remain, how many non-overlapping draws are possible, then draw an exam.
 *
 * ponytail: the matrix can't be edited here yet — the BE takes the subject's
 * MA_TRAN (Excel table). Add an input when teachers need a non-standard exam.
 */
export default function DrawExam() {
    const [stats, setStats] = useState<BankStats | null>(null);
    const [capacity, setCapacity] = useState<BankCapacity | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [drawing, setDrawing] = useState(false);
    const [warn, setWarn] = useState<string | null>(null);
    const navigate = useNavigate();

    // Drawing by BANK is the main path. The old route (/draw-exam/:subject) is kept
    // for the 80 blocks imported before the QuestionBank model existed — they only have a subject.
    const {bankId = '', subject = ''} = useParams();

    // The matrix still depends on the subject: with no subject filter, default to the Ngữ văn matrix.
    const matrixSubject = subject || 'Ngữ văn';

    // With a bank, the BE infers the subject from it, so the FE doesn't have to guess.
    const requestBody = bankId ? {bank: bankId} : {subject, matran: matrixSubject};

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const q = bankId ? 'bank=' + bankId
                                 : 'subject=' + encodeURIComponent(subject);
                const [s, c] = await Promise.all([
                    Api.get('question_bank/stats?' + q) as Promise<BankStats>,
                    Api.post('question_bank/capacity', requestBody) as Promise<BankCapacity>,
                ]);
                if (cancelled) return;
                setStats(s);
                setCapacity(c);
            } catch (e) {
                if (!cancelled) setError(errorMessage(e, 'Không tải được ngân hàng'));
            }
        })();
        // If the bank/subject changes midway, drop the stale result so it doesn't overwrite the new one.
        return () => { cancelled = true; };
    }, [bankId, subject]);

    const draw = async () => {
        setDrawing(true);
        setWarn(null);
        try {
            const r: any = await Api.post('question_bank/draw', requestBody);
            // 409 (not enough blocks) arrives via resolve, not throw: JsonResponse only
            // attaches 'code' for abort(), while `return {...}, 409` keeps the body as is.
            if (r.error) {
                setDrawing(false);
                return setWarn(r.error);
            }
            // ponytail: original bug — it called `this.props.navigate`, but withRouter only
            // passes match/location/history. The draw button threw a TypeError instead of
            // navigating. A function component uses useNavigate directly.
            navigate('/do-exam/' + r.id);
        } catch (e) {
            setDrawing(false);
            setWarn(errorMessage(e, 'Rút đề thất bại'));
        }
    };

    if (error) return <Message negative className='margin'>{error}</Message>;
    if (!stats || !capacity) return <Loading/>;

    const per = stats.per_type || {};
    const slots = capacity.slots || {};
    const runs = capacity.capacity || 0;
    const bottleneck = capacity.bottleneck;

    // Types present in the bank but absent from the matrix -> never drawn.
    // Shown so the teacher knows there is unused stock.
    const unusedTypes = Object.keys(per).filter(t => !slots[t]);

    return <div className='margin'>
        <Header as='h2'>
            Rút đề từ ngân hàng
            <Header.Subheader>{capacity.subject || subject || 'Tất cả môn'}</Header.Subheader>
        </Header>

        {/* The only number that matters: how many times ONE student can retake
            without seeing an old block again. The BE excludes blocks seen in
            earlier attempts when drawing, so this is a promise it can keep, not an estimate.
            Two students getting the same exam is fine — each has their own attempt. */}
        {runs > 0
            ? <Message positive icon>
                <Icon name='check circle'/>
                <Message.Content>
                    <Message.Header>Mỗi học sinh làm lại được {runs} lần</Message.Header>
                    Lượt sau không gặp lại khối nào của lượt trước.
                    {bottleneck && <span> Nghẽn ở <b>{blockLabel(bottleneck[0])}</b> — soạn
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
                    const have = per[t] || 0, need = slots[t];
                    const retakes = Math.floor(have / need);
                    return <Table.Row key={t} negative={retakes < 1}>
                        <Table.Cell>{blockLabel(t)}</Table.Cell>
                        <Table.Cell textAlign='center'>{need}</Table.Cell>
                        <Table.Cell textAlign='center'>{have}</Table.Cell>
                        <Table.Cell textAlign='center'>
                            <Label circular color={retakes < 1 ? 'red' : retakes < 4 ? 'yellow' : 'green'}>
                                {retakes}
                            </Label>
                        </Table.Cell>
                    </Table.Row>;
                })}
                {unusedTypes.map(t => <Table.Row key={t} warning>
                    <Table.Cell>{blockLabel(t)}</Table.Cell>
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
                    disabled={runs < 1 || drawing} loading={drawing}
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
