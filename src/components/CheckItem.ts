import {Node, mergeAttributes} from '@tiptap/core';

// ponytail: Tiptap drops every tag not in its schema, so <span class="check-item">
// has to be declared as a node. Empty (atom) node — the A/B/C numbers come from
// a CSS counter, replacing the jQuery DOM patch in the old ErrorIdentify.
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
