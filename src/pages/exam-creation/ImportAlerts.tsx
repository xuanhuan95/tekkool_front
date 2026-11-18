import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {Button, buttonClass, cx, icons} from '../../components/ui';
import {blocksOf, type BlockDup} from './dupRules';
import type {ImportedExam, MatchSource} from './importRules';

/** Persistent notice on the import screen (artboard `vt-bk-alert`): sun = duplicates, err = save failed, info = explanation. */
export function BankAlert({tone, role = 'status', title, children, acts, spin}: {tone: 'sun' | 'err' | 'info'; role?: 'status' | 'alert'; title: string; children?: ReactNode; acts?: ReactNode; spin?: boolean}) {
    return <div role={role} className={cx('vt-bk-alert', 'vt-bk-alert--' + tone)}>
        {spin ? <span className='vt-bk-spin' aria-hidden='true'/> : tone === 'err' ? <icons.IconAlert size={20}/> : <icons.IconWarn size={20}/>}
        <div className='vt-bk-alert-main'>
            <b>{title}</b>
            {children && <div className='vt-bk-alert-text'>{children}</div>}
            {acts && <div className='vt-bk-alert-acts'>{acts}</div>}
        </div>
    </div>;
}

/** "15/11" from an ISO time (local day); empty when missing or unreadable. */
export const dayMonth = (iso?: string | null) => {
    const t = iso ? new Date(iso) : null;
    return t && !isNaN(t.getTime()) ? `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}` : '';
};

/** "Đề số 3" (link to the bank) + "(nhập 15/11 từ file.docx)": what the BE tells about where the bank block came from. */
function Source({bankId, s}: {bankId: string; s?: MatchSource}) {
    if (!s?.source_name) return null;
    const when = [dayMonth(s.imported_at) && `nhập ${dayMonth(s.imported_at)}`, s.source_file && `từ ${s.source_file}`].filter(Boolean).join(' ');
    return <><Link className='vt-imp-link' to={'/question-bank/' + bankId}>{s.source_name}</Link>{when && ` (${when})`}</>;
}

/** "câu 6–10" of a block inside its exam, counted in paper order. */
function range(exam: ImportedExam, ids: string[]) {
    const all = exam.sections.flatMap(s => s.questions.map(q => q.id));
    const at = ids.map(id => all.indexOf(id) + 1).filter(n => n > 0);
    if (!at.length) return '';
    const [a, b] = [Math.min(...at), Math.max(...at)];
    return a === b ? `câu ${a}` : `câu ${a}–${b}`;
}

export type ExistingExam = {bank: string | null; bank_name: string | null; name?: string | null; source_file?: string | null; imported_at?: string | null; same_bank: boolean; count: number};

type DupProps = {
    bankId: string; exams: ImportedExam[]; bankDups: BlockDup[]; impDups: BlockDup[]; existing: Record<string, ExistingExam>;
    keepDup: Record<string, boolean>; onToggle: (key: string) => void; onRecheck: () => void; busy: boolean;
};

/** Yellow summary + one card per duplicate (artboard import-dup-found). A ticked box = the block is NOT saved (default). */
export function DupPanel({bankId, exams, bankDups, impDups, existing, keepDup, onToggle, onRecheck, busy}: DupProps) {
    const same = Object.entries(existing).filter(([, e]) => e.same_bank);
    const title = 'Có trùng: ' + [same.length && `${same.length} đề`, (bankDups.length + impDups.length) && `${bankDups.length + impDups.length} khối`].filter(Boolean).join(' và ');
    const card = (d: BlockDup, inBank: boolean) => {
        const exam = exams.find(e => e.id === d.exam);
        if (!exam) return null;
        const blocks = blocksOf(exam), at = blocks.findIndex(b => b.id === d.block), block = blocks[at];
        const first = inBank ? null : exams.find(e => e.id === d.inImport);
        const n = block.questions.length;
        return <div key={d.exam + d.block} className='vt-bk-dupitem'>
            <b>{first ? `${first.name} và ${exam.name}` : exam.name} · Khối {at + 1} ({range(exam, block.questions.map(q => q.id))})</b>
            <span>{first ? `Hai đề vừa nhập dùng cùng một ngữ liệu và cùng ${n} câu.` : <>Trùng ngữ liệu và {n} câu với khối {d.with}{d.source?.source_name && <> của <Source bankId={bankId} s={d.source}/></>} trong ngân hàng.</>}</span>
            <label className='vt-bk-check'>
                <input type='checkbox' checked={!keepDup[exam.id + d.block]} onChange={() => onToggle(exam.id + d.block)}/>
                {first ? `Chỉ lưu một khối (của ${first.name})` : `Không lưu khối trùng này (${blocks.length - 1} khối còn lại của đề vẫn lưu)`}
            </label>
        </div>;
    };
    return <BankAlert tone='sun' title={title} acts={<Button variant='ghost' size='sm' disabled={busy} onClick={onRecheck}>Kiểm lại</Button>}>
        <div className='vt-bk-dup'>
            {same.map(([id, e]) => {
                const exam = exams.find(x => x.id === id);
                const src: MatchSource = {source_name: e.name || bankDups.find(d => d.exam === id)?.source?.source_name, source_file: e.source_file, imported_at: e.imported_at};
                const all = exam ? blocksOf(exam).length : 0;
                return <div key={id} className='vt-bk-dupitem'>
                    <b>{exam?.name} đã có trong ngân hàng này</b>
                    <span>{src.source_name
                        ? <>Trùng toàn bộ {all} khối với <Source bankId={bankId} s={src}/>.</>
                        : `Đã có ${e.count} câu của đề này trong ngân hàng.`} Đã bỏ chọn đề này.</span>
                </div>;
            })}
            {bankDups.map(d => card(d, true))}
            {impDups.map(d => card(d, false))}
        </div>
    </BankAlert>;
}

type SaveProps = {
    saved: number; total: number; left: number; lines: Array<{id: string; name: string; file: string; message: string}>;
    bankId: string; busy: boolean; onRetry: () => void;
};

/** After a partial save (artboard import-save-error): what failed, what is safe, what to press. */
export function SaveErrorPanel({saved, total, left, lines, bankId, busy, onRetry}: SaveProps) {
    return <BankAlert tone='err' role='alert' title={`Đã lưu ${saved}/${total} đề. ${left} đề chưa lưu`}
                      acts={<>
                          <Button variant='primary' size='sm' disabled={busy || !left} onClick={onRetry}>{`Lưu lại ${left} đề chưa lưu`}</Button>
                          <Link className={buttonClass({variant: 'secondary', size: 'sm'})} to={'/question-bank/' + bankId}>Xem ngân hàng</Link>
                      </>}>
        <ul>{lines.map(l => <li key={l.id}><b>{l.name}</b>{l.file && ` (${l.file})`}: {l.message}</li>)}</ul>
        {saved > 0 && <span>{saved} đề đã lưu nằm trong ngân hàng, không cần nhập lại.</span>}
    </BankAlert>;
}
