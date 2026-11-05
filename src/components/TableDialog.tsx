import {useState} from 'react';

import {Button, Modal} from './ui';

const MAX = 8;
const clamp = (v: string) => Math.min(MAX, Math.max(1, Number(v) || 1));

/** "Chèn bảng" (DS-Editor-Bang): rows × cols (max 8 × 8), first row optionally a header. More rows/cols later via the table tools. */
export default function TableDialog({open, onClose, onInsert}: {open: boolean; onClose: () => void; onInsert: (rows: number, cols: number, header: boolean) => void}) {
    const [rows, setRows] = useState('3');
    const [cols, setCols] = useState('3');
    const [header, setHeader] = useState(true);

    return <Modal open={open} onClose={onClose} title='Chèn bảng'
                  footer={<>
                      <Button variant='secondary' onClick={onClose}>Huỷ</Button>
                      <Button variant='primary' onClick={() => { onInsert(clamp(rows), clamp(cols), header); onClose(); }}>Chèn bảng</Button>
                  </>}>
        <div className='tt-math'>
            <div className='tt-table-size'>
                <label>Số hàng <input type='number' min={1} max={MAX} value={rows} onChange={e => setRows(e.target.value)}/></label>
                <label>Số cột <input type='number' min={1} max={MAX} value={cols} onChange={e => setCols(e.target.value)}/></label>
            </div>
            <label><input type='checkbox' checked={header} onChange={e => setHeader(e.target.checked)}/> Hàng đầu là tiêu đề</label>
            <span className='vt-muted'>Tối đa {MAX} hàng × {MAX} cột lúc chèn; thêm hàng và cột sau bằng thanh công cụ bảng.</span>
        </div>
    </Modal>;
}
