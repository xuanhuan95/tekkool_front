import {isClusterQuestion, kindOf, toUnits, type ImportSection} from '../exam-creation/importRules';
import {unitScore} from '../exam-creation/examRules';
import {useBankPaper, useBankPapers} from '../../queries/questionBank';
import './paper-bank.css';

/** One Phần of an exam: what the BE compares when a whole exam joins a bank (parts, count, kind, score each). */
export type SigRow = {part: string; kind: string; count: number; each: number};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const round = (n: number) => Math.round(n * 100) / 100;
export const vn = (n: number) => String(n).replace('.', ',');
const unitWord = (kind: string) => kind === 'Câu chùm' ? 'ý' : 'câu';

export function signature(sections: ImportSection[]): SigRow[] {
    return sections.map((s, i) => {
        const units = toUnits(s.questions);
        const kind = s.questions[0] ? kindOf(s.questions[0]) : '';
        const total = units.reduce((n, u) => n + (unitScore(u.questions as never) || 0), 0);
        const count = isClusterQuestion(s.questions[0] || ({} as never)) ? s.questions.length : units.length;
        return {part: ROMAN[i] || String(i + 1), kind, count, each: count ? round(total / count) : 0};
    });
}

const short = (kind: string) => kind === 'Trắc nghiệm' ? 'TN' : kind;
const unit = (r: SigRow) => `${r.count} ${unitWord(r.kind)} × ${vn(r.each)}`;

/** Why `mine` differs from the bank's `std` in this Phần ('' = same). */
function diff(std?: SigRow, mine?: SigRow): string {
    if (!std) return 'thừa phần';
    if (!mine) return 'thiếu phần';
    if (std.kind !== mine.kind) return 'khác dạng câu';
    if (std.count !== mine.count) return `${mine.count < std.count ? 'thiếu' : 'thừa'} ${Math.abs(std.count - mine.count)} ${unitWord(std.kind)}`;
    return std.each !== mine.each ? 'điểm mỗi câu lệch' : '';
}

/** The bank's standard structure, read from its first exam (all exams in a paper bank share it). */
export function useBankStandard(bank: string): SigRow[] | undefined {
    const first = useBankPapers(bank, 1).data?.items[0]?.id ?? null;
    const paper = useBankPaper(first).data;
    return paper ? signature(paper.sections as ImportSection[]) : undefined;
}

export const Signature = ({rows}: {rows: SigRow[]}) =>
    <div className='nb-sig'>{rows.map(r => <span key={r.part}>{r.part} · {short(r.kind)} {unit(r)}</span>)}</div>;

export function StructureTable({std, mine}: {std: SigRow[]; mine: SigRow[]}) {
    const n = Math.max(std.length, mine.length);
    return <div className='nb-scroll'><table className='nb-tbl'>
        <thead><tr><th>Phần</th><th>Ngân hàng</th><th>Đề này</th><th>Lệch</th></tr></thead>
        <tbody>{Array.from({length: n}, (_, i) => {
            const d = diff(std[i], mine[i]);
            const r = std[i] || mine[i];
            return <tr key={i}>
                <td>{r.part} · {r.kind}</td>
                <td>{std[i] ? unit(std[i]) : '—'}</td>
                <td className={d ? 'bad' : undefined}>{mine[i] ? unit(mine[i]) : '—'}</td>
                <td className={d ? 'bad' : undefined}>{d || '—'}</td>
            </tr>;
        })}</tbody>
    </table></div>;
}
