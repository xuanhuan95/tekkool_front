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
import {measure, WORD} from './textLimit';
import type {Unit} from './textLimit';

import './Editor.css';

// Lấy text thuần của doc ProseMirror. Mỗi block là 1 ranh giới ('\n').
// NFC bắt buộc — 'ệ' gõ trên macOS là e + 2 dấu rời (NFD) nên .length ra 3 thay
// vì 1, cùng một câu lệch tới 35%.
const docText = (doc: PMNode): string => doc.textBetween(0, doc.content.size, '\n', '\n').normalize('NFC');

const docSize = (doc: PMNode, unit: Unit): number => measure(docText(doc), unit);

// ponytail: giới hạn từ KHÔNG còn chặn gõ — chỉ còn là con số để đếm và để
// phân loại khối trong ngân hàng (core_question_bank._tu_luan_type). Bản cũ
// chặn ở filterTransaction của ProseMirror vì bộ gõ Telex/VNI đi qua IME nên
// handleKeyDown không thấy gì; nay bỏ hẳn tầng đó, học sinh viết quá thoải mái.
type Limit = {max: number; unit: Unit};

// Nút toolbar. active = đang bật định dạng đó cho vùng đang chọn.
type BtnProps = {
    onClick: () => void;
    title: string;
    children: ReactNode;
    /** Khong truyen = nut hanh dong (khong co trang thai bat/tat). */
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
    // ponytail: setTextAlign luôn GÁN, không gỡ -> bấm căn trái để sửa đoạn lỡ
    // căn phải sẽ lưu text-align:left, rác vẫn nằm trong HTML. Toggle như Bold:
    // đang active thì bấm lại là unset, trả đoạn về không style.
    const align = (a: string) => editor.chain().focus()[
        editor.isActive({textAlign: a}) ? 'unsetTextAlign' : 'setTextAlign'](a).run();

    // Bôi đen một đoạn -> thay bằng chỗ trống, đoạn đó thành đáp án.
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
    /** 'ErrorIdentify' chen o tich thay vi gach chan. */
    type?: string;
    onChange?: (html: string) => void;
    onToAnswerButton?: (selected: string) => void;
    onPaste?: (e: {target: {innerText: string}}) => void;
    onKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onBlur?: () => void;
    disableReturn?: boolean;
    disableStyle?: boolean;
    /** Shim cho code cu: KHONG phai ref cua React, xem useEffect ben duoi. */
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
    // maxWords thắng nếu truyền cả hai — đề chỉ đặt 1 đơn vị.
    const unit: Unit = maxWords && maxWords > 0 ? WORD : 'char';
    const max = (maxWords && maxWords > 0 ? maxWords : maxChars) || 0;
    // ponytail: useEditor bắt closure 1 lần -> đọc hạn mức qua ref, không thì
    // đổi giới hạn giữa chừng handler vẫn dùng số cũ.
    const limit = useRef<Limit>({max, unit});
    limit.current = {max, unit};

    const editor = useEditor({
        extensions: [
            StarterKit.configure({heading: false, codeBlock: false, blockquote: false}),
            Underline,
            // ponytail: ô trả lời ẩn toolbar nhưng TextAlign vẫn giữ phím tắt
            // Mod-Shift-r/l/e/j -> học sinh quen bấm Ctrl+Shift+R (reload cứng)
            // là bài nhảy sang căn phải, không có nút nào sửa lại. Ẩn toolbar
            // thì bỏ luôn extension.
            ...(disableStyle ? [] : [TextAlign.configure({types: ['paragraph']})]),
            Placeholder.configure({placeholder: placeholder || ''}),
            CheckItem,
        ],
        content: text || '',
        editorProps: {
            // disableReturn: chặn xuống dòng cho ô 1 dòng (đáp án).
            handleKeyDown: (_view: EditorView, event: KeyboardEvent) =>
                disableReturn && event.key === 'Enter' ? (event.preventDefault(), true) : false,
            handlePaste: () => {
                // Dán quá giới hạn vẫn vào đủ — bản cũ cắt phần thừa ở đây.
                if (!onPaste) return false;
                // Code cũ đọc event.target.innerText -> đợi paste xong mới gọi.
                setTimeout(() => onPaste({target: {innerText: editor ? editor.getText() : ''}}), 0);
                return false;
            },
        },
        // Gộp nhiều lần gõ liên tiếp thành 1 lần onChange (giữ hành vi cũ).
        onUpdate: ({editor}) => {
            setSize(docSize(editor.state.doc, limit.current.unit));
            if (!onChange) return;
            if (timeout.current) clearTimeout(timeout.current);
            timeout.current = setTimeout(() => onChange(editor.getHTML()), 500);
        },
        onBlur: () => onBlur && onBlur(),
    });

    // Shim: code cũ truyền ref qua PROP refMedium (không phải ref của React)
    // rồi gọi refMedium.current.medium.setContent/getContent/elements[0].focus().
    useEffect(() => {
        if (!refMedium || !editor) return;
        refMedium.current = {
            medium: {
                // ponytail: emitUpdate=true — medium-editor cũ bắn editableInput khi
                // setContent, FillBlank/ErrorIdentify dựa vào đó để lưu data.answer.
                setContent: (html?: string) => editor.commands.setContent(html || '', true),
                getContent: () => editor.getHTML(),
                get elements() { return [editor.view.dom] },
            },
            editor,
        };
    }, [editor, refMedium]);

    // Nội dung đổi từ ngoài (không phải do gõ) -> đồng bộ vào editor.
    // ponytail: bỏ qua khi editor đang focus. onChange (debounce 500ms) đẩy HTML
    // lên globalState, prop text quay lại khác chuỗi -> setContent -> con trỏ
    // nhảy về cuối giữa lúc gõ. Đang gõ thì nội dung trong editor mới là bản mới
    // nhất, không có gì để đồng bộ vào.
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
        {/* Luôn xám: vượt số từ không còn là lỗi nên không báo động. */}
        {max > 0 &&
            <div className='tt-charcount' style={{color: '#767676'}}>
                {size} / {max} {unit === WORD ? 'từ' : 'ký tự'}
            </div>}
    </div>
}
