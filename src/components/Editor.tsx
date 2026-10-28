import {Suspense, lazy, useEffect, useRef, useState} from "react";
import {useEditor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type {Node as PMNode} from '@tiptap/pm/model';
import type {EditorView} from '@tiptap/pm/view';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CheckItem from './CheckItem';
import EditorToolbar from './EditorToolbar';
import type {EditorVariant} from './EditorToolbar';
import ImageDialog from './ImageDialog';
import {Superscript, Subscript, Image, MathInline} from './RichExtras';
import {measure, WORD} from './textLimit';
import type {Unit} from './textLimit';

import './Editor.css';

// MathLive is big: only downloaded when a student opens Σ.
const MathDialog = lazy(() => import('./MathDialog'));

// Plain text of a ProseMirror doc. Each block is a boundary ('\n').
// NFC is mandatory — 'ệ' typed on macOS is e + 2 combining marks (NFD), so
// .length gives 3 instead of 1, and the same sentence can be off by up to 35%.
const docText = (doc: PMNode): string => doc.textBetween(0, doc.content.size, '\n', '\n').normalize('NFC');

const docSize = (doc: PMNode, unit: Unit): number => measure(docText(doc), unit);

// ponytail: the word limit NO LONGER blocks typing — it is only a number for
// counting and for classifying blocks in the bank (core_question_bank._tu_luan_type).
// The old version blocked in ProseMirror's filterTransaction because Telex/VNI
// input goes through the IME and handleKeyDown sees nothing; that layer is gone
// now, so students can write past the limit freely.
type Limit = {max: number; unit: Unit};

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
    disableReturn?: boolean;
    disableStyle?: boolean;
    /** student: toolbar with Σ (formula keyboard), no images. teacher (default): image insert, no Σ. disableStyle hides the toolbar. */
    variant?: EditorVariant;
    /** Shim for legacy code: NOT a React ref, see the useEffect below. */
    refMedium?: {current: any};
    maxChars?: number;
    maxWords?: number;
};

export function Editor(props: EditorProps) {
    const {
        text, placeholder, type, onChange, onToAnswerButton,
        onPaste, onKeyUp, onBlur, disableReturn, disableStyle, refMedium, maxChars, maxWords,
        variant = 'teacher',
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
    const [size, setSize] = useState(0);
    // maxWords wins if both are passed — an exam sets only one unit.
    const unit: Unit = maxWords && maxWords > 0 ? WORD : 'char';
    const max = (maxWords && maxWords > 0 ? maxWords : maxChars) || 0;
    // ponytail: useEditor captures the closure once -> read the limit through a
    // ref, otherwise handlers keep the old number after the limit changes.
    const limit = useRef<Limit>({max, unit});
    limit.current = {max, unit};

    // Σ dialog state (student): pos != null = editing the formula node at that position.
    const [math, setMath] = useState<{pos: number | null; latex: string} | null>(null);
    const [imageOpen, setImageOpen] = useState(false);
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
            variant === 'student' ? MathInline.configure({onEdit: (pos, latex) => editMath.current(pos, latex)}) : MathInline,
        ],
        content: text || '',
        editorProps: {
            // disableReturn: block line breaks for single-line boxes (answers).
            handleKeyDown: (_view: EditorView, event: KeyboardEvent) =>
                disableReturn && event.key === 'Enter' ? (event.preventDefault(), true) : false,
            handlePaste: () => {
                // Pasting past the limit goes in whole — the old version cut the excess here.
                if (!onPaste) return false;
                // Old code reads event.target.innerText -> wait until the paste finishes.
                setTimeout(() => onPaste({target: {innerText: editor ? editor.getText() : ''}}), 0);
                return false;
            },
        },
        // Merge consecutive keystrokes into one onChange call (keeps old behavior).
        onUpdate: ({editor}) => {
            setSize(docSize(editor.state.doc, limit.current.unit));
            if (!onChange) return;
            if (timeout.current) clearTimeout(timeout.current);
            latest.current.html = editor.getHTML();
            timeout.current = setTimeout(flush, 500);
        },
        onBlur: () => { flush(); if (onBlur) onBlur(); },
    });

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
            setSize(docSize(editor.state.doc, limit.current.unit));
        }
    }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <div className='tt-editor' onKeyUp={onKeyUp}>
        {!disableStyle && <EditorToolbar editor={editor} variant={variant} type={type} onToAnswerButton={onToAnswerButton}
                                         onSigma={() => setMath({pos: null, latex: ''})} onImage={() => setImageOpen(true)}/>}
        <EditorContent editor={editor}/>
        {/* Always gray: going over the word count is no longer an error, so no alarm. */}
        {max > 0 &&
            <div className='tt-charcount' style={{color: '#767676'}}>
                {size} / {max} {unit === WORD ? 'từ' : 'ký tự'}
            </div>}
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
        {imageOpen && <ImageDialog open onClose={() => setImageOpen(false)}
                                   onInsert={src => editor?.chain().focus().insertContent({type: 'image', attrs: {src}}).run()}/>}
    </div>
}
