import parse from 'html-react-parser';
import DOMPurify from 'dompurify';

// ponytail: thay react-render-html (chết từ 2018). Lọc XSS luôn — nội dung đề thi
// do giáo viên nhập, code cũ render thô nên <script> chèn vào là chạy.
export default function renderHTML(html) {
    return parse(DOMPurify.sanitize(html || ''));
}
