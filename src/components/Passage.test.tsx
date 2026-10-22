import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import Passage from './Passage';
import type {Question} from '../pages/exam-creation/Default';

// The reading passage prints ONCE at the first question of the group, used on 4
// screens (exam-taking, preview, print, authoring), so a mistake breaks all 4.
// The old test (Passage.test.js) copied the condition into its own function — a
// wrong copy would still stay green. This one renders the component itself.

const q = (passage: string | null, passageId: string | null) =>
    ({data: passage ? {passage, passageId} : {}}) as unknown as Question;

const A = q('<p>Văn bản 1</p>', 'G1');
const B = q('<p>Văn bản 2</p>', 'G2');
const plain = q(null, null);

const text = (question: Question, prev?: Question) =>
    render(<Passage question={question} prev={prev}/>).container.textContent;

describe('Passage', () => {
    it('first question of the section prints the passage', () => expect(text(A)).toBe('Văn bản 1'));
    it('question 2 in the same group does NOT reprint', () => expect(text(A, A)).toBe(''));
    it('a new group must print the new passage', () => expect(text(B, A)).toBe('Văn bản 2'));
    it('question 5 in group 2 does not reprint', () => expect(text(B, B)).toBe(''));
    it('a question without a passage prints nothing', () => expect(text(plain, A)).toBe(''));
    it('a group starting after a standalone question must still print', () => expect(text(A, plain)).toBe('Văn bản 1'));
    it('an essay does not inherit the previous group\'s passage', () => expect(text(plain, B)).toBe(''));
    it('a question with empty data does not break', () => expect(text({data: {}} as Question, A)).toBe(''));
    it('a question without data does not break', () => expect(text({} as Question, A)).toBe(''));

    // The text number is generated at DISPLAY time, in the order of the exam being
    // viewed. Previously the "VĂN BẢN n" label was hard-baked into the passage at
    // import: a block pulled from the bank into another exam showed "Phần I" as
    // "VĂN BẢN 2", and two blocks pulled into the same exam both carried number 2.
    //
    // Fixture content deliberately does NOT contain the words "văn bản" so it cannot be confused with the label.
    const X = q('<p>Chùm khế ngọt</p>', 'GX');
    const Y = q('<p>Trọn kiếp con người</p>', 'GY');
    const label = (question: Question, prev: Question | undefined, questions: Question[]) =>
        render(<Passage question={question} prev={prev} questions={questions}/>)
            .container.querySelector('b');

    it('two texts: first block is 1, second is 2 — in the NEW exam order', () => {
        const qs = [X, X, Y, Y];
        expect(label(X, undefined, qs)!.textContent).toBe('VĂN BẢN 1');
        expect(label(Y, X, qs)!.textContent).toBe('VĂN BẢN 2');
    });

    it('a single text is NOT numbered — "VĂN BẢN 1" alone is surplus wording', () => {
        expect(label(X, undefined, [X, X])).toBeNull();
    });

    it('number follows position in the exam, not the original exam\'s id', () => {
        // GY was "text 2" in the old exam, now it is first -> must be 1.
        const qs = [Y, X];
        expect(label(Y, undefined, qs)!.textContent).toBe('VĂN BẢN 1');
        expect(label(X, Y, qs)!.textContent).toBe('VĂN BẢN 2');
    });

    it('a standalone question without a passage in between does not shift the number', () => {
        const qs = [X, plain, Y];
        expect(label(Y, plain, qs)!.textContent).toBe('VĂN BẢN 2');
    });

    it('without questions, no numbering (screens not yet updated still work)', () => {
        expect(render(<Passage question={X}/>).container.querySelector('b')).toBeNull();
    });

    // SafeHtml filters XSS: exam content is entered by teachers, the old code rendered it raw.
    it('filters <script> in the passage', () => {
        const xss = q('<p>An toàn</p><script>window.__hacked = 1</script>', 'G9');
        const {container} = render(<Passage question={xss}/>);
        expect(container.querySelector('script')).toBeNull();
        expect(container.textContent).toContain('An toàn');
    });
});
