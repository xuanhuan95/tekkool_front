import {Badge, Button, Card, cx} from '../../components/ui';
import {formatDecimal} from '../../lib/format';
import {fixAnchor} from './guideContent';
import {answerCounts, countQuestions, isSevere, issueKey, partRows} from './importRules';
import type {ImportIssue, ImportedExam} from './importRules';

/** The words carry the level; colour only repeats it (design: Nặng / Nhẹ). */
export const LevelBadge = ({issue}: {issue: ImportIssue}) =>
    <Badge tone={isSevere(issue) ? 'err' : 'sun'}>{isSevere(issue) ? 'Nặng' : 'Nhẹ'}</Badge>;

/**
 * Summary table by Phần (IV2-XemTruoc): kind, questions read, answers, warnings, then "Cả đề".
 * What the file DECLARES (questions, score) is per exam only: the BE gives no per-Phần figure yet, so those cells stay "—" on the part rows.
 */
export function SummaryBar({exam, issues}: {exam: ImportedExam; issues: ImportIssue[]}) {
    const parts = partRows(exam, issues);
    const read = exam.stats?.read_questions ?? countQuestions(exam);
    const declared = exam.stats?.declared_questions;
    const {done, total} = answerCounts(exam);
    const score = exam.stats?.total_score;
    const severe = issues.filter(isSevere).length;
    const state = (a: number, b: number, noun = '') => a === b ? <span className='ok'>đủ</span> : <span className='sun'>{a < b ? `thiếu ${formatDecimal(b - a)}` : `thừa ${formatDecimal(a - b)}`} {noun}</span>;
    const warn = (e: number, l: number) => e + l === 0 ? 'không có' : [e && `${e} nặng`, l && `${l} nhẹ`].filter(Boolean).join(' · ');
    return <section className='vt-imp-sum' aria-label='Tóm tắt theo phần'>
        <h2 className='vt-imp-h2'>Tóm tắt theo phần</h2>
        <div className='vt-imp-sum-scroll'>
            <table className='vt-imp-sum-table'>
                <thead><tr><th>Phần</th><th>Dạng câu</th><th>Số câu (đọc / file ghi)</th><th>Đáp án (từng ý)</th><th>Điểm</th><th>Cảnh báo</th></tr></thead>
                <tbody>
                    {parts.map(p => <tr key={p.name + p.kind}>
                        <th scope='row'>{p.name}</th><td>{p.kind}</td>
                        <td>{p.read} / —</td>
                        <td>{p.done} / {p.total} {state(p.done, p.total)}</td>
                        <td>—</td>
                        <td className={cx(p.severe && 'err')}>{warn(p.severe, p.light)}</td>
                    </tr>)}
                </tbody>
                <tfoot><tr>
                    <th scope='row' colSpan={2}>Cả đề</th>
                    <td>{declared ? <>{read} / {declared} {state(read, declared, 'câu')}</> : <>{read} / — <span className='ok'>file không ghi số câu</span></>}</td>
                    <td>{done} / {total} {state(done, total)}</td>
                    <td>{typeof score === 'number' ? <>{formatDecimal(score)} / 10 {state(score, 10, 'điểm')}</> : '—'}</td>
                    <td className={cx(severe && 'err')}>{issues.length ? `${issues.length} · ${warn(severe, issues.length - severe)}` : 'không có'}</td>
                </tr></tfoot>
            </table>
        </div>
    </section>;
}

type ListProps = {
    issues: ImportIssue[];
    seen: Record<string, boolean>;
    onSee: (i: ImportIssue) => void;
    /** "Đến câu n": scroll the question (or its section) into view. `where` is a label like "câu 7". */
    jump: (i: ImportIssue) => string | null;
    onGo: (i: ImportIssue) => void;
    /** "Cách sửa": open the guide at this entry. */
    onFix: (anchor: string) => void;
};

/** "Cần kiểm tra n chỗ": each warning with Đến câu / Cách sửa; a Nặng one also needs "Đã xem, cho phép lưu" before saving. */
export function IssueList({issues, seen, onSee, jump, onGo, onFix}: ListProps) {
    if (!issues.length) return null;
    return <Card className='vt-imp-issues' as='section' aria-label='Cần kiểm tra'>
        <h2 className='vt-imp-h2'>Cần kiểm tra {issues.length} chỗ</h2>
        <ul>
            {issues.map(i => {
                const where = jump(i), fix = fixAnchor(i.code), ok = seen[issueKey(i)];
                return <li key={issueKey(i)}>
                    <LevelBadge issue={i}/>
                    <span className='vt-imp-issue-text'>{i.message}</span>
                    <span className='vt-imp-issue-acts'>
                        {where && <Button variant='ghost' size='sm' onClick={() => onGo(i)}>Đến {where}</Button>}
                        {fix && <button type='button' className='vt-imp-link' onClick={() => onFix(fix)}>Cách sửa</button>}
                        {isSevere(i) && (ok
                            ? <Badge tone='ok'>Đã xem</Badge>
                            : <Button variant='secondary' size='sm' onClick={() => onSee(i)}>Đã xem, cho phép lưu</Button>)}
                    </span>
                </li>;
            })}
        </ul>
    </Card>;
}
