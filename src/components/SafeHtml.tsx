import {useState} from 'react';
import parse, {attributesToProps} from 'html-react-parser';
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
const isTag = (n: DOMNode): n is Element => n.type === 'tag';

/** An image that fails to load shows a grey box instead of the browser's broken icon (spec §3.4). */
function Img(props: Record<string, unknown>) {
    const [broken, setBroken] = useState(false);
    if (broken) return <span className='vt-img-broken' role='img' aria-label='Không tải được hình'>
        <span aria-hidden>🖼</span> Không tải được hình…
    </span>;
    // every rendered image (student exam, review, bank view, import preview) is capped to its container, whatever width Word wrote
    return <img alt='' {...props} style={{...(props.style as object), maxWidth: '100%', height: 'auto'}} onError={() => setBroken(true)}/>;
}

export default function renderHTML(html?: string | null) {
    return parse(DOMPurify.sanitize(html || ''), {
        replace: n => {
            if (!isTag(n)) return;
            if (n.name === 'span' && n.attribs['data-latex'] !== undefined) return <span data-latex={n.attribs['data-latex']}
                dangerouslySetInnerHTML={{__html: katex.renderToString(n.attribs['data-latex'], {throwOnError: false})}}/>;
            if (n.name === 'img') return <Img {...attributesToProps(n.attribs)}/>;
        },
    });
}
