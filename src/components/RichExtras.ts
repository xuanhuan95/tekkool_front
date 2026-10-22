import {Mark, Node, mergeAttributes} from '@tiptap/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ponytail: Tiptap drops every tag not in its schema. Word import emits
// x<sup>2</sup>, H<sub>2</sub>O, <img src="data:..."> and <span data-latex="...">
// (core_docx.paragraphs), so without these the teacher opens the question and the
// formula/picture is gone. Hand-rolled instead of @tiptap/extension-* — a few
// lines, no new deps.
export const Superscript = Mark.create({
    name: 'superscript',
    excludes: 'subscript',
    parseHTML() { return [{tag: 'sup'}] },
    renderHTML({HTMLAttributes}) { return ['sup', mergeAttributes(HTMLAttributes), 0] },
});

export const Subscript = Mark.create({
    name: 'subscript',
    excludes: 'superscript',
    parseHTML() { return [{tag: 'sub'}] },
    renderHTML({HTMLAttributes}) { return ['sub', mergeAttributes(HTMLAttributes), 0] },
});

export const Image = Node.create({
    name: 'image',
    group: 'inline',
    inline: true,
    atom: true,
    draggable: true,
    addAttributes() { return {src: {default: null}} },
    parseHTML() { return [{tag: 'img[src]'}] },
    renderHTML({HTMLAttributes}) { return ['img', mergeAttributes(HTMLAttributes)] },
});

// Rendered with KaTeX for display only; the stored HTML keeps the LaTeX source in
// data-latex, so the teacher can still read it and the grader never sees rendered markup.
export function renderMath(el: HTMLElement, latex: string) {
    try {
        katex.render(latex, el, {throwOnError: false});
    } catch {
        el.textContent = latex;
    }
}

export const MathInline = Node.create({
    name: 'math',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes() {
        return {latex: {default: '', parseHTML: el => el.getAttribute('data-latex') || '',
                        renderHTML: a => ({'data-latex': a.latex})}};
    },
    parseHTML() { return [{tag: 'span[data-latex]'}] },
    renderHTML({HTMLAttributes}) { return ['span', mergeAttributes(HTMLAttributes)] },
    addNodeView() {
        return ({node}) => {
            const dom = document.createElement('span');
            dom.setAttribute('data-latex', node.attrs.latex);
            renderMath(dom, node.attrs.latex);
            return {dom};
        };
    },
});
