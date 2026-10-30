import {Link} from 'react-router-dom';

import {Badge, Button, Card, cx} from '../../components/ui';
import {formatDecimal} from '../../lib/format';
import {fixHref} from './guideContent';
import {answerCounts, countQuestions, isSevere, issueKey} from './importRules';
import type {ImportIssue, ImportedExam} from './importRules';

/** The words carry the level; colour only repeats it (design: Nặng / Nhẹ). */
export const LevelBadge = ({issue}: {issue: ImportIssue}) =>
    <Badge tone={isSevere(issue) ? 'err' : 'sun'}>{isSevere(issue) ? 'Nặng' : 'Nhẹ'}</Badge>;

type Tile = {label: string; value: string; note: string; tone: 'ok' | 'sun' | 'err'};

/** The four tiles above the two columns (IV2-XemTruoc): what the file declares vs what was read, answers, score, warnings. */
export function SummaryBar({exam, issues}: {exam: ImportedExam; issues: ImportIssue[]}) {
    const read = exam.stats?.read_questions ?? countQuestions(exam);
    const declared = exam.stats?.declared_questions;
    const {done, total} = answerCounts(exam);
    const score = exam.stats?.total_score;
    const severe = issues.filter(isSevere).length;
    const tiles: Tile[] = [
        {label: 'Số câu', value: declared ? `${read} / ${declared}` : String(read),
            note: !declared ? 'file không ghi số câu' : read === declared ? 'đủ' : read < declared ? `thiếu ${declared - read} câu` : `thừa ${read - declared} câu`,
            tone: !declared || read === declared ? 'ok' : 'sun'},
        {label: 'Đáp án (tính từng ý)', value: `${done} / ${total}`, note: done === total ? 'đủ' : `thiếu ${total - done}`, tone: done === total ? 'ok' : 'sun'},
        ...(typeof score === 'number' ? [{label: 'Tổng điểm', value: `${formatDecimal(score)} / 10`,
            note: score === 10 ? 'đủ' : score < 10 ? `thiếu ${formatDecimal(10 - score)} điểm` : `thừa ${formatDecimal(score - 10)} điểm`,
            tone: score === 10 ? 'ok' as const : 'sun' as const}] : []),
        {label: 'Cảnh báo', value: String(issues.length), note: issues.length ? `${severe} nặng · ${issues.length - severe} nhẹ` : 'không có',
            tone: severe ? 'err' : issues.length ? 'sun' : 'ok'},
    ];
    return <div className='vt-imp-tiles'>
        {tiles.map(t => <div key={t.label} className='vt-imp-tile'>
            <span className='vt-imp-tile-label'>{t.label}</span>
            <span className={cx('vt-imp-tile-value', t.tone)}>{t.value}</span>
            <span className='vt-imp-tile-note'>{t.note}</span>
        </div>)}
    </div>;
}

type ListProps = {
    issues: ImportIssue[];
    seen: Record<string, boolean>;
    onSee: (i: ImportIssue) => void;
    /** "Đến câu n": scroll the question (or its section) into view. `where` is a label like "câu 7". */
    jump: (i: ImportIssue) => string | null;
    onGo: (i: ImportIssue) => void;
    ctx: string;
};

/** "Cần kiểm tra n chỗ": each warning with Đến câu / Cách sửa; a Nặng one also needs "Đã xem, cho phép lưu" before saving. */
export function IssueList({issues, seen, onSee, jump, onGo, ctx}: ListProps) {
    if (!issues.length) return null;
    return <Card className='vt-imp-issues' as='section' aria-label='Cần kiểm tra'>
        <h2 className='vt-imp-h2'>Cần kiểm tra {issues.length} chỗ</h2>
        <ul>
            {issues.map(i => {
                const where = jump(i), fix = fixHref(i.code, ctx), ok = seen[issueKey(i)];
                return <li key={issueKey(i)}>
                    <LevelBadge issue={i}/>
                    <span className='vt-imp-issue-text'>{i.message}</span>
                    <span className='vt-imp-issue-acts'>
                        {where && <Button variant='ghost' size='sm' onClick={() => onGo(i)}>Đến {where}</Button>}
                        {/* Opens a new tab: this screen holds the parsed file, leaving it would lose the work. */}
                        {fix && <Link to={fix} target='_blank' rel='noopener' className='vt-imp-link'>Cách sửa</Link>}
                        {isSevere(i) && (ok
                            ? <Badge tone='ok'>Đã xem</Badge>
                            : <Button variant='secondary' size='sm' onClick={() => onSee(i)}>Đã xem, cho phép lưu</Button>)}
                    </span>
                </li>;
            })}
        </ul>
    </Card>;
}
