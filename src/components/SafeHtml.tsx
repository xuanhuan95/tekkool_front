import parse from 'html-react-parser';
import DOMPurify from 'dompurify';

// ponytail: replaces react-render-html (dead since 2018). Also filters XSS — exam
// content is entered by teachers, and the old code rendered it raw so an injected
// <script> would run.
export default function renderHTML(html?: string | null) {
    return parse(DOMPurify.sanitize(html || ''));
}
