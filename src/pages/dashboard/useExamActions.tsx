import {useState} from 'react';
import type {ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {Button, ConfirmDialog, Modal, notify} from '../../components/ui';
import {errorText} from '../../lib/format';
import Api from '../../services/api';
import type {ExamSummary, Folder} from '../../types/exam';
import Default from '../exam-creation/Default';
import {examName, isPublished} from './examMeta';

/** The exam row / exam page both act on this much of an exam. `from` = id of the subject it sits in now. */
export type ExamRef = Pick<ExamSummary, 'id' | 'name' | 'status' | 'has_submissions'> & {from: string};
type Pending = {kind: 'delete' | 'unpublish'; exam: ExamRef; submissions?: number};

/**
 * Publish / back to draft / delete / duplicate / move of ONE exam, with the same confirmations on the subject
 * screen (⋯ menu of a row) and on `/exam/:id`. `dialogs` must be rendered once by the screen that uses it.
 * ponytail: the "bài nộp" number for the unpublish warning still comes from to_grade; the 409 on delete stays a safety net.
 */
export function useExamActions(subjects: Folder[], onDeleted?: () => void) {
    const qc = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState<Pending | null>(null);
    const [moving, setMoving] = useState<ExamRef | null>(null);

    const refresh = () => {
        qc.invalidateQueries({queryKey: ['exam']});          // lists + detail
        qc.invalidateQueries({queryKey: ['folder', 'list']}); // subject counts
    };
    const run = async (fn: () => Promise<void>, failTitle: string) => {
        setBusy(true);
        try { await fn(); refresh(); }
        catch (e) { notify.error(failTitle, errorText(e, 'Thử lại sau.')); }
        finally { setBusy(false); setPending(null); setMoving(null); }
    };
    const subjectName = (id: string) => subjects.find(s => s.id === id)?.name;

    const publish = (e: ExamRef) => run(async () => {
        try {
            await Api.post(`exam/publish/${e.id}`);
        } catch (err) {
            const n = (err as {invalid_questions?: unknown[]})?.invalid_questions?.length;
            throw n ? {error: `Đề còn ${n} chỗ phải sửa (mở Sửa để xem). Đề vẫn là Nháp.`} : err;
        }
        notify.success('Đã xuất bản', `Học sinh thấy đề này từ bây giờ, trong môn ${subjectName(e.from)}.`);
    }, 'Chưa xuất bản được');

    const unpublish = (e: ExamRef) => run(async () => {
        await Api.post(`exam/unpublish/${e.id}`);
        notify.success('Đã chuyển về nháp', 'Học sinh không còn thấy đề này.');
    }, 'Không chuyển về nháp được');

    // Light warning only when the exam already has submissions (to_grade lists them); none → switch at once.
    const askUnpublish = async (e: ExamRef) => {
        setBusy(true);
        try {
            const subs = await Api.get<unknown[]>(`exam/to_grade/${e.id}`);
            if (subs.length) { setPending({kind: 'unpublish', exam: e, submissions: subs.length}); setBusy(false); }
            else { setBusy(false); unpublish(e); }
        } catch (err) { setBusy(false); notify.error('Không chuyển về nháp được', errorText(err, 'Thử lại sau.')); }
    };

    const remove = (e: ExamRef) => run(async () => {
        await Api.post(`exam/delete/${e.id}`);
        notify.success('Đã xoá đề', examName(e));
        onDeleted?.();
    }, 'Không xoá được đề');

    const duplicate = (e: ExamRef) => run(async () => {
        await Api.post(`exam/duplicate/${e.id}`, Default.exam());
        notify.success('Đã nhân bản đề', examName(e));
    }, 'Không nhân bản được');

    const move = (e: ExamRef, folderId: string) => run(async () => {
        await Api.post('exam/move_to_folder', {examId: e.id, folderId});
        notify.success('Đã chuyển đề', `Sang môn ${subjectName(folderId)}.`);
    }, 'Không chuyển được đề');

    const dialogs: ReactNode = <>
        <ConfirmDialog open={pending?.kind === 'delete'} tone='danger' loading={busy}
                       title='Xoá đề này?' cancelLabel='Giữ lại' confirmLabel='Xoá đề'
                       message={pending && <span><b>{examName(pending.exam)}</b><br/>
                           {isPublished(pending.exam) ? 'Đã xuất bản' : 'Nháp'}. Xoá rồi không lấy lại được. Chỉ đề chưa có bài nộp mới xoá được.</span>}
                       onCancel={() => setPending(null)} onConfirm={() => pending && remove(pending.exam)}/>
        <ConfirmDialog open={pending?.kind === 'unpublish'} loading={busy}
                       title={pending ? `Chuyển “${examName(pending.exam)}” về nháp?` : ''}
                       cancelLabel='Để nguyên' confirmLabel='Chuyển về nháp'
                       message={pending && <span>Đề đã có <b>{pending.submissions} bài nộp</b>. Học sinh sẽ không còn thấy và không làm được đề này. Bài đã nộp vẫn giữ.</span>}
                       onCancel={() => setPending(null)} onConfirm={() => pending && unpublish(pending.exam)}/>
        <Modal open={!!moving} onClose={busy ? undefined : () => setMoving(null)} title='Chuyển sang môn nào?' mobileSheet
               footer={<Button variant='secondary' disabled={busy} onClick={() => setMoving(null)}>Huỷ</Button>}>
            {moving && <>
                <p className='vt-th-move-name'>{examName(moving)}</p>
                <ul className='vt-th-move-list'>
                    {subjects.filter(s => s.id !== moving.from && !s.hidden).map(s =>
                        <li key={s.id}><Button variant='secondary' block disabled={busy} onClick={() => move(moving, s.id)}>{s.name}</Button></li>)}
                </ul>
            </>}
        </Modal>
    </>;

    return {
        busy, dialogs, publish, askUnpublish, duplicate,
        askDelete: (e: ExamRef) => setPending({kind: 'delete', exam: e}),
        askMove: (e: ExamRef) => setMoving(e),
    };
}
