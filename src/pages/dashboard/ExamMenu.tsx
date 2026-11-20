import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';

import {IconButton} from '../../components/ui';
import {IconMore} from '../../components/ui/icons';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import {examName, isPublished} from './examMeta';
import type {ExamRef, useExamActions} from './useExamActions';

/**
 * ⋯ of an exam (canvas APP-teacher-subjects-v2-menu): popover under the button on desktop, bottom sheet on phones.
 * Bài nộp · Nhân bản · Chuyển sang môn khác… · Chuyển về nháp (published only) · Xoá đề (locked once there are submissions).
 */
export default function ExamMenu({exam, submissions, actions}: {exam: ExamRef; submissions?: number; actions: ReturnType<typeof useExamActions>}) {
    const web = useMediaQuery(DESKTOP);
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        menu.current?.querySelector<HTMLElement>('a, button')?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e: MouseEvent) => { if (web && !anchor.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
    }, [open, web]);

    const act = (fn: () => void) => () => { setOpen(false); fn(); };
    const locked = !!exam.has_submissions;
    const items = <div ref={menu} className={'vt-th-menu' + (web ? '' : ' vt-th-menu--sheet')} role='menu' aria-label='Thao tác khác'>
        <Link role='menuitem' to={'/to-grade/' + exam.id}>Bài nộp{submissions != null && <small>{submissions} bài</small>}</Link>
        <button role='menuitem' type='button' onClick={act(() => actions.duplicate(exam))}>Nhân bản</button>
        <button role='menuitem' type='button' onClick={act(() => actions.askMove(exam))}>Chuyển sang môn khác…</button>
        {isPublished(exam) && <button role='menuitem' type='button' onClick={act(() => actions.askUnpublish(exam))}>
            Chuyển về nháp<small>Học sinh không thấy đề nữa</small></button>}
        <hr/>
        <button role='menuitem' type='button' className='is-danger' aria-disabled={locked || undefined}
                onClick={() => { if (!locked) act(() => actions.askDelete(exam))(); }}>
            Xoá đề{locked && <small>Đề đã có bài nộp — chỉ chuyển về Nháp được</small>}</button>
    </div>;

    return <div className='vt-th-anchor' ref={anchor}>
        <IconButton variant='outline' tipEnd label={'Thao tác khác: ' + examName(exam)} icon={<IconMore/>}
                    aria-haspopup='menu' aria-expanded={open} disabled={actions.busy} onClick={() => setOpen(!open)}/>
        {open && web && items}
        {open && !web && createPortal(
            <div className='vt-scrim' onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>{items}</div>, document.body)}
    </div>;
}
