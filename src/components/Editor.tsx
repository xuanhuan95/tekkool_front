import {Suspense, lazy, useEffect, useRef, useState} from "react";
import {useEditor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type {EditorView} from '@tiptap/pm/view';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CheckItem from './CheckItem';
import EditorToolbar from './EditorToolbar';
import type {EditorVariant} from './EditorToolbar';
import ImageDialog from './ImageDialog';
import {textLength} from './textLength';
import CharDialog from './CharDialog';
import TableDialog from './TableDialog';
import {imageFiles, useImageUploads} from './useImageUploads';
import {Superscript, Subscript, Image, MathInline} from './RichExtras';

import './Editor.css';

// MathLive is big: only downloaded when Σ is opened.
const MathDialog = lazy(() => import('./MathDialog'));

export type EditorProps = {
    text?: string;
    placeholder?: string;
    /** 'ErrorIdentify' inserts a checkbox instead of an underline. */
    type?: string;
    onChange?: (html: string) => void;
    onToAnswerButton?: (selected: string) => void;
    onPaste?: (e: {target: {innerText: string}}) => void;
    onKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onBlur?: () => void;
    /** Fires on every keystroke (onChange is debounced 500ms): for badges that must follow typing. */
    onLive?: (html: string) => void;
    disableReturn?: boolean;
    disableStyle?: boolean;
    /** student: toolbar with Σ (formula keyboard), no images. teacher (default): Σ and image insert. disableStyle hides the toolbar. */
    variant?: EditorVariant;
    /** Show "n / max ký tự" and mark the box red when over. Saving is the caller's call: see `textLength`. */
    maxChars?: number;
    /** Shim for legacy code: NOT a React ref, see the useEffect below. */
    refMedium?: {current: any};
};

export function Editor(props: EditorProps) {
    const {
        text, placeholder, type, onChange, onToAnswerButton,
        onPaste, onKeyUp, onBlur, onLive, disableReturn, disableStyle, refMedium,
        variant = 'teacher', maxChars,
    } = props;

    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The debounced call must never be lost (SPT-92): Save / blur / leaving the page flush it first.
    const latest = useRef({onChange, html: null as string | null});
    latest.current.onChange = onChange;
    const flush = () => {
        if (!timeout.current) return;
        clearTimeout(timeout.current);
        timeout.current = null;
        const {html, onChange: cb} = latest.current;
        if (html !== null && cb) cb(html);
    };
    // Σ dialog state: pos != null = editing the formula node at that position.
    const [math, setMath] = useState<{pos: number | null; latex: string} | null>(null);
    const [imageOpen, setImageOpen] = useState(false);
    const [charsOpen, setCharsOpen] = useState(false);
    const [tableOpen, setTableOpen] = useState(false);
    const editorRef = useRef<ReturnType<typeof useEditor>>(null);
    const uploads = useImageUploads(editorRef, variant === 'teacher', () => setImageOpen(true));
    const addImages = useRef(uploads.add);
    addImages.current = uploads.add;
    const editMath = useRef((pos: number, latex: string) => setMath({pos, latex}));

    const editor = useEditor({
        extensions: [
            StarterKit.configure({heading: false, codeBlock: false, blockquote: false}),
            Underline,
            // ponytail: the answer box hides the toolbar but TextAlign keeps its
            // shortcuts Mod-Shift-r/l/e/j -> a student used to pressing Ctrl+Shift+R
            // (hard reload) gets the text right-aligned with no button to undo it.
            // Hidden toolbar means no extension at all.
            ...(disableStyle ? [] : [TextAlign.configure({types: ['paragraph']})]),
            Placeholder.configure({placeholder: placeholder || ''}),
            CheckItem,
            Superscript, Subscript, Image,
            // Tables: Word import (SPT-93) and the teacher's "Chèn bảng" button (SPT-115).
            Table, TableRow, TableHeader, TableCell,
            MathInline.configure({onEdit: (pos, latex) => editMath.current(pos, latex)}),
        ],
        content: text || '',
        editorProps: {
            // "Gọn" (nhận xét chấm) has no table: a pasted table keeps its text, loses the grid.
            transformPastedHTML: variant === 'compact'
                ? (h: string) => h.replace(/<\/t[dh]>/gi, ' ').replace(/<\/tr>/gi, '<br>').replace(/<\/?(table|thead|tbody|tfoot|tr|th|td|colgroup|col|caption)\b[^>]*>/gi, '')
                : undefined,
            // disableReturn: block line breaks for single-line boxes (answers).
            handleKeyDown: (_view: EditorView, event: KeyboardEvent) =>
                disableReturn && event.key === 'Enter' ? (event.preventDefault(), true) : false,
            // Image from the clipboard (also pasted from Word) or dropped in: upload, never keep as base64 / file://.
            handleDrop: (_v, event: DragEvent) => {
                const fs = imageFiles(event.dataTransfer?.files);
                if (!fs.length) return false;
                event.preventDefault();
                return addImages.current(fs);
            },
            handlePaste: (_v: EditorView, event: ClipboardEvent) => {
                const fs = imageFiles(event.clipboardData?.files);
                if (fs.length) { event.preventDefault(); return addImages.current(fs); }
                // Pasting past the limit goes in whole — the old version cut the excess here.
                if (!onPaste) return false;
                // Old code reads event.target.innerText -> wait until the paste finishes.
                setTimeout(() => onPaste({target: {innerText: editor ? editor.getText() : ''}}), 0);
                return false;
            },
        },
        // Merge consecutive keystrokes into one onChange call (keeps old behavior).
        onUpdate: ({editor}) => {
            onLive?.(editor.getHTML());
            if (!onChange) return;
            if (timeout.current) clearTimeout(timeout.current);
            latest.current.html = editor.getHTML();
            timeout.current = setTimeout(flush, 500);
        },
        onBlur: () => { flush(); if (onBlur) onBlur(); },
    });

    (editorRef as {current: typeof editor}).current = editor;

    // Shim: old code passes a ref through the PROP refMedium (not a React ref)
    // then calls refMedium.current.medium.setContent/getContent/elements[0].focus().
    useEffect(() => {
        if (!refMedium || !editor) return;
        refMedium.current = {
            medium: {
                // ponytail: emitUpdate=true — the old medium-editor fired editableInput on
                // setContent, and FillBlank/ErrorIdentify rely on it to save data.answer.
                setContent: (html?: string) => editor.commands.setContent(html || '', true),
                getContent: () => editor.getHTML(),
                get elements() { return [editor.view.dom] },
            },
            editor,
        };
    }, [editor, refMedium]);

    // Content changed from outside (not by typing) -> sync into the editor.
    // ponytail: skipped while the editor is focused. onChange (debounced 500ms) pushes
    // HTML up to globalState, the text prop comes back as a different string ->
    // setContent -> the caret jumps to the end mid-typing. While typing, the
    // editor's content is the newest version, so there is nothing to sync into it.
    useEffect(() => {
        if (editor && !editor.isFocused && text !== undefined && text !== editor.getHTML()) {
            editor.commands.setContent(text || '', false);
        }
    }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Caret into the first cell: inserted at the end of a paragraph, TipTap leaves it after the table.
    const insertTable = (rows: number, cols: number, header: boolean) => {
        if (!editor) return;
        const from = editor.state.selection.from;
        editor.chain().focus().insertTable({rows, cols, withHeaderRow: header}).run();
        let at = -1;
        editor.state.doc.descendants((n, pos) => { if (at < 0 && n.type.name === 'table' && pos >= from - 1) at = pos; return at < 0; });
        if (at >= 0) editor.commands.setTextSelection(at + 4);
    };

    return <div className='tt-editor' onKeyUp={onKeyUp}>
        {!disableStyle && <EditorToolbar editor={editor} variant={variant} type={type} onToAnswerButton={onToAnswerButton}
                                         onSigma={() => setMath({pos: null, latex: ''})} onImage={() => setImageOpen(true)}
                                         onChars={() => setCharsOpen(true)} onTable={() => setTableOpen(true)}/>}
        <EditorContent editor={editor}/>
        {uploads.view}
        {maxChars !== undefined && editor && (() => {
            const n = textLength(editor.getHTML());
            return n > maxChars * 0.9 && <div className={'tt-count' + (n > maxChars ? ' over' : '')} role={n > maxChars ? 'alert' : undefined}>
                {n.toLocaleString('vi-VN')} / {maxChars.toLocaleString('vi-VN')} ký tự{n > maxChars && ' — quá dài, rút gọn rồi lưu.'}</div>;
        })()}
        {math && <Suspense fallback={null}>
            <MathDialog open latex={math.latex} onCancel={() => setMath(null)}
                        onDone={latex => {
                            if (editor && latex.trim()) {
                                if (math.pos === null) editor.chain().focus().insertContent({type: 'math', attrs: {latex}}).run();
                                else editor.view.dispatch(editor.state.tr.setNodeMarkup(math.pos, undefined, {latex}));
                            }
                            setMath(null);
                        }}/>
        </Suspense>}
        <CharDialog open={charsOpen} onClose={() => setCharsOpen(false)}
                    onInsert={c => editor?.chain().focus().insertContent(c).run()}/>
        <TableDialog open={tableOpen} onClose={() => setTableOpen(false)}
                     onInsert={insertTable}/>
        {imageOpen && <ImageDialog open onClose={() => setImageOpen(false)}
                                   onInsert={src => editor?.chain().focus().insertContent({type: 'image', attrs: {src}}).run()}/>}
    </div>
}
