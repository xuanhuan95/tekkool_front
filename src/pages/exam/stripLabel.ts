/*
 * Imported papers (core_docx) keep the numbering of the Word file inside the content: the stem
 * starts with "Câu 1." and each Đúng/Sai statement with "a)". The exam page draws its own
 * "Câu 13" / "a)", so the screen read "Câu 13 — Câu 1. Cho hàm số…" and "a) a) f(1) = 0" (QC B3).
 * PM decision: strip the label when DISPLAYING, only at the very start of the first paragraph.
 *
 * Only plain wrapper tags (<p>, <div>, <b>, <strong>, <i>, <em>, <u>, <span> without a formula) are
 * stepped over to find "the start"; anything else first (an image, a formula, text) means there is
 * no label to strip and the content is returned untouched.
 */

const SPACE = '(?:\\s|&nbsp;|\\u00a0)';
const WRAPPER_OPEN = /^<(p|div|b|strong|i|em|u|span)(\s[^>]*)?>/i;

/** "Câu 1." "Câu 12:" "câu 3)" — a number and a closing mark are required ("Câu 1 có…" stays). */
const QUESTION_LABEL = new RegExp(`^${SPACE}*Câu${SPACE}*\\d+${SPACE}*[.:)]${SPACE}*`, 'i');

function statementLabel(key: string): RegExp {
    // Only THIS statement's own letter: "b) …" is stripped from statement b, never from a.
    const k = key.replace(/[^a-z]/gi, '');
    return new RegExp(`^${SPACE}*[${k.toLowerCase()}${k.toUpperCase()}]${SPACE}*[).]${SPACE}*`);
}

function stripAtStart(html: string, label: RegExp): string {
    let pos = 0;
    // Step over leading whitespace and plain opening wrapper tags.
    for (;;) {
        const rest = html.slice(pos);
        const ws = /^(?:\s|&nbsp;)+/.exec(rest);
        if (ws) { pos += ws[0].length; continue; }
        const tag = WRAPPER_OPEN.exec(rest);
        if (tag && !/data-latex/i.test(tag[0])) { pos += tag[0].length; continue; }
        break;
    }
    const m = label.exec(html.slice(pos));
    if (!m) return html;
    // The space between "Câu 1." and the text may sit after the label's own closing tag
    // ("<b>Câu 1.</b>&nbsp;Cho…") — drop it too, so the text starts flush.
    const after = html.slice(pos + m[0].length)
        .replace(/^((?:<\/(?:b|strong|i|em|u|span)>)*)(?:\s|&nbsp;|\u00a0)+/i, '$1');
    // Never strip everything: a statement that is only "a)" keeps its text.
    if (!after.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '')) return html;
    return html.slice(0, pos).replace(/(?:\s|&nbsp;|\u00a0)+$/, '') + after;
}

/** Remove a leading "Câu N." from a question stem. */
export function stripQuestionLabel(html: string | null | undefined): string {
    return stripAtStart(String(html ?? ''), QUESTION_LABEL);
}

/** Remove a leading "a)" / "a." matching the statement's own key from a Đúng/Sai statement. */
export function stripStatementLabel(html: string | null | undefined, key: string): string {
    return stripAtStart(String(html ?? ''), statementLabel(key));
}
