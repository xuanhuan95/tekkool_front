import {useState} from 'react';

import {Badge, Button, Modal, Table, TextArea} from '../../components/ui';
import Api from '../../services/api';
import {errorText} from '../../lib/format';
import {answerFrame, pasteRows} from './importRules';
import type {ImportedExam, PasteRow, PastedAnswers} from './importRules';

type Reply = {answers: PastedAnswers; applied: number; issues: Array<{code: string; message: string}>};

const STATUS = {
    new: {tone: 'ok', text: 'Thêm mới'}, change: {tone: 'sun', text: 'Đổi'}, same: {tone: 'draft', text: 'Giữ nguyên'},
} as const;
const TYPE_NAME: Record<string, string> = {MultipleChoice: 'Trắc nghiệm', TrueFalse: 'Đúng/Sai', FillBlank: 'Trả lời ngắn'};

/**
 * "Dán đáp án nhanh" (IV2-SuaTaiCho §2): the teacher pastes `1B 2C 21ĐSSĐ 25 3,5`, the BE reads it (`import_docx/answers`),
 * and this shows what would change per question BEFORE anything is written. Lines the BE could not read are skipped.
 */
export default function PasteAnswers({exam, open, onClose, onApply}: {
    exam: ImportedExam; open: boolean; onClose: () => void; onApply: (a: PastedAnswers) => void;
}) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reply, setReply] = useState<Reply | null>(null);

    const close = () => { setReply(null); setError(null); onClose(); };

    const read = async () => {
        setBusy(true); setError(null);
        try { setReply(await Api.post<Reply>('import_docx/answers', {questions: answerFrame(exam), text})); }
        catch (e) { setReply(null); setError(errorText(e, 'Không đọc được chuỗi đáp án.')); }
        finally { setBusy(false); }
    };

    const rows = reply ? pasteRows(exam, reply.answers) : [];
    const count = (s: PasteRow['status']) => rows.filter(r => r.status === s).length;
    // One row per question, then the lines the BE could not read as red rows ("Câu 40 … Không có Câu 40").
    const tableRows = [
        ...rows.map(r => ({key: 'q' + r.no, no: 'Câu ' + r.no, type: TYPE_NAME[r.type] || r.type, now: r.now || 'Chưa có', next: r.next, ...STATUS[r.status]})),
        ...(reply?.issues || []).map((i, k) => {
            const m = /^Câu (\d+)[:,]?\s*(.*)$/.exec(i.message);
            return {key: 'e' + k, no: m ? 'Câu ' + m[1] : '—', type: '—', now: '—', next: '—', tone: 'err' as const, text: m ? m[2] || i.message : i.message};
        }),
    ];
    return <Modal open={open} onClose={close} title='Dán đáp án nhanh' size='md'
                  footer={<>
                      <Button variant='secondary' onClick={close}>Huỷ</Button>
                      {reply
                          ? <Button variant='primary' disabled={!reply.applied} onClick={() => { onApply(reply.answers); close(); }}>
                              {`Áp dụng ${reply.applied} đáp án`}
                          </Button>
                          : <Button variant='primary' loading={busy} disabled={!text.trim()} onClick={read}>Xem trước</Button>}
                  </>}>
        <div className='vt-imp-paste-ta'>
            <TextArea label='Chuỗi đáp án' value={text} rows={3} placeholder='1B 2C 3A 4D 21ĐSSĐ 25 3,5'
                      hint='Số câu theo thứ tự trên màn hình. Trắc nghiệm: 1B 2C 3A. Đúng/Sai: 21ĐSSĐ (4 ký tự). Trả lời ngắn: 25 3,5.'
                      onChange={ev => { setText(ev.target.value); setReply(null); }}/>
        </div>
        {error && <p role='alert' className='vt-imp-flag err'>{error}</p>}
        {reply && <>
            <p className='vt-imp-paste-sum' aria-label='Tóm tắt xem trước'>
                <Badge tone='ok'>{count('new')} thêm mới</Badge> <Badge tone='sun'>{count('change')} đổi</Badge>{' '}
                <Badge tone='draft'>{count('same')} giữ nguyên</Badge> <Badge tone='err'>{reply.issues.length} lỗi, sẽ bỏ qua</Badge>
            </p>
            {tableRows.length > 0 && <Table bare caption='Xem trước đáp án' rows={tableRows} rowKey={r => r.key} minWidth={520} columns={[
                {key: 'no', header: 'Câu', render: r => <b>{r.no}</b>},
                {key: 'type', header: 'Dạng', render: r => r.type},
                {key: 'now', header: 'Hiện tại', render: r => r.now},
                {key: 'next', header: 'Sẽ thành', render: r => <b>{r.next}</b>},
                {key: 'st', header: 'Kết quả', render: r => <Badge tone={r.tone}>{r.text}</Badge>},
            ]}/>}
        </>}
    </Modal>;
}
