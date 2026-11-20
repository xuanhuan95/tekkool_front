import {useState} from 'react';
import type {DragEvent} from 'react';

import {Button, Card, cx, icons} from '../../components/ui';
import type {FileTemplate} from '../../queries/questionBank';

/** The sample file the teacher uploaded: being read, read (one or several exams), or refused. */
export type Source = {file: string; status: 'reading' | 'ok' | 'error'; templates: FileTemplate[]; pick: number; error?: string};

const SHOWN = 5;
const shownCount = (s: Source) => Math.min(s.templates.length, SHOWN + (s.pick >= SHOWN ? 1 : 0));

type Props = {
    src: Source | null;
    blank: boolean;
    /** "3 phần · 12 câu · 10 điểm" for each exam of the file. */
    infos: string[];
    /** A correct sample file, offered when the teacher's file could not be read. */
    sampleHref: string;
    /** Opens the file dialog (the parent asks first when the sheet has edits). */
    onOpen: () => void;
    onFiles: (files: File[]) => void;
    onCancel: () => void;
    onPick: (i: number) => void;
    onBlank: () => void;
};

/**
 * "Đề mẫu" card (artboards APP-teacher-bank-v5-create-*): the frame comes from a .docx the teacher uploads, only its structure is used —
 * the questions are drawn from the bank. A file with several exams lists them; "Không dùng đề mẫu" starts from a blank sheet.
 */
export default function TemplateCard({src, blank, infos, sampleHref, onOpen, onFiles, onCancel, onPick, onBlank}: Props) {
    const [over, setOver] = useState(false);
    const [all, setAll] = useState(false);
    const many = src?.status === 'ok' && src.templates.length > 1;

    return <Card size='md' className={cx('v5-card', over && 'v5-over')}
                 onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                 onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}>
        <h2 className='v3-h2'>Đề mẫu</h2>
        {!src && <div className='v5-drop'>
            <icons.IconUploadTray/>
            <b>Tải lên một đề để lấy cấu trúc</b>
            <span>Kéo file .docx vào đây. Hệ thống chỉ lấy phần, điểm, lời dẫn và số đoạn/câu; <b>câu hỏi sẽ rút từ ngân hàng</b>.</span>
            <Button variant='primary' onClick={onOpen}>Chọn file .docx</Button>
        </div>}
        {src?.status === 'reading' && <div className='v5-file v5-file--busy'>
            <span className='vt-bk-spin' aria-hidden='true'/>
            <div className='v5-file-main'>
                <b>{src.file}</b>
                <span>Đang đọc cấu trúc đề…</span>
                <div className='vt-bk-prog' role='progressbar' aria-label='Đang đọc file'><i className='v5-indet'/></div>
                <div className='v5-file-acts'><Button variant='ghost' size='sm' onClick={onCancel}>Huỷ</Button></div>
            </div>
        </div>}
        {src?.status === 'ok' && <div className='v5-file v5-file--ok'>
            <icons.IconOk/>
            <div className='v5-file-main'>
                <b>{src.file}</b>
                <span>{many ? <>File có <b>{src.templates.length} đề</b>. Chọn một đề để lấy cấu trúc:</> : `1 đề · ${infos[0]}`}</span>
                <div className='v5-file-acts'><Button variant='secondary' size='sm' onClick={onOpen}>Đổi file</Button></div>
            </div>
        </div>}
        {many && <ul className='v3-tpls' role='radiogroup' aria-label='Lấy cấu trúc của đề'>
            {src.templates.map((t, i) => (all || i < SHOWN || i === src.pick) && <li key={i}><label>
                <input type='radio' name='ex' checked={src.pick === i} onChange={() => onPick(i)}/>
                <span><b>{t.name}</b><small>{infos[i]}</small></span></label></li>)}
            {!all && src.templates.length > SHOWN && <li><Button variant='ghost' size='sm' onClick={() => setAll(true)}>
                Xem thêm {src.templates.length - shownCount(src)} đề</Button></li>}
        </ul>}
        {src?.status === 'error' && <div className='v5-file v5-file--err'>
            <icons.IconErrorCircle/>
            <div className='v5-file-main'>
                <b>{src.file}</b>
                <span className='v5-err' role='alert'>{src.error}</span>
                <div className='v5-file-acts'>
                    <Button variant='primary' size='sm' onClick={onOpen}>Chọn file khác</Button>
                    <a className='vt-imp-link' href={sampleHref} download>Xem file mẫu đúng</a>
                </div>
            </div>
        </div>}
        <hr className='v5-hr'/>
        <label className='v5-none'>
            <input type='radio' name='tpl' checked={blank} onChange={onBlank}/>
            <span><b>Không dùng đề mẫu</b><small>Bắt đầu từ tờ đề trống</small></span>
        </label>
    </Card>;
}
