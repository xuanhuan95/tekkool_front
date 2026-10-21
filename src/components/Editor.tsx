import {useEffect, useRef, useState} from "react";
import type {ReactNode} from "react";
import {useEditor, EditorContent} from '@tiptap/react';
import type {Editor as TiptapEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type {Node as PMNode} from '@tiptap/pm/model';
import type {EditorView} from '@tiptap/pm/view';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CheckItem from './CheckItem';
import {Superscript, Subscript, Image, MathInline} from './RichExtras';
import {measure, WORD} from './textLimit';
import type {Unit} from './textLimit';

import './Editor.css';

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

// Toolbar button. active = that format is on for the current selection.
type BtnProps = {
    onClick: () => void;
    title: string;
    children: ReactNode;
    /** Omitted = action button (no on/off state). */
    active?: boolean;
};

function Btn({onClick, active, title, children}: BtnProps) {
    return <button type='button' title={title}
                   className={'tt-btn' + (active ? ' active' : '')}
                   onMouseDown={e => e.preventDefault()}
                   onClick={onClick}>{children}</button>
}

type ToolbarProps = {
    editor: TiptapEditor | null;
    type?: string;
    onToAnswerButton?: (selected: string) => void;
};

function Toolbar({editor, type, onToAnswerButton}: ToolbarProps) {
    if (!editor) return null;
    // ponytail: setTextAlign always SETS, never clears -> clicking align-left to
    // fix a paragraph accidentally right-aligned would store text-align:left, and
    // the junk stays in the HTML. Toggle like Bold: when active, clicking again
    // unsets it and returns the paragraph to no style.
    const align = (a: string) => editor.chain().focus()[
        editor.isActive({textAlign: a}) ? 'unsetTextAlign' : 'setTextAlign'](a).run();

    // Select a passage -> replace it with a blank, the passage becomes the answer.
    const toAnswer = () => {
        const {from, to} = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to, ' ');
        if (!selected) return;
        editor.chain().focus().insertContent(
            type === 'ErrorIdentify' ? {type: 'checkItem'} : '__________'
        ).run();
        onToAnswerButton && onToAnswerButton(selected);
    };

    return <div className='tt-toolbar'>
        <Btn title='Bold' active={editor.isActive('bold')}
             onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn title='Italic' active={editor.isActive('italic')}
             onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title='Underline' active={editor.isActive('underline')}
             onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn title='Căn trái' active={editor.isActive({textAlign: 'left'})}
             onClick={() => align('left')}><i className='align left icon'/></Btn>
        <Btn title='Căn giữa' active={editor.isActive({textAlign: 'center'})}
             onClick={() => align('center')}><i className='align center icon'/></Btn>
        <Btn title='Căn phải' active={editor.isActive({textAlign: 'right'})}
             onClick={() => align('right')}><i className='align right icon'/></Btn>
        {onToAnswerButton &&
            <Btn title='Chuyển vùng chọn thành đáp án' onClick={toAnswer}>
                <i className='angle double down icon'/>
            </Btn>}
    </div>
}

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
    /** Shim for legacy code: NOT a React ref, see the useEffect below. */
    refMedium?: {current: any};
    maxChars?: number;
    maxWords?: number;
};

export function Editor(props: EditorProps) {
    const {
        text, placeholder, type, onChange, onToAnswerButton,
        onPaste, onKeyUp, onBlur, disableReturn, disableStyle, refMedium, maxChars, maxWords,
    } = props;

    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [size, setSize] = useState(0);
    // maxWords wins if both are passed — an exam sets only one unit.
    const unit: Unit = maxWords && maxWords > 0 ? WORD : 'char';
    const max = (maxWords && maxWords > 0 ? maxWords : maxChars) || 0;
    // ponytail: useEditor captures the closure once -> read the limit through a
    // ref, otherwise handlers keep the old number after the limit changes.
    const limit = useRef<Limit>({max, unit});
    limit.current = {max, unit};

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
            Superscript, Subscript, Image, MathInline,
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
            timeout.current = setTimeout(() => onChange(editor.getHTML()), 500);
        },
        onBlur: () => onBlur && onBlur(),
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

    useEffect(() => () => {
        if (timeout.current) clearTimeout(timeout.current);
    }, []);

    return <div className='tt-editor' onKeyUp={onKeyUp}>
        {!disableStyle && <Toolbar editor={editor} type={type} onToAnswerButton={onToAnswerButton}/>}
        <EditorContent editor={editor}/>
        {/* Always gray: going over the word count is no longer an error, so no alarm. */}
        {max > 0 &&
            <div className='tt-charcount' style={{color: '#767676'}}>
                {size} / {max} {unit === WORD ? 'từ' : 'ký tự'}
            </div>}
    </div>
}
