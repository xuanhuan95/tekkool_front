import {useState} from 'react';
import type {ReactNode} from 'react';
import type {Editor as TiptapEditor} from '@tiptap/react';
import {ConfirmDialog} from './ui';

/**
 * Which toolbar (design DS-Editor): teacher = full (table, image, align…); student = no image/table/align;
 * compact = B I, lists, Σ only (grading remarks).
 */
export type EditorVariant = 'student' | 'teacher' | 'compact';

const Ico = ({children}: {children: ReactNode}) =>
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'
         strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>{children}</svg>;

type BtnProps = {label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode};

/** 36px toolbar button. Name = aria-label + title + tooltip on hover/focus (shared `vt-tip`). */
function Btn({label, onClick, active, disabled, children}: BtnProps) {
    return <button type='button' title={label} aria-label={label} data-tip={label} disabled={disabled}
                   aria-pressed={active === undefined ? undefined : active}
                   className={'tt-btn vt-tip' + (active ? ' active' : '')}
                   onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>;
}

const Sep = () => <span className='tt-sep' aria-hidden='true'/>;

export type EditorToolbarProps = {
    editor: TiptapEditor | null;
    variant: EditorVariant;
    /** 'ErrorIdentify' inserts a checkbox instead of an underline (legacy question type). */
    type?: string;
    onToAnswerButton?: (selected: string) => void;
    onSigma?: () => void;
    onImage?: () => void;
    onChars?: () => void;
    onTable?: () => void;
};

/**
 * Shared editor toolbar (SPT-83). Primary group (B I U + Σ / image) is always visible; under 640px the rest hides
 * behind "…" (CSS: `.tt-more` is shown by `.tt-toolbar.open` on phones, always on wide screens).
 */
export default function EditorToolbar({editor, variant, type, onToAnswerButton, onSigma, onImage, onChars, onTable}: EditorToolbarProps) {
    const [open, setOpen] = useState(false);
    const [delTable, setDelTable] = useState(false);
    if (!editor) return null;
    const full = variant === 'teacher', compact = variant === 'compact';
    const run = () => editor.chain().focus();
    // ponytail: setTextAlign always SETS, never clears -> toggle like Bold so the junk style does not stay in the HTML.
    const align = (a: string) => run()[editor.isActive({textAlign: a}) ? 'unsetTextAlign' : 'setTextAlign'](a).run();

    // Select a passage -> replace it with a blank, the passage becomes the answer.
    const toAnswer = () => {
        const {from, to} = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to, ' ');
        if (!selected) return;
        editor.chain().focus().insertContent(type === 'ErrorIdentify' ? {type: 'checkItem'} : '__________').run();
        onToAnswerButton && onToAnswerButton(selected);
    };

    return <div className={'tt-toolbar' + (open ? ' open' : '')} role='toolbar' aria-label='Định dạng'>
        <div className='tt-group tt-primary'>
            {!compact && <>
            <Btn label='Hoàn tác' disabled={!editor.can().undo()} onClick={() => run().undo().run()}>
                <Ico><path d='M9 14L4 9l5-5'/><path d='M4 9h10a6 6 0 010 12h-3'/></Ico></Btn>
            <Btn label='Làm lại' disabled={!editor.can().redo()} onClick={() => run().redo().run()}>
                <Ico><path d='M15 14l5-5-5-5'/><path d='M20 9H10a6 6 0 000 12h3'/></Ico></Btn>
            <Sep/></>}
            <Btn label='In đậm' active={editor.isActive('bold')} onClick={() => run().toggleBold().run()}><b>B</b></Btn>
            <Btn label='In nghiêng' active={editor.isActive('italic')} onClick={() => run().toggleItalic().run()}><i>I</i></Btn>
            {!compact && <Btn label='Gạch chân' active={editor.isActive('underline')} onClick={() => run().toggleUnderline().run()}><u>U</u></Btn>}
            {onSigma &&
                <Btn label='Chèn công thức' onClick={onSigma}><span className='tt-sigma' aria-hidden='true'>Σ</span></Btn>}
            {!compact && onChars &&
                <Btn label='Ký tự đặc biệt' onClick={onChars}><span className='tt-sigma' aria-hidden='true'>Ω</span></Btn>}
            {full && onImage &&
                <Btn label='Chèn ảnh' onClick={onImage}>
                    <Ico><rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='10' r='1.6'/><path d='M21 16l-5-5-8 8'/></Ico></Btn>}
            <button type='button' className='tt-btn tt-morebtn vt-tip' title='Thêm công cụ' aria-label='Thêm công cụ'
                    data-tip='Thêm công cụ' aria-expanded={open} onMouseDown={e => e.preventDefault()}
                    onClick={() => setOpen(o => !o)}>…</button>
        </div>
        <div className='tt-group tt-more'>
            {full && <Btn label='Gạch ngang' active={editor.isActive('strike')} onClick={() => run().toggleStrike().run()}><s>S</s></Btn>}
            {!compact && <>
            <Btn label='Chỉ số trên' active={editor.isActive('superscript')} onClick={() => run().toggleMark('superscript').run()}>
                <span className='tt-sup'>x<sup>2</sup></span></Btn>
            <Btn label='Chỉ số dưới' active={editor.isActive('subscript')} onClick={() => run().toggleMark('subscript').run()}>
                <span className='tt-sup'>x<sub>2</sub></span></Btn>
            <Sep/></>}
            {full && <>
            {onTable && <Btn label='Chèn bảng' active={editor.isActive('table')} onClick={onTable}>
                <Ico><rect x='3' y='4' width='18' height='16' rx='2'/><path d='M3 10h18M3 15h18M9 4v16M15 4v16'/></Ico></Btn>}
            <Btn label='Căn trái' active={editor.isActive({textAlign: 'left'})} onClick={() => align('left')}>
                <Ico><path d='M4 6h16M4 10h10M4 14h16M4 18h10'/></Ico></Btn>
            <Btn label='Căn giữa' active={editor.isActive({textAlign: 'center'})} onClick={() => align('center')}>
                <Ico><path d='M4 6h16M7 10h10M4 14h16M7 18h10'/></Ico></Btn>
            <Btn label='Căn phải' active={editor.isActive({textAlign: 'right'})} onClick={() => align('right')}>
                <Ico><path d='M4 6h16M10 10h10M4 14h16M10 18h10'/></Ico></Btn>
            <Sep/></>}
            <Btn label='Danh sách chấm' active={editor.isActive('bulletList')} onClick={() => run().toggleBulletList().run()}>
                <Ico><path d='M9 6h11M9 12h11M9 18h11'/><circle cx='4.5' cy='6' r='1'/><circle cx='4.5' cy='12' r='1'/><circle cx='4.5' cy='18' r='1'/></Ico></Btn>
            <Btn label='Danh sách số' active={editor.isActive('orderedList')} onClick={() => run().toggleOrderedList().run()}>
                <Ico><path d='M10 6h10M10 12h10M10 18h10'/><path d='M4 5l1.5-1v4M4 14.5c0-1 2.5-1 2.5.3 0 1-2.5 1.7-2.5 2.7h2.5'/></Ico></Btn>
            {onToAnswerButton &&
                <Btn label='Chuyển vùng chọn thành đáp án' onClick={toAnswer}><i className='angle double down icon'/></Btn>}
        </div>
        {full && editor.isActive('table') && <div className='tt-group tt-tabletools' role='toolbar' aria-label='Bảng'>
            <TBtn label='Thêm hàng' on={() => run().addRowAfter().run()} ok={editor.can().addRowAfter()}/>
            <TBtn label='Thêm cột' on={() => run().addColumnAfter().run()} ok={editor.can().addColumnAfter()}/>
            <TBtn label='Xoá hàng' on={() => run().deleteRow().run()} ok={editor.can().deleteRow()}/>
            <TBtn label='Xoá cột' on={() => run().deleteColumn().run()} ok={editor.can().deleteColumn()}/>
            <TBtn label='Gộp ô' on={() => run().mergeCells().run()} ok={editor.can().mergeCells()}/>
            <TBtn label='Tách ô' on={() => run().splitCell().run()} ok={editor.can().splitCell()}/>
            <TBtn label='Hàng tiêu đề' on={() => run().toggleHeaderRow().run()} ok={editor.can().toggleHeaderRow()}/>
            <TBtn label='Xoá bảng' on={() => setDelTable(true)} ok/>
        </div>}
        <ConfirmDialog open={delTable} tone='danger' title='Xoá bảng này?' cancelLabel='Giữ lại' confirmLabel='Xoá bảng'
                       message='Toàn bộ chữ và công thức trong bảng sẽ mất. Có thể bấm Hoàn tác ngay sau đó.'
                       onCancel={() => setDelTable(false)}
                       onConfirm={() => { run().deleteTable().run(); setDelTable(false); }}/>
    </div>;
}

/** Text button of the table tool row (a row under the main toolbar, only while the caret is inside a table). */
function TBtn({label, on, ok}: {label: string; on: () => void; ok: boolean}) {
    return <button type='button' className='tt-tbtn' disabled={!ok} onMouseDown={e => e.preventDefault()} onClick={on}>{label}</button>;
}
