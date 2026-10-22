import {useRef} from 'react';

import {Button, Modal} from '../../components/ui';
import {IconAlert, IconWarn} from '../../components/ui/icons';

type SubmitDialogProps = {
    open: boolean;
    answered: number;
    total: number;
    /** Numbers of questions not answered yet. */
    unanswered: number[];
    flagged: number;
    submitting: boolean;
    /** Why the last submit failed (network, unsaved answers, 409...). */
    error?: string | null;
    onJump: (number: number) => void;
    onCancel: () => void;
    onConfirm: () => void;
};

/**
 * "Nộp bài?" (HS-XacNhanNop): answered count, chips of the questions left (tap = back to that
 * question), flagged count, red "cannot edit after submitting". Focus starts on "Làm tiếp" so a
 * stray Enter never submits.
 */
export default function SubmitDialog({open, answered, total, unanswered, flagged, submitting, error,
                                      onJump, onCancel, onConfirm}: SubmitDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const cancel = submitting ? undefined : onCancel;
    return <Modal open={open} onClose={cancel} title='Nộp bài?' initialFocus={cancelRef}
                  footer={<>
                      <Button ref={cancelRef} variant='secondary' onClick={cancel} disabled={submitting}>Làm tiếp</Button>
                      <Button variant='primary' loading={submitting} onClick={onConfirm}>
                          {error ? 'Nộp lại' : 'Nộp bài'}</Button>
                  </>}>
        <div className='vt-submit-rows'>
            <div className='vt-submit-row'>
                <div className='vt-submit-line'><span>Đã làm</span><b>{answered} / {total}</b></div>
            </div>
            {unanswered.length > 0 && <div className='vt-submit-row'>
                <div className='vt-submit-line'><span>Chưa làm</span><b>{unanswered.length} câu</b></div>
                <nav aria-label='Quay lại câu chưa làm' className='vt-submit-chips'>
                    {unanswered.map(n => <button key={n} type='button' className='vt-submit-chip'
                                                 disabled={submitting} onClick={() => onJump(n)}>Câu {n} ›</button>)}
                </nav>
                <span className='vt-submit-hint'>Bấm để quay lại đúng câu trong đề</span>
            </div>}
            {flagged > 0 && <div className='vt-submit-row'>
                <div className='vt-submit-line'>
                    <span><span aria-hidden='true' className='vt-submit-flagdot'/>Đánh dấu xem lại</span>
                    <b>{flagged} câu</b>
                </div>
            </div>}
        </div>
        {error
            ? <div role='alert' className='vt-submit-warn'><IconAlert size={16}/>{error}</div>
            : <div className='vt-submit-warn'><IconWarn/>Sau khi nộp không sửa được bài làm.</div>}
    </Modal>;
}
