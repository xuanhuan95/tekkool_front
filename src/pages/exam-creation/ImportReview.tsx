import {Badge, cx} from '../../components/ui';
import {formatDecimal} from '../../lib/format';
import {blocksOf} from './dupRules';
import {kindOf, partRows, type ImportIssue, type ImportedExam} from './importRules';

/** What the list shows next to an exam. `note` = why it is ticked off (already in the bank, …). */
export type ReviewRow = {
    exam: ImportedExam; file: string; picked: boolean; questions: number; blocks: number;
    severe: number; light: number; missing: number; dupBlocks: number; sameInImport: number;
    state?: 'saved' | 'error' | 'pending';
    note?: 'exists' | 'other-bank';
};

type ListProps = {
    rows: ReviewRow[]; openId: string | null; onOpen: (id: string) => void; onToggle: (id: string) => void; onToggleAll: () => void;
    /** Whole-exam banks keep their sentences; the block count only means something for a block bank. */
    blockBank: boolean;
};

/** Left column: ticks + status per exam, grouped by file (artboard import-preview). */
export function ReviewList({rows, openId, onOpen, onToggle, onToggleAll, blockBank}: ListProps) {
    const chosen = rows.filter(r => r.picked).length;
    const files = [...new Set(rows.map(r => r.file))];
    return <nav className='vt-rv-list' aria-label='Các đề đã đọc'>
        <label className='vt-imp-check'>
            <input type='checkbox' checked={chosen === rows.length}
                   ref={el => { if (el) el.indeterminate = chosen > 0 && chosen < rows.length; }} onChange={onToggleAll}/>
            {rows.length} đề — đã chọn {chosen}
        </label>
        {files.map(f => <div key={f} className='vt-rv-file'>
            {files.length > 1 || rows.length > 1 ? <div className='vt-rv-file-name'>{f}</div> : null}
            {rows.filter(r => r.file === f).map(r => {
                const on = openId === r.exam.id;
                return <div key={r.exam.id} className={cx('vt-rv-item', on && 'on', !r.picked && 'off')}>
                    <label className='vt-imp-hit'>
                        <input type='checkbox' checked={r.picked} aria-label={'Chọn ' + r.exam.name} onChange={() => onToggle(r.exam.id)}/>
                    </label>
                    <button type='button' className='vt-rv-open' aria-current={on ? 'true' : undefined} onClick={() => onOpen(r.exam.id)}>
                        <span className='vt-rv-name'>{r.exam.name}</span>
                        <span className='vt-rv-meta'>· {blockBank ? `${r.blocks} khối` : `${r.questions} câu`}</span>
                    </button>
                    <span className='vt-rv-badges'>
                        {r.note === 'exists' && <Badge tone='err'>Đã có</Badge>}
                        {r.note === 'other-bank' && <Badge tone='err'>Ở ngân hàng khác</Badge>}
                        {r.state === 'saved' && <Badge tone='ok'>Đã lưu</Badge>}
                        {r.state === 'error' && <Badge tone='err'>Lỗi khi lưu</Badge>}
                        {r.state === 'pending' && <Badge tone='draft'>Chưa lưu</Badge>}
                        {r.dupBlocks > 0 && <Badge tone='sun'>{r.dupBlocks} khối trùng</Badge>}
                        {r.sameInImport > 0 && <Badge tone='sun'>Trùng nhau</Badge>}
                        {r.severe > 0 && <Badge tone='err'>{r.severe} cảnh báo nặng</Badge>}
                        {r.missing > 0 && <Badge tone='err'>{r.missing} thiếu đáp án</Badge>}
                        {r.light > 0 && <Badge tone='sun'>{r.light} cảnh báo nhẹ</Badge>}
                    </span>
                </div>;
            })}
        </div>)}
    </nav>;
}

/** "2 × Đọc hiểu, 1 × Trắc nghiệm": what the exam is cut into (block bank only). Kinds come from the question types read on screen. */
function cutLabel(exam: ImportedExam, section: number) {
    const count = new Map<string, number>();
    for (const b of blocksOf(exam).filter(x => x.section === section)) {
        const first = b.questions[0];
        const label = b.questions.length > 1 && first.data.passageId && first.type !== 'TrueFalse' && !/chùm/i.test(kindOf(first)) ? 'Đọc hiểu' : kindOf(first);
        count.set(label, (count.get(label) || 0) + 1);
    }
    return [...count].map(([k, n]) => `${n} × ${k}`).join(', ') || '—';
}

/** "Tóm tắt theo phần": per Phần what is read, what is cut and the score; the last row sums the exam (10 = đủ). */
export function SummaryTable({exam, issues, blockBank}: {exam: ImportedExam; issues: ImportIssue[]; blockBank: boolean}) {
    const parts = partRows(exam, issues);
    const total = parts.reduce((n, p) => n + (p.score || 0), 0);
    const known = parts.some(p => typeof p.score === 'number');
    const blocks = blocksOf(exam).length;
    return <div className='vt-rv-sum'>
        <h3 className='vt-imp-h2'>Tóm tắt theo phần</h3>
        <div className='vt-rv-sum-scroll'>
            <table className='vt-rv-table'>
                <caption className='vt-sr-only'>Tóm tắt theo phần</caption>
                <thead><tr>
                    <th scope='col'>Phần</th>{blockBank && <th scope='col'>Khối sẽ cắt</th>}<th scope='col'>Số câu</th>{known && <th scope='col'>Điểm</th>}
                </tr></thead>
                <tbody>
                    {parts.map((p, i) => <tr key={i}>
                        <th scope='row'>{p.name}</th>{blockBank && <td>{cutLabel(exam, i)}</td>}
                        <td>{p.read}</td>{known && <td>{typeof p.score === 'number' ? formatDecimal(p.score) : '—'}</td>}
                    </tr>)}
                </tbody>
                <tfoot><tr>
                    <th scope='row'>Cả đề</th>{blockBank && <td>{blocks} khối</td>}
                    <td>{parts.reduce((n, p) => n + p.read, 0)}</td>
                    {known && <td>{formatDecimal(total)}{Math.abs(total - 10) < 1e-6 && <span className='vt-rv-ok'> đủ</span>}</td>}
                </tr></tfoot>
            </table>
        </div>
    </div>;
}
