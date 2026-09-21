import React, {useEffect, useRef, useState} from "react";
import {useEditor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Extension} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CheckItem from './CheckItem';

import './Editor.css';

// Lấy text thuần của doc ProseMirror. Mỗi block là 1 ranh giới ('\n').
// NFC bắt buộc — 'ệ' gõ trên macOS là e + 2 dấu rời (NFD) nên .length ra 3 thay
// vì 1, cùng một câu lệch tới 35%.
const docText = (doc) => doc.textBetween(0, doc.content.size, '\n', '\n').normalize('NFC');

const WORD = 'word';

// Đếm theo đơn vị giáo viên chọn.
// 'word': tách theo dấu cách — đúng cho CẢ Tiếng Anh ("I am a student" = 4 từ)
//   lẫn Ngữ văn ("Trường Trung học phổ thông" = 5 chữ), vì tiếng Việt viết rời
//   từng tiếng nên "đếm chữ/tiếng" chính là tách dấu cách.
// 'char': ponytail: đếm THÔ (không trim, không gộp space) — trim thì space cuối
//   tính 0 nên gõ space vô hạn được ở mốc 20/20, nhìn như hỏng.
function measure(text, unit) {
    if (unit !== WORD) return text.length;
    const t = text.trim();
    return t === '' ? 0 : t.split(/\s+/).length;
}

const docSize = (doc, unit) => measure(docText(doc), unit);

// Cắt phần dán cho vừa hạn mức. Chặt nhị phân trên số ký tự rồi (nếu đếm từ)
// lùi về ranh giới từ gần nhất — cắt giữa chữ thì "student" thành "stud".
function trimToFit(head, pasted, max, unit) {
    let lo = 0, hi = pasted.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (measure(head + pasted.slice(0, mid), unit) <= max) lo = mid; else hi = mid - 1;
    }
    let cut = pasted.slice(0, lo);
    if (unit === WORD && lo < pasted.length) {
        // Bỏ từ bị cắt dở ("stud") VÀ space cuối. Giữ space thì head thành
        // "...rat " -> gõ tiếp 1 chữ là sang từ thứ 6 nên bị chặn, trong khi gõ
        // space lại lọt (trim bỏ đi, vẫn 5 từ) — đúng ngược ý muốn.
        cut = cut.replace(/\s*\S*$/, '');
    }
    return cut;
}

// ponytail: chặn ở filterTransaction của plugin ProseMirror, KHÔNG ở
// handleKeyDown — bộ gõ tiếng Việt (Telex/VNI) đi qua IME composition chứ không
// sinh keydown, gõ "dda" -> "đa" lọt thẳng; paste và kéo-thả cũng vậy. Mọi thay
// đổi đều qua transaction nên đây là tầng duy nhất kín.
// (option filterTransaction truyền thẳng cho useEditor bị tiptap lờ đi.)
const SizeLimit = (limitRef) => Extension.create({
    name: 'sizeLimit',
    addProseMirrorPlugins() {
        // Vị trí vừa chặn một space vì đã đủ từ. Chỉ sống đến lần gõ kế tiếp:
        // mọi transaction làm đổi nội dung đều xoá đi, nếu không sẽ chặn oan.
        const blockedAt = {current: -1};
        return [new Plugin({
            props: {
                // ponytail: gõ nhanh / IME nhả cả cụm -> cả cụm là MỘT transaction,
                // filterTransaction từ chối trọn gói nên không vào được chữ nào dù
                // vẫn còn chỗ. Ở đây cắt vừa đủ rồi chèn, phần thừa bỏ.
                handleTextInput: (view, from, to, text) => {
                    const {max, unit} = limitRef.current;
                    if (!(max > 0)) return false;
                    const doc = docText(view.state.doc);
                    const sel = view.state.doc.textBetween(from, to, '\n', '\n').normalize('NFC');
                    const head = doc.slice(0, doc.length - sel.length);
                    // Đếm từ dùng trim() nên space cuối không tính -> ở mốc đủ từ
                    // là gõ space được vô hạn. Đủ từ rồi thì space chỉ mở ra từ
                    // mới không bao giờ viết được, chặn luôn.
                    if (unit === WORD && /\s$/.test(text) && measure(head, unit) >= max) {
                        blockedAt.current = to;
                        return true;
                    }
                    // Space vừa bị chặn nên không nằm trong head: học sinh tưởng đã
                    // sang từ mới, gõ tiếp thì chữ DÍNH vào từ cuối ("đông"+"d"
                    // ="đôngd"). Không phân biệt được bằng nội dung — "đôn"+"g"
                    // (viết dở, phải cho qua) cũng đếm 4 từ y hệt. Nên nhớ lại vị
                    // trí vừa chặn space: gõ tiếp ngay đó là ca dính chữ, chặn.
                    // Nhớ theo `to`: gõ telex "đ" là d rồi d THAY ký tự trước
                    // (from = to-1), so bằng `from` sẽ trượt mất ca này.
                    if (unit === WORD && blockedAt.current === to) return true;
                    if (measure(head + text, unit) <= max) return false;
                    const fit = trimToFit(head, text.normalize('NFC'), max, unit);
                    if (fit) view.dispatch(view.state.tr.insertText(fit, from, to));
                    return true;
                },
            },
            filterTransaction: (tr, state) => {
                const {max, unit} = limitRef.current;
                if (tr.docChanged) blockedAt.current = -1;
                if (!(max > 0) || !tr.docChanged) return true;
                const before = docText(state.doc), now = docText(tr.doc);
                const after = measure(now, unit);
                // Đủ từ rồi mà chỉ thêm space ở cuối -> trim() nuốt mất nên
                // measure không tăng, space lọt vô hạn. Chặn riêng ca này.
                if (unit === WORD && now.length > before.length
                    && now.trimEnd() === before.trimEnd() && after >= max) return false;
                // Cho qua nếu không làm bài dài thêm — xoá, gõ đè vùng bôi đen,
                // và (đếm từ) gõ nốt chữ của từ đang viết dở. Nếu chặn cứng thì
                // lỡ vượt hạn là kẹt luôn, xoá cũng không được.
                return after <= max || after <= measure(before, unit);
            },
        })];
    },
});

// Nút toolbar. active = đang bật định dạng đó cho vùng đang chọn.
function Btn({onClick, active, title, children}) {
    return <button type='button' title={title}
                   className={'tt-btn' + (active ? ' active' : '')}
                   onMouseDown={e => e.preventDefault()}
                   onClick={onClick}>{children}</button>
}

function Toolbar({editor, type, onToAnswerButton}) {
    if (!editor) return null;
    // ponytail: setTextAlign luôn GÁN, không gỡ -> bấm căn trái để sửa đoạn lỡ
    // căn phải sẽ lưu text-align:left, rác vẫn nằm trong HTML. Toggle như Bold:
    // đang active thì bấm lại là unset, trả đoạn về không style.
    const align = a => editor.chain().focus()[
        editor.isActive({textAlign: a}) ? 'unsetTextAlign' : 'setTextAlign'](a).run();

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
             onClick={() => align('right')}><i className='align right icon'/></Btn>
        {onToAnswerButton &&
            <Btn title='Chuyển vùng chọn thành đáp án' onClick={toAnswer}>
                <i className='angle double down icon'/>
            </Btn>}
    </div>
}

export function Editor(props) {
    const {
        text, placeholder, type, onChange, onToAnswerButton,
        onPaste, onKeyUp, onBlur, disableReturn, disableStyle, refMedium, maxChars, maxWords,
    } = props;

    const timeout = useRef(null);
    const [size, setSize] = useState(0);
    // maxWords thắng nếu truyền cả hai — đề chỉ đặt 1 đơn vị.
    const unit = maxWords > 0 ? WORD : 'char';
    const max = maxWords > 0 ? maxWords : maxChars;
    // ponytail: useEditor bắt closure 1 lần -> đọc hạn mức qua ref, không thì
    // đổi giới hạn giữa chừng handler vẫn dùng số cũ.
    const limit = useRef({max, unit});
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
            SizeLimit(limit),
        ],
        content: text || '',
        editorProps: {
            // disableReturn: chặn xuống dòng cho ô 1 dòng (đáp án).
            handleKeyDown: (view, event) =>
                disableReturn && event.key === 'Enter' ? (event.preventDefault(), true) : false,
            handlePaste: (view, event) => {
                // ponytail: filterTransaction chặn cả cụm khi paste vượt hạn (bỏ
                // sạch, khó chịu) -> tự cắt phần thừa rồi chèn text thuần.
                const {max, unit} = limit.current;
                if (max > 0 && event.clipboardData) {
                    const {from, to} = view.state.selection;
                    const doc = docText(view.state.doc);
                    const sel = view.state.doc.textBetween(from, to, '\n', '\n').normalize('NFC');
                    const pasted = (event.clipboardData.getData('text/plain') || '').normalize('NFC');
                    // Đo trên văn bản SAU khi dán: đếm từ không cộng dồn được
                    // (dán "xyz" vào cuối "abc" ra 1 từ, không phải 2).
                    const head = doc.slice(0, doc.length - sel.length);
                    if (measure(head + pasted, unit) > max) {
                        event.preventDefault();
                        const fit = trimToFit(head, pasted, max, unit);
                        if (fit) view.dispatch(view.state.tr.insertText(fit, from, to));
                        return true;
                    }
                }
                if (!onPaste) return false;
                // Code cũ đọc event.target.innerText -> đợi paste xong mới gọi.
                setTimeout(() => onPaste({target: {innerText: editor.getText()}}), 0);
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
                setContent: html => editor.commands.setContent(html || '', true),
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

    useEffect(() => () => timeout.current && clearTimeout(timeout.current), []);

    return <div className='tt-editor' onKeyUp={onKeyUp}>
        {!disableStyle && <Toolbar editor={editor} type={type} onToAnswerButton={onToAnswerButton}/>}
        <EditorContent editor={editor}/>
        {max > 0 &&
            <div className='tt-charcount' style={{color: size >= max ? '#db2828' : '#767676'}}>
                {size} / {max} {unit === WORD ? 'từ' : 'ký tự'}
            </div>}
    </div>
}
