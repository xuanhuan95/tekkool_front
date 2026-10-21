import parse from 'html-react-parser';
import type {DOMNode, Element} from 'html-react-parser';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ponytail: replaces react-render-html (dead since 2018). Also filters XSS — exam
// content is entered by teachers, and the old code rendered it raw so an injected
// <script> would run.
// Formulas from Word import are stored as <span data-latex="..."></span>; draw them
// here with KaTeX (its output is its own markup, built from the LaTeX string, not
// from the teacher's HTML).
const isMath = (n: DOMNode): n is Element =>
    n.type === 'tag' && (n as Element).name === 'span' && (n as Element).attribs?.['data-latex'] !== undefined;

export default function renderHTML(html?: string | null) {
    return parse(DOMPurify.sanitize(html || ''), {
        replace: n => isMath(n)
            ? <span data-latex={n.attribs['data-latex']}
                    dangerouslySetInnerHTML={{__html: katex.renderToString(n.attribs['data-latex'], {throwOnError: false})}}/>
            : undefined,
    });
}
