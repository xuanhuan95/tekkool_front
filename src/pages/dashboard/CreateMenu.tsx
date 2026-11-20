import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Link, useNavigate} from 'react-router-dom';

import {Button} from '../../components/ui';
import {IconBankRows, IconEdit, IconWordDoc} from '../../components/ui/icons';
import type {Folder} from '../../types/exam';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';

/** The three ways to make an exam: same names in the "+ Tạo đề" menu and on an empty subject (canvas APP-teacher-subjects-v2). */
export const CREATE_OPTIONS = [
    {path: '/create-exam', title: 'Tự soạn', hint: 'Soạn theo phần trên máy tính', desc: 'Soạn từng phần, từng câu trên máy tính.', icon: <IconEdit size={20}/>},
    {path: '/import-exam', title: 'Nhập Word', hint: 'Tải file .docx, xem lại rồi lưu', desc: 'Tải file .docx có sẵn, xem lại rồi lưu.', icon: <IconWordDoc/>},
    {path: '/create-from-bank', title: 'Từ ngân hàng đề', hint: 'Theo cấu trúc, mỗi lượt một đề riêng', desc: 'Tải một đề mẫu lấy cấu trúc; mỗi học sinh rút một đề khác.', icon: <IconBankRows/>},
];

/** "+ Tạo đề": floating menu anchored to the button on desktop, bottom sheet on phones (canvas APP-teacher-home-create-menu-a). */
export function CreateMenu({subject}: {subject: Folder}) {
    const navigate = useNavigate();
    const web = useMediaQuery(DESKTOP);
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLDivElement>(null);
    const title = 'Tạo đề cho môn ' + subject.name;

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e: MouseEvent) => { if (web && !anchor.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
    }, [open, web]);

    const pick = (path: string) => { setOpen(false); navigate(path + '?folder=' + subject.id); };
    const options = (cls: string) => CREATE_OPTIONS.map(o =>
        <button key={o.path} role={web ? 'menuitem' : undefined} className={cls} type='button' onClick={() => pick(o.path)}>
            <span className='vt-opt-ico'>{o.icon}</span>
            <span><b>{o.title}</b><span className='d'>{o.hint}</span></span>
        </button>);

    return <div className='vt-th-anchor' ref={anchor}>
        <Button variant='primary' aria-expanded={open} aria-haspopup='menu' onClick={() => setOpen(!open)}>+ Tạo đề</Button>
        {open && web && <div className='vt-pop' role='menu'>
            <div className='vt-pop-title'>{title}</div>
            {options('')}
        </div>}
        {open && !web && createPortal(
            <div className='vt-scrim' onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
                <div className='vt-sheet' role='dialog' aria-modal='true' aria-label={title}>
                    <span className='vt-sheet-grab'/>
                    <h2 className='vt-sheet-title'>{title}</h2>
                    {options('row')}
                    <Button variant='secondary' block onClick={() => setOpen(false)}>Huỷ</Button>
                </div>
            </div>, document.body)}
    </div>;
}

/** Empty subject: the same three ways as cards, right where the list would be. */
export function CreateWays({subject}: {subject: Folder}) {
    return <div className='vt-card vt-th-empty'>
        <h3>Môn {subject.name} chưa có đề nào</h3>
        <p className='vt-th-note'>Chọn một cách để tạo đề đầu tiên. Đề mới ở dạng Nháp, học sinh chưa thấy cho tới khi bạn xuất bản.</p>
        <div className='vt-th-ways'>
            {CREATE_OPTIONS.map(o => <Link key={o.path} className='vt-th-way' to={o.path + '?folder=' + subject.id}>
                <b>{o.icon}{o.title}</b><span>{o.desc}</span></Link>)}
        </div>
    </div>;
}
