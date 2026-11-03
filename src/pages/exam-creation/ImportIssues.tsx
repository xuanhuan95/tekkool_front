import {Badge, Button, Card, cx} from '../../components/ui';
import {formatDecimal} from '../../lib/format';
import {fixAnchor} from './guideContent';
import {answerCounts, isSevere, issueKey, partRows} from './importRules';
import type {ImportIssue, ImportedExam} from './importRules';

/** The words carry the level; colour only repeats it (design: Nặng / Nhẹ). */
export const LevelBadge = ({issue}: {issue: ImportIssue}) =>
    <Badge tone={isSevere(issue) ? 'err' : 'sun'}>{isSevere(issue) ? 'Nặng' : 'Nhẹ'}</Badge>;

/**
 * Summary table by Phần (IV2-XemTruoc): kind, questions read / declared, answers, score, warnings, then "Cả đề".
 * What the file declares per Phần is `stats.sections` (BE); an older BE sends none and the cells show "—". On a phone the long labels and the warnings column drop (IV2-M-DaDoc).
 */
export function SummaryBar({exam, issues}: {exam: ImportedExam; issues: ImportIssue[]}) {
    const parts = partRows(exam, issues);
    // Read on screen (a deleted question leaves at once); declared: the file's total, else the sum of the Phần when every one says so
    const read = parts.reduce((n, p) => n + p.read, 0);
    const declared = exam.stats?.declared_questions
        ?? (parts.length && parts.every(p => typeof p.declared === 'number') ? parts.reduce((n, p) => n + (p.declared as number), 0) : undefined);
    const {done, total} = answerCounts(exam);
    const score = exam.stats?.total_score;
    const severe = issues.filter(isSevere).length;
    const state = (a: number, b: number, noun = '') => a === b ? <span className='ok'>đủ</span> : <span className='sun'>{a < b ? `thiếu ${formatDecimal(b - a)}` : `thừa ${formatDecimal(a - b)}`} {noun}</span>;
    const warn = (e: number, l: number) => e + l === 0 ? 'không có' : [e && `${e} nặng`, l && `${l} nhẹ`].filter(Boolean).join(' · ');
    return <section className='vt-imp-sum' aria-label='Tóm tắt theo phần'>
        <h2 className='vt-imp-h2'>Tóm tắt theo phần</h2>
        <div className='vt-imp-sum-scroll'>
            <table className='vt-imp-sum-table'>
                <thead><tr><th>Phần</th><th>Dạng<span className='lg'> câu</span></th><th><span className='lg'>Số câu (đọc / file ghi)</span><span className='sm'>Câu</span></th>
                    <th>Đáp án<span className='lg'> (từng ý)</span></th><th>Điểm</th><th className='lg'>Cảnh báo</th></tr></thead>
                <tbody>
                    {parts.map(p => <tr key={p.name + p.kind}>
                        <th scope='row'><span className='lg'>{p.name}</span><span className='sm'>{p.name.replace(/^Phần\s+/, '')}</span></th><td>{p.kind}</td>
                        <td>{p.read} / {p.declared ?? '—'} {typeof p.declared === 'number' && state(p.read, p.declared, 'câu')}</td>
                        <td>{p.done} / {p.total} {state(p.done, p.total)}</td>
                        <td>{p.score === undefined ? '—' : <>{formatDecimal(p.score)} / {p.declaredScore == null ? '—' : formatDecimal(p.declaredScore)}</>}</td>
                        <td className={cx('lg', p.severe && 'err')}>{warn(p.severe, p.light)}</td>
                    </tr>)}
                </tbody>
                <tfoot><tr>
                    <th scope='row' colSpan={2}>Cả đề</th>
                    <td>{read} / {declared ?? '—'} {typeof declared === 'number' && state(read, declared, 'câu')}</td>
                    <td>{done} / {total} {state(done, total)}</td>
                    <td>{typeof score === 'number' ? <>{formatDecimal(score)} / 10 {state(score, 10, 'điểm')}</> : '—'}</td>
                    <td className={cx('lg', severe && 'err')}>{issues.length ? `${issues.length} · ${warn(severe, issues.length - severe)}` : 'không có'}</td>
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
