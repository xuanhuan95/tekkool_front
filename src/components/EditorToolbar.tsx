import {useState} from 'react';
import type {CSSProperties, ReactNode} from 'react';
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

type BtnProps = {label: string; onClick: () => void; active?: boolean; disabled?: boolean; cls?: string; tip?: string; children: ReactNode};

/** 36px toolbar button. Name = aria-label + title + tooltip on hover/focus (shared `vt-tip`). */
function Btn({label, onClick, active, disabled, cls = '', tip, children}: BtnProps) {
    return <button type='button' title={tip || label} aria-label={label} data-tip={tip || label} disabled={disabled}
                   aria-pressed={active === undefined ? undefined : active}
                   className={'tt-btn vt-tip' + (active ? ' active' : '') + (cls ? ' ' + cls : '')}
                   onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>;
}

const Trash = () => <Ico><path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'/></Ico>;

const Sep = ({w}: {w: number}) => <span className='tt-sep' aria-hidden='true' style={{'--w': w} as CSSProperties}/>;

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
 * Shared editor toolbar (SPT-83). Wide: one row. Under 640px: 5 primary buttons + "…", the rest on a second row (see WIDE/PRIMARY/MORE).
 */
export default function EditorToolbar({editor, variant, type, onToAnswerButton, onSigma, onImage, onChars, onTable}: EditorToolbarProps) {
    const [open, setOpen] = useState(false);
    const [delTable, setDelTable] = useState(false);
    if (!editor) return null;
    const full = variant === 'teacher', compact = variant === 'compact';
    const run = () => editor.chain().focus();
    // Only one row left: "Hàng" delete is off (deleting it would remove the table; use Xoá bảng).
    const {$from} = editor.state.selection;
    let lastRow = false;
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') { lastRow = $from.node(d).childCount <= 1; break; }
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

    // One flat flex row. Wide screens: everything in WIDE order. Phones: PRIMARY buttons + "…", the rest (MORE) on a second row when open.
    // Order comes from the two lists below via CSS `order` (--w / --p), so the artboards' two layouts need no second DOM.
    const WIDE = compact ? ['b', 'i', 'ul', 'ol', 'sigma']
        : full ? ['undo', 'redo', '|', 'b', 'i', 'u', 's', 'sub', 'sup', '|', 'al', 'ac', 'ar', '|', 'ul', 'ol', '|', 'sigma', 'chars', 'table', 'img', 'ans']
        : ['undo', 'redo', '|', 'b', 'i', 'u', 'sub', 'sup', '|', 'ul', 'ol', '|', 'sigma', 'chars', 'ans'];
    const PRIMARY = compact ? ['b', 'i', 'ul', 'ol', 'sigma'] : full ? ['undo', 'b', 'i', 'sigma', 'img'] : ['undo', 'b', 'i', 'sigma', 'chars'];
    const MORE = full ? ['u', 's', 'sub', 'sup', 'al', 'ac', 'ar', 'ul', 'ol', 'redo', 'chars', 'table', 'ans']
        : ['redo', 'u', 'sub', 'sup', 'ul', 'ol', 'ans'];
    const css = (id: string, wi: number) => {
        const pi = PRIMARY.indexOf(id);
        return {'--w': wi, '--p': pi >= 0 ? pi : 100 + MORE.indexOf(id)} as CSSProperties;
    };
    const defs: Record<string, ReactNode | null> = {
        undo: <Btn label='Hoàn tác' disabled={!editor.can().undo()} onClick={() => run().undo().run()}>
            <Ico><path d='M9 14L4 9l5-5'/><path d='M4 9h10a6 6 0 010 12h-3'/></Ico></Btn>,
        redo: <Btn label='Làm lại' disabled={!editor.can().redo()} onClick={() => run().redo().run()}>
            <Ico><path d='M15 14l5-5-5-5'/><path d='M20 9H10a6 6 0 000 12h3'/></Ico></Btn>,
        b: <Btn label='In đậm' active={editor.isActive('bold')} onClick={() => run().toggleBold().run()}><b>B</b></Btn>,
        i: <Btn label='In nghiêng' active={editor.isActive('italic')} onClick={() => run().toggleItalic().run()}><i>I</i></Btn>,
        u: <Btn label='Gạch chân' active={editor.isActive('underline')} onClick={() => run().toggleUnderline().run()}><u>U</u></Btn>,
        s: <Btn label='Gạch ngang' active={editor.isActive('strike')} onClick={() => run().toggleStrike().run()}><s>S</s></Btn>,
        sup: <Btn label='Chỉ số trên' active={editor.isActive('superscript')} onClick={() => run().toggleMark('superscript').run()}>
            <span className='tt-sup'>x<sup>2</sup></span></Btn>,
        sub: <Btn label='Chỉ số dưới' active={editor.isActive('subscript')} onClick={() => run().toggleMark('subscript').run()}>
            <span className='tt-sup'>x<sub>2</sub></span></Btn>,
        al: <Btn label='Căn trái' active={editor.isActive({textAlign: 'left'})} onClick={() => align('left')}>
            <Ico><path d='M4 6h16M4 10h10M4 14h16M4 18h10'/></Ico></Btn>,
        ac: <Btn label='Căn giữa' active={editor.isActive({textAlign: 'center'})} onClick={() => align('center')}>
            <Ico><path d='M4 6h16M7 10h10M4 14h16M7 18h10'/></Ico></Btn>,
        ar: <Btn label='Căn phải' active={editor.isActive({textAlign: 'right'})} onClick={() => align('right')}>
            <Ico><path d='M4 6h16M10 10h10M4 14h16M10 18h10'/></Ico></Btn>,
        ul: <Btn label='Danh sách chấm' active={editor.isActive('bulletList')} onClick={() => run().toggleBulletList().run()}>
            <Ico><path d='M9 6h11M9 12h11M9 18h11'/><circle cx='4.5' cy='6' r='1'/><circle cx='4.5' cy='12' r='1'/><circle cx='4.5' cy='18' r='1'/></Ico></Btn>,
        ol: <Btn label='Danh sách số' active={editor.isActive('orderedList')} onClick={() => run().toggleOrderedList().run()}>
            <Ico><path d='M10 6h10M10 12h10M10 18h10'/><path d='M4 5l1.5-1v4M4 14.5c0-1 2.5-1 2.5.3 0 1-2.5 1.7-2.5 2.7h2.5'/></Ico></Btn>,
        sigma: onSigma ? <Btn label='Chèn công thức' onClick={onSigma}><span className='tt-sigma' aria-hidden='true'>Σ</span></Btn> : null,
        chars: onChars ? <Btn label='Ký tự đặc biệt' onClick={onChars}><span className='tt-sigma' aria-hidden='true'>Ω</span></Btn> : null,
        table: onTable ? <Btn label='Chèn bảng' active={editor.isActive('table')} onClick={onTable}>
            <Ico><rect x='3' y='4' width='18' height='16' rx='2'/><path d='M3 10h18M3 15h18M9 4v16M15 4v16'/></Ico></Btn> : null,
        img: onImage ? <Btn label='Chèn ảnh' onClick={onImage}>
            <Ico><rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='10' r='1.6'/><path d='M21 16l-5-5-8 8'/></Ico></Btn> : null,
        ans: onToAnswerButton ? <Btn label='Chuyển vùng chọn thành đáp án' onClick={toAnswer}><i className='angle double down icon'/></Btn> : null,
    };

    return <div className={'tt-toolbar' + (open ? ' open' : '')} role='toolbar' aria-label='Định dạng'>
        {WIDE.map((id, wi) => id === '|' ? <Sep key={'s' + wi} w={wi}/>
            : defs[id] ? <span key={id} className={'tt-item' + (PRIMARY.includes(id) ? '' : ' tt-moreitem')} style={css(id, wi)}>{defs[id]}</span> : null)}
        {!compact && <button type='button' className='tt-btn tt-morebtn vt-tip' title='Thêm công cụ' aria-label='Thêm công cụ'
                data-tip='Thêm công cụ' aria-expanded={open} onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}>…</button>}
        {full && editor.isActive('table') && <div className='tt-tabletools' role='toolbar' aria-label='Bảng'>
            <Btn label='Thêm hàng phía trên' onClick={() => run().addRowBefore().run()}><Ico><rect x='3' y='12' width='18' height='8' rx='1'/><path d='M12 9V3M9 6l3-3 3 3'/></Ico></Btn>
            <Btn label='Thêm hàng phía dưới' onClick={() => run().addRowAfter().run()}><Ico><rect x='3' y='4' width='18' height='8' rx='1'/><path d='M12 15v6M9 18l3 3 3-3'/></Ico></Btn>
            <Btn label='Thêm cột bên trái' onClick={() => run().addColumnBefore().run()}><Ico><rect x='12' y='3' width='9' height='18' rx='1'/><path d='M9 12H3M6 9l-3 3 3 3'/></Ico></Btn>
            <Btn label='Thêm cột bên phải' onClick={() => run().addColumnAfter().run()}><Ico><rect x='3' y='3' width='9' height='18' rx='1'/><path d='M15 12h6M18 9l3 3-3 3'/></Ico></Btn>
            <span className='tt-sep' aria-hidden='true'/>
            <Btn label='Gộp ô' disabled={!editor.can().mergeCells()} onClick={() => run().mergeCells().run()}><Ico><rect x='3' y='5' width='18' height='14' rx='2'/><path d='M12 5v4M12 15v4M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2'/></Ico></Btn>
            <Btn label='Tách ô' disabled={!editor.can().splitCell()} onClick={() => run().splitCell().run()}><Ico><rect x='3' y='5' width='18' height='14' rx='2'/><path d='M12 5v14M7 12h2M15 12h2'/></Ico></Btn>
            <Btn label='Hàng tiêu đề' active={editor.isActive('tableHeader')} onClick={() => run().toggleHeaderRow().run()}><Ico><rect x='3' y='4' width='18' height='16' rx='2'/><path d='M3 9h18' strokeWidth='3'/><path d='M12 9v11'/></Ico></Btn>
            <span className='tt-sep' aria-hidden='true'/>
            <Btn label='Xoá hàng' cls='wide' disabled={lastRow} tip={lastRow ? 'Bảng phải còn ít nhất 1 hàng. Muốn bỏ hết, dùng Xoá bảng.' : undefined}
                 onClick={() => run().deleteRow().run()}><Trash/><span className='tt-btn-txt'>Hàng</span></Btn>
            <Btn label='Xoá cột' cls='wide' disabled={!editor.can().deleteColumn()} onClick={() => run().deleteColumn().run()}><Trash/><span className='tt-btn-txt'>Cột</span></Btn>
            <span className='tt-sep' aria-hidden='true'/>
            <Btn label='Xoá bảng' cls='danger' onClick={() => setDelTable(true)}><Trash/></Btn>
        </div>}
        <ConfirmDialog open={delTable} tone='danger' title='Xoá bảng này?' cancelLabel='Giữ lại' confirmLabel='Xoá bảng'
                       message='Toàn bộ chữ và công thức trong bảng sẽ mất. Có thể bấm Hoàn tác ngay sau đó.'
                       onCancel={() => setDelTable(false)}
                       onConfirm={() => { run().deleteTable().run(); setDelTable(false); }}/>
    </div>;
}
