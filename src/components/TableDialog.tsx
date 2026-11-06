import {useState} from 'react';

import {Button, Modal} from './ui';

const MAX = 8;
const clamp = (v: string | number) => Math.min(MAX, Math.max(1, Number(v) || 1));
const CELLS = Array.from({length: MAX * MAX}, (_, i) => ({r: Math.floor(i / MAX) + 1, c: (i % MAX) + 1}));

/**
 * "Chèn bảng" (DS-Editor-Bang): hover/tap the 8 × 8 grid to pick rows × cols (or type the numbers), first row optionally a header.
 * More rows/cols later via the table tools.
 */
export default function TableDialog({open, onClose, onInsert}: {open: boolean; onClose: () => void; onInsert: (rows: number, cols: number, header: boolean) => void}) {
    const [rows, setRows] = useState('3');
    const [cols, setCols] = useState('3');
    const [header, setHeader] = useState(true);
    const [hover, setHover] = useState<{r: number; c: number} | null>(null);
    const r = hover ? hover.r : clamp(rows), c = hover ? hover.c : clamp(cols);

    return <Modal open={open} onClose={onClose} title='Chèn bảng' mobileSheet showClose
                  footer={<>
                      <Button variant='secondary' onClick={onClose}>Huỷ</Button>
                      <Button variant='primary' onClick={() => { onInsert(clamp(rows), clamp(cols), header); onClose(); }}>Chèn bảng</Button>
                  </>}>
        <div className='tt-math'>
            <div className='tt-table-label' aria-live='polite'>{r} hàng × {c} cột</div>
            <div className='tt-table-grid' role='group' aria-label='Chọn kích thước bảng' onMouseLeave={() => setHover(null)}>
                {CELLS.map(x => <button key={x.r + '-' + x.c} type='button' aria-label={x.r + ' hàng × ' + x.c + ' cột'}
                                        className={'tt-table-cell' + (x.r <= r && x.c <= c ? ' on' : '')}
                                        onMouseEnter={() => setHover(x)}
                                        onClick={() => { setRows(String(x.r)); setCols(String(x.c)); }}/>)}
            </div>
            <label className='tt-table-header'><input type='checkbox' checked={header} onChange={e => setHeader(e.target.checked)}/> Hàng đầu là tiêu đề</label>
            <div className='tt-table-size'>
                <span className='vt-muted'>Hoặc nhập số</span>
                <input type='number' min={1} max={MAX} aria-label='Số hàng' value={rows} onChange={e => setRows(e.target.value)}/>
                <span>×</span>
                <input type='number' min={1} max={MAX} aria-label='Số cột' value={cols} onChange={e => setCols(e.target.value)}/>
            </div>
            <span className='vt-muted'>Tối đa {MAX} hàng × {MAX} cột lúc chèn; thêm hàng và cột sau bằng thanh công cụ bảng.</span>
        </div>
    </Modal>;
}
