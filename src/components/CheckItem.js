import {Node, mergeAttributes} from '@tiptap/core';

// ponytail: Tiptap bỏ mọi thẻ không có trong schema, nên <span class="check-item">
// phải khai báo thành node. Node rỗng (atom) — số A/B/C do CSS counter sinh ra,
// thay cho đoạn jQuery sửa DOM ở ErrorIdentify cũ.
export default Node.create({
    name: 'checkItem',
    group: 'inline',
    inline: true,
    atom: true,
    parseHTML() { return [{tag: 'span.check-item'}] },
    renderHTML({HTMLAttributes}) {
        return ['span', mergeAttributes(HTMLAttributes, {class: 'check-item'})]
    },
});
