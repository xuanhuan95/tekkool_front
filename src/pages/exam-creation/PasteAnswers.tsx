import {useState} from 'react';

import {Badge, Button, Modal, Table, TextArea} from '../../components/ui';
import type {Column} from '../../components/ui';
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
    const columns: Column<PasteRow>[] = [
        {key: 'no', header: 'Câu', render: r => 'Câu ' + r.no},
        {key: 'type', header: 'Dạng', render: r => TYPE_NAME[r.type] || r.type},
        {key: 'now', header: 'Hiện tại', render: r => r.now || 'Chưa có'},
        {key: 'next', header: 'Sẽ thành', render: r => r.next},
        {key: 'status', header: 'Kết quả', render: r => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>},
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
        <TextArea label='Chuỗi đáp án' value={text} rows={3} placeholder='1B 2C 3A 4D 21ĐSSĐ 25: 3,5'
                  hint='Số câu theo thứ tự trên màn hình. Trắc nghiệm: 1B 2C 3A. Đúng/Sai: 21ĐSSĐ (4 ký tự). Trả lời ngắn: 25: 3,5 (có dấu hai chấm).'
                  onChange={ev => { setText(ev.target.value); setReply(null); }}/>
        {error && <p role='alert' className='vt-imp-flag err'>{error}</p>}
        {reply && <>
            <p className='vt-imp-paste-sum'>
                <b>{count('new')}</b> thêm mới · <b>{count('change')}</b> đổi · <b>{count('same')}</b> giữ nguyên · <b>{reply.issues.length}</b> lỗi, sẽ bỏ qua
            </p>
            {rows.length > 0 && <Table<PasteRow> caption='Xem trước đáp án' columns={columns} rows={rows} rowKey={r => String(r.no)} bare/>}
            {reply.issues.length > 0 && <ul className='vt-imp-paste-bad'>
                {reply.issues.map((i, k) => <li key={k}><Badge tone='sun'>Bỏ qua</Badge> {i.message}</li>)}
            </ul>}
        </>}
    </Modal>;
}
