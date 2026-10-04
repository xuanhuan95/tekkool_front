import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import Passage from './Passage';
import type {Question} from '../pages/exam-creation/Default';

// Ngữ liệu đọc hiểu in MỘT lần ở câu đầu nhóm, dùng ở 4 màn (làm bài, xem
// trước, in đề, soạn đề) nên sai là hỏng cả 4.
// Test cũ (Passage.test.js) chép lại điều kiện ra hàm riêng — chép sai thì
// test vẫn xanh. Đây render chính component.

const q = (passage: string | null, passageId: string | null) =>
    ({data: passage ? {passage, passageId} : {}}) as unknown as Question;

const A = q('<p>Văn bản 1</p>', 'G1');
const B = q('<p>Văn bản 2</p>', 'G2');
const plain = q(null, null);

const text = (question: Question, prev?: Question) =>
    render(<Passage question={question} prev={prev}/>).container.textContent;

describe('Passage', () => {
    it('câu đầu section in ngữ liệu', () => expect(text(A)).toBe('Văn bản 1'));
    it('câu 2 cùng nhóm KHÔNG in lại', () => expect(text(A, A)).toBe(''));
    it('sang nhóm mới phải in ngữ liệu mới', () => expect(text(B, A)).toBe('Văn bản 2'));
    it('câu 5 cùng nhóm 2 không in lại', () => expect(text(B, B)).toBe(''));
    it('câu không có ngữ liệu thì không in gì', () => expect(text(plain, A)).toBe(''));
    it('nhóm bắt đầu sau một câu lẻ vẫn phải in', () => expect(text(A, plain)).toBe('Văn bản 1'));
    it('tự luận không ăn ngữ liệu của nhóm trước', () => expect(text(plain, B)).toBe(''));
    it('câu data rỗng không vỡ', () => expect(text({data: {}} as Question, A)).toBe(''));
    it('question không có data không vỡ', () => expect(text({} as Question, A)).toBe(''));

    // SafeHtml lọc XSS: nội dung đề do giáo viên nhập, code cũ render thô.
    it('lọc <script> trong ngữ liệu', () => {
        const xss = q('<p>An toàn</p><script>window.__hacked = 1</script>', 'G9');
        const {container} = render(<Passage question={xss}/>);
        expect(container.querySelector('script')).toBeNull();
        expect(container.textContent).toContain('An toàn');
    });
});
