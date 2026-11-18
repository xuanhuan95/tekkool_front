import {Badge, Button, Card, icons} from '../../components/ui';

export type FileRow = {
    key: string; file: File;
    status: 'queued' | 'reading' | 'ok' | 'error';
    exams: number; questions: number;
    /** Exams left out because the same exam is already in another file / already read. */
    skipped: number;
    problem?: string;
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
};

/** IV2 (BF-05): one line per file, so a bad file never hides the good ones. */
export default function ImportFiles({rows, onRemove, onRetry, onReplace, onGuide, onPreview}: Props) {
    const count = (s: FileRow['status']) => rows.filter(r => r.status === s).length;
    const busy = rows.some(r => r.status === 'queued' || r.status === 'reading');
    const exams = rows.reduce((n, r) => n + r.exams, 0);
    return <Card className='vt-imp-files' aria-label='Danh sách file'>
        <div className='vt-imp-files-head'>
            <h2 className='vt-imp-h2'>{rows.length} file đã chọn</h2>
            <span className='vt-imp-files-count'>
                {count('ok') > 0 && <Badge tone='ok'>{count('ok')} ổn</Badge>}
                {count('reading') + count('queued') > 0 && <Badge tone='draft'>{count('reading') + count('queued')} đang đọc</Badge>}
                {count('error') > 0 && <Badge tone='err'>{count('error')} lỗi</Badge>}
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
                    {r.status === 'ok' && <span>{r.exams} đề · {r.questions} câu đọc được
                        {r.skipped > 0 && <> · bỏ {r.skipped} đề đã có ở file khác</>}</span>}
                    {(r.status === 'reading' || r.status === 'queued') && <span aria-live='polite'>
                        {r.status === 'reading' ? 'Đang đọc…' : 'Đang chờ đến lượt…'}</span>}
                    {r.status === 'error' && r.problem && <>
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
        <div className='vt-imp-files-foot'>
            <span className='vt-imp-hint'>
                {busy ? 'Đang đọc từng file, vẫn chọn thêm file được.' : 'File lỗi không chặn các file khác. Bỏ file lỗi hoặc sửa rồi thêm lại sau.'}
            </span>
            <Button variant='primary' disabled={busy || exams === 0} onClick={onPreview}>Xem trước {exams} đề</Button>
        </div>
    </Card>;
}
