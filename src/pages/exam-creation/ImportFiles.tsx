import {Link} from 'react-router-dom';

import {Badge, Button, Card, icons} from '../../components/ui';

export type FileRow = {
    key: string; file: File;
    status: 'queued' | 'reading' | 'ok' | 'error';
    exams: number; questions: number;
    /** Exams left out because the same exam is already in another file / already read. */
    skipped: number;
    problem?: string;
    /** Block bank only: blocks read, the file has a câu chùm (machine graded), exams refused for their «Cho biết». */
    blocks?: number;
    cluster?: boolean;
    shared?: number;
};

const TONE = {queued: 'draft', reading: 'draft', ok: 'ok', error: 'err'} as const;
const LABEL = {queued: 'Chờ đọc', reading: 'Đang đọc', ok: 'Ổn', error: 'Lỗi'} as const;

/** Shown for a failed row: bold title + what to do (BE messages are already turned into Vietnamese by `importErrorText`). */
export const problemTitle = (p: string) =>
    p.startsWith('Chỉ nhận') ? 'Chưa đúng loại file' : p.startsWith('File lớn hơn') ? 'File quá lớn' : 'Không đọc được file';

type Props = {
    rows: FileRow[];
    onRemove: (key: string) => void;
    onRetry: (key: string) => void;
    onReplace: (key: string) => void;
    onGuide: () => void;
    /** Hidden while rows are still being read. */
    onPreview: () => void;
    /** Block bank only (BF-04): the whole-exam bank of the same subject to send «Cho biết» files to, if there is one. */
    paperTarget?: {id: string; name: string} | null;
    onGoPaper?: () => void;
    blockBank?: boolean;
    /** Subject of the bank, named in the "no whole-exam bank yet" panel. */
    subject?: string;
};

/** IV2 (BF-05): one line per file, so a bad file never hides the good ones. */
export default function ImportFiles({rows, onRemove, onRetry, onReplace, onGuide, onPreview, paperTarget, onGoPaper, blockBank, subject}: Props) {
    const count = (s: FileRow['status']) => rows.filter(r => r.status === s).length;
    const busy = rows.some(r => r.status === 'queued' || r.status === 'reading');
    const exams = rows.reduce((n, r) => n + r.exams, 0);
    return <Card className='vt-imp-files' aria-label='Danh sách file'>
        <div className='vt-imp-files-head'>
            <h2 className='vt-imp-h2'>{rows.length} file đã chọn</h2>
            <span className='vt-imp-files-count'>
                {count('ok') > 0 && <Badge tone='ok'>{count('ok')} ổn</Badge>}
                {count('reading') + count('queued') > 0 && <Badge tone='draft'>{count('reading') + count('queued')} đang đọc</Badge>}
                {count('error') > 0 && <Badge tone='err'>{count('error')} {blockBank && rows.some(r => r.shared) ? 'không nhập được vào ngân hàng này' : 'lỗi'}</Badge>}
            </span>
        </div>
        <ul className='vt-imp-filelist'>
            {rows.map(r => <li key={r.key} className={'vt-imp-file vt-imp-file--' + r.status}>
                <span className='vt-imp-file-icon' aria-hidden='true'>
                    {r.status === 'ok' ? <icons.IconCheckCircle size={22} color='var(--vt-ok-ink)'/>
                        : r.status === 'error' ? <icons.IconWarn size={22}/> : <span className='vt-imp-file-spin'/>}
                </span>
                <div className='vt-imp-file-main'>
                    <b>{r.file.name}</b>
                    {r.status === 'ok' && <span>{r.exams} đề · {blockBank && r.blocks !== undefined ? `${r.blocks} khối${r.cluster ? '' : ' đọc được'}` : `${r.questions} câu đọc được`}
                        {r.cluster && <>. Phần IV · Câu chùm: <b>máy chấm</b>, 0,5 điểm mỗi ý.</>}
                        {r.skipped > 0 && <> · bỏ {r.skipped} đề đã có ở file khác</>}
                        {!!r.shared && <> · bỏ {r.shared} đề có khối “Cho biết”</>}</span>}
                    {r.status === 'error' && r.shared ? <>
                        <span className='vt-imp-file-err' role='alert'>
                            <b>Đề có khối “Cho biết”</b> (nguyên tử khối dùng chung cho cả đề). Ngân hàng theo khối cắt đề thành khối rời nên không giữ được phần này, học sinh sẽ không thấy.
                            {' '}Đề như thế cần nhập vào <b>ngân hàng nguyên đề</b>: rút nguyên đề, “Cho biết” luôn hiện đầu bài.</span>
                        <span className='vt-imp-file-acts'>
                            {paperTarget && <Button variant='secondary' size='sm' onClick={onGoPaper}>Nhập vào “{paperTarget.name}”</Button>}
                            <button type='button' className='vt-imp-link' onClick={() => onRemove(r.key)}>Bỏ file</button>
                        </span></> : null}
                    {(r.status === 'reading' || r.status === 'queued') && <span aria-live='polite'>
                        {r.status === 'reading' ? 'Đang đọc…' : 'Đang chờ đến lượt…'}</span>}
                    {r.status === 'error' && !r.shared && r.problem && <>
                        <span className='vt-imp-file-err' role='alert'>
                            <b>{problemTitle(r.problem)}</b> {r.problem.replace(/^Không đọc được file: /, '')}</span>
                        <span className='vt-imp-file-acts'>
                            <button type='button' className='vt-imp-link' onClick={() => onRemove(r.key)}>Bỏ file</button>
                            <Button variant='secondary' size='sm' onClick={() => onReplace(r.key)}>Chọn lại file</Button>
                            {/unreadable|không đọc được/i.test(r.problem) && <>
                                <Button variant='secondary' size='sm' onClick={() => onRetry(r.key)}>Thử lại</Button>
                                <button type='button' className='vt-imp-link' onClick={onGuide}>Lỗi thường gặp</button>
                            </>}
                        </span></>}
                </div>
                <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
            </li>)}
        </ul>
        {rows.some(r => r.shared) && <div className='vt-imp-nopaper'>
            <b>Chưa có ngân hàng nguyên đề{subject ? ` môn ${subject.replace(/^môn\s+/i, '')}` : ' môn này'}?</b>
            <span>Tạo ở trang Ngân hàng câu hỏi, chọn loại “Nguyên đề”, rồi nhập lại file này.</span>
            <Link to='/question-bank' className='vt-imp-link'>Tạo ngân hàng nguyên đề</Link>
        </div>}
        <div className='vt-imp-files-foot'>
            <span className='vt-imp-hint'>
                {busy ? `Đọc xong ${exams} đề · còn ${rows.filter(r => r.status === 'queued' || r.status === 'reading').length} file đang đọc`
                    : rows.some(r => r.shared) ? `Đọc xong ${exams} đề nhập được`
                    : 'File lỗi không chặn các file khác. Bỏ file lỗi hoặc sửa rồi thêm lại sau.'}
            </span>
            <Button variant='primary' disabled={busy || exams === 0} onClick={onPreview}>Xem trước {exams} đề</Button>
        </div>
    </Card>;
}
