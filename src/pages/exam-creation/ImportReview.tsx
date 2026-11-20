import {Badge, cx} from '../../components/ui';
import {blocksOf} from './dupRules';
import {kindOf, type ImportedExam} from './importRules';

/** What the list shows next to an exam. `note` = why it is ticked off (already in the bank, …). */
export type ReviewRow = {
    exam: ImportedExam; file: string; picked: boolean;
    severe: number; light: number; missing: number; dupBlocks: number; sameInImport: number;
    state?: 'saved' | 'error' | 'pending';
    note?: 'exists' | 'other-bank';
};

/** Status badges of one exam (list row, and the phone picker). */
export function RowMarks({r}: {r: ReviewRow}) {
    return <span className='vt-imp-marks'>
        {r.note === 'exists' && <Badge tone={r.state ? 'err' : 'sun'}>Đã có</Badge>}
        {r.note === 'other-bank' && <Badge tone='err'>Ở ngân hàng khác</Badge>}
        {r.state === 'saved' && <Badge tone='ok'>Đã lưu</Badge>}
        {r.state === 'error' && <Badge tone='err'>Lỗi</Badge>}
        {r.state === 'pending' && <Badge tone='draft'>Chưa lưu</Badge>}
        {r.dupBlocks > 0 && <Badge tone='sun'>{r.dupBlocks} khối trùng</Badge>}
        {r.sameInImport > 0 && <Badge tone='sun'>Trùng nhau</Badge>}
        {r.severe > 0 && <Badge tone='err'>{r.severe} cảnh báo nặng</Badge>}
        {r.missing > 0 && <Badge tone='err'>{r.missing} thiếu đáp án</Badge>}
        {r.light > 0 && <Badge tone='sun'>{r.light} cảnh báo nhẹ</Badge>}
    </span>;
}

type ListProps = {
    rows: ReviewRow[]; openId: string | null; onOpen: (id: string) => void; onToggle: (id: string) => void; onToggleAll: () => void;
};

/** Left column: ticks + status per exam, grouped by file (artboard bank-v4-import-preview). */
export function ReviewList({rows, openId, onOpen, onToggle, onToggleAll}: ListProps) {
    const chosen = rows.filter(r => r.picked).length;
    const files = [...new Set(rows.map(r => r.file))];
    return <nav className='vt-rv-list' aria-label='Các đề đã đọc'>
        <div className='vt-imp-listhead'>
            <label className='vt-imp-check'>
                <input type='checkbox' checked={chosen === rows.length}
                       ref={el => { if (el) el.indeterminate = chosen > 0 && chosen < rows.length; }} onChange={onToggleAll}/>
                {rows.length} đề — nhập {chosen}
            </label>
        </div>
        {files.map(f => <div key={f} className='vt-rv-file'>
            {files.length > 1 || rows.length > 1 ? <div className='vt-rv-file-name'>{f}</div> : null}
            {rows.filter(r => r.file === f).map(r => {
                const on = openId === r.exam.id;
                // The whole row opens the exam (a tick, a badge, the empty part) — not only the name: otherwise the right side stays on the old exam.
                return <div key={r.exam.id} className={cx('vt-rv-item', on && 'on', !r.picked && 'off')} onClick={() => onOpen(r.exam.id)}>
                    <label className='vt-imp-hit'>
                        <input type='checkbox' checked={r.picked} aria-label={'Chọn ' + r.exam.name} onChange={() => onToggle(r.exam.id)}/>
                    </label>
                    <button type='button' className='vt-rv-open' aria-current={on ? 'true' : undefined}>
                        <span className='vt-rv-name'>{r.exam.name}</span>
                    </button>
                    <RowMarks r={r}/>
                </div>;
            })}
        </div>)}
        <p className='v4-muted'>Bấm tên đề để xem. Ô vuông: có nhập đề đó không.</p>
    </nav>;
}

/** "2 × Đọc hiểu, 1 × Trắc nghiệm": what the exam is cut into (block bank only). Kinds come from the question types read on screen. */
export function cutLabel(exam: ImportedExam, section: number) {
    const count = new Map<string, number>();
    for (const b of blocksOf(exam).filter(x => x.section === section)) {
        const first = b.questions[0];
        const label = b.questions.length > 1 && first.data.passageId && first.type !== 'TrueFalse' && !/chùm/i.test(kindOf(first)) ? 'Đọc hiểu' : kindOf(first);
        count.set(label, (count.get(label) || 0) + 1);
    }
    return [...count].map(([k, n]) => `${n} × ${k}`).join(', ') || '—';
}
