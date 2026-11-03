import {useState} from 'react';
import type {DragEvent, ReactNode} from 'react';

import {Button, Card, cx, icons} from '../../components/ui';

const RULES: Array<[string, string]> = [
    ['Mỗi câu một đoạn', 'Bắt đầu bằng “Câu 1.”. Mỗi phương án A, B, C, D một dòng; không xuống dòng bằng Shift+Enter.'],
    ['Công thức dùng Equation của Word', 'Mũi tên, chỉ số, điều kiện phản ứng gõ trong Equation. Không gõ LaTeX thô.'],
    ['Ghi đầu đề rõ', '“Bài thi: HÓA HỌC” và “Mã đề thi: 01”, mỗi file một mã đề.'],
];

const WAYS: Array<[string, ReactNode]> = [
    ['Gạch chân', <>A. HCl<br/><u><b>B</b></u>. CH₃COOH</>],
    ['Tô màu', <>A. HCl<br/><mark><b>B</b></mark>. CH₃COOH</>],
    ['Bảng ĐÁP ÁN', <><b>ĐÁP ÁN</b><br/>1 2 3 4<br/>B C A D</>],
];

/** Step 1 (IV2-TaiLen): drop zone + the 3 rules + samples. Never reads the file itself — hands it to `onFile`. */
export default function ImportUpload({onFile, pick, onGuide}: {onFile: (f: File) => void; pick: () => void; onGuide: () => void}) {
    const [over, setOver] = useState(false);
    const drop = (e: DragEvent) => {
        e.preventDefault(); setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
    };

    return <div className='vt-imp-up'>
        <div className='vt-imp-up-main'>
            <Card>
                <div className={cx('vt-imp-zone', over && 'over')} onDragOver={e => { e.preventDefault(); setOver(true); }}
                     onDragLeave={() => setOver(false)} onDrop={drop}>
                    <icons.IconArrowUp size={48}/>
                    <h2>Kéo file Word vào đây</h2>
                    <Button variant='primary' onClick={pick}>Chọn file .docx</Button>
                    <span className='vt-imp-hint'>Chỉ nhận .docx, tối đa 10 MB. Một file có thể chứa nhiều đề.</span>
                </div>
            </Card>
            <Card>
                <h2 className='vt-imp-h2'>3 cách đánh dấu đáp án</h2>
                <div className='vt-imp-ways'>
                    {WAYS.map(([name, sample], i) => <div key={name} className='vt-imp-way'>
                        <div><span className='vt-imp-num'>{i + 1}</span> <b>{name}</b></div>
                        <div className='vt-imp-sample'>{sample}</div>
                    </div>)}
                </div>
                <div className='vt-imp-notice' role='note'>Mỗi file chỉ dùng <b>một</b> cách. Trộn nhiều cách trong một file thì hệ thống báo lỗi.</div>
            </Card>
        </div>
        <div className='vt-imp-up-side'>
            <Card>
                <h2 className='vt-imp-h2'>Tải mẫu Word</h2>
                {/* Samples live in public/mau-de; the answer-table variant is the one that always works. */}
                <a className='vt-imp-dl' href='/mau-de/mau-khtn.docx' download><icons.IconArrowDown size={18}/>Toán · Lí · Hoá · Sinh</a>
                <a className='vt-imp-dl' href='/mau-de/mau-ngu-van.docx' download><icons.IconArrowDown size={18}/>Ngữ văn</a>
            </Card>
            <Card>
                <h2 className='vt-imp-h2'>3 quy tắc chính</h2>
                <ol className='vt-imp-rules'>
                    {RULES.map(([t, d], i) => <li key={t}><span className='vt-imp-num'>{i + 1}</span>
                        <div><b>{t}</b><span className='vt-imp-hint'>{d}</span></div></li>)}
                </ol>
                <button type='button' className='vt-imp-link' onClick={() => onGuide()}>Lỗi thường gặp và cách sửa →</button>
            </Card>
        </div>
    </div>;
}
