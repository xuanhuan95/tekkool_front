import React, {useEffect, useRef} from "react";
import {useEditor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CheckItem from './CheckItem';

import './Editor.css';

// Nút toolbar. active = đang bật định dạng đó cho vùng đang chọn.
function Btn({onClick, active, title, children}) {
    return <button type='button' title={title}
                   className={'tt-btn' + (active ? ' active' : '')}
                   onMouseDown={e => e.preventDefault()}
                   onClick={onClick}>{children}</button>
}

function Toolbar({editor, type, onToAnswerButton}) {
    if (!editor) return null;
    const align = a => editor.chain().focus().setTextAlign(a).run();

    // Bôi đen một đoạn -> thay bằng chỗ trống, đoạn đó thành đáp án.
    const toAnswer = () => {
        const {from, to} = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to, ' ');
        if (!selected) return;
        editor.chain().focus().insertContent(
            type === 'ErrorIdentify' ? {type: 'checkItem'} : '__________'
        ).run();
        onToAnswerButton(selected);
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
             onClick={() => align('right')}><i className='align justify icon'/></Btn>
        {onToAnswerButton &&
            <Btn title='Chuyển vùng chọn thành đáp án' onClick={toAnswer}>
                <i className='angle double down icon'/>
            </Btn>}
    </div>
}

export function Editor(props) {
    const {
        text, placeholder, type, onChange, onToAnswerButton,
        onPaste, onKeyUp, onBlur, disableReturn, disableStyle, refMedium,
    } = props;

    const timeout = useRef(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({heading: false, codeBlock: false, blockquote: false}),
            Underline,
            TextAlign.configure({types: ['paragraph']}),
            Placeholder.configure({placeholder: placeholder || ''}),
            CheckItem,
        ],
        content: text || '',
        editorProps: {
            // disableReturn: chặn xuống dòng cho ô 1 dòng (đáp án).
            handleKeyDown: (view, event) =>
                disableReturn && event.key === 'Enter' ? (event.preventDefault(), true) : false,
            handlePaste: () => {
                if (!onPaste) return false;
                // Code cũ đọc event.target.innerText -> đợi paste xong mới gọi.
                setTimeout(() => onPaste({target: {innerText: editor.getText()}}), 0);
                return false;
            },
        },
        // Gộp nhiều lần gõ liên tiếp thành 1 lần onChange (giữ hành vi cũ).
        onUpdate: ({editor}) => {
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
                setContent: html => editor.commands.setContent(html || '', true),
                getContent: () => editor.getHTML(),
                get elements() { return [editor.view.dom] },
            },
            editor,
        };
    }, [editor, refMedium]);

    // Nội dung đổi từ ngoài (không phải do gõ) -> đồng bộ vào editor.
    useEffect(() => {
        if (editor && text !== undefined && text !== editor.getHTML()) {
            editor.commands.setContent(text || '', false);
        }
    }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => timeout.current && clearTimeout(timeout.current), []);

    return <div className='tt-editor' onKeyUp={onKeyUp}>
        {!disableStyle && <Toolbar editor={editor} type={type} onToAnswerButton={onToAnswerButton}/>}
        <EditorContent editor={editor}/>
    </div>
}
