import {useRef, type ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {Badge, Button, Modal, buttonClass, cx, icons} from '../../components/ui';
import {blocksOf, type BlockDup} from './dupRules';
import type {ImportedExam, MatchSource} from './importRules';

/** Persistent notice on the import screen (artboard `vt-bk-alert`): sun = warning, err = save failed, info = explanation. */
export function BankAlert({tone, role = 'status', title, children, acts}: {tone: 'sun' | 'err' | 'info'; role?: 'status' | 'alert'; title: string; children?: ReactNode; acts?: ReactNode}) {
    return <div role={role} className={cx('vt-bk-alert', 'vt-bk-alert--' + tone)}>
        {tone === 'err' ? <icons.IconXCircle size={20}/> : <icons.IconWarn size={20}/>}
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
    return <><Link className='vt-imp-link' to={'/question-bank/' + bankId} target='_blank' rel='noopener'>{s.source_name}</Link>{when && ` (${when})`}</>;
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

export type Suspect = {key: string; exam: ImportedExam; badge: string; title: ReactNode; text: ReactNode};

/** What the "Có N chỗ nghi trùng" dialog lists: exams the bank already holds, blocks equal to bank blocks, blocks shared by two new exams. */
export function suspects(bankId: string, exams: ImportedExam[], bankDups: BlockDup[], impDups: BlockDup[], existing: Record<string, ExistingExam>): Suspect[] {
    const out: Suspect[] = [];
    for (const [id, e] of Object.entries(existing)) {
        const exam = exams.find(x => x.id === id);
        if (!exam || !e.same_bank) continue;
        const src: MatchSource = {source_name: e.name || bankDups.find(d => d.exam === id)?.source?.source_name, source_file: e.source_file, imported_at: e.imported_at};
        out.push({key: 'e' + id, exam, badge: 'đã có trong ngân hàng', title: exam.name,
            text: src.source_name ? <>Trùng toàn bộ {blocksOf(exam).length} khối với <Source bankId={bankId} s={src}/>.</> : `Đã có ${e.count} câu của đề này trong ngân hàng.`});
    }
    const block = (d: BlockDup, inBank: boolean) => {
        const exam = exams.find(e => e.id === d.exam);
        if (!exam) return;
        const blocks = blocksOf(exam), at = blocks.findIndex(b => b.id === d.block), n = blocks[at].questions.length;
        const first = inBank ? undefined : exams.find(e => e.id === d.inImport);
        out.push({key: 'b' + d.exam + d.block, exam, badge: first ? 'trùng nhau' : 'trùng 1 khối',
            title: `${first ? `${first.name} và ${exam.name}` : exam.name} · Khối ${at + 1} (${range(exam, blocks[at].questions.map(q => q.id))})`,
            text: first ? `Hai đề vừa nhập dùng cùng một ngữ liệu và cùng ${n} câu.`
                : <>Khối {at + 1} ({range(exam, blocks[at].questions.map(q => q.id))}) cùng ngữ liệu và {n} câu với khối {d.with}{d.source?.source_name && <> của <Source bankId={bankId} s={d.source}/></>} trong ngân hàng.</>});
    };
    bankDups.forEach(d => block(d, true));
    impDups.forEach(d => block(d, false));
    return out;
}

/** Dialog after the check found something (artboard dup-dialog): "Vẫn nhập" saves everything, "Xem lại" closes it and marks the spots. */
export function DupDialog({open, items, total, onKeep, onReview}: {open: boolean; items: Suspect[]; total: number; onKeep: () => void; onReview: () => void}) {
    const keep = useRef<HTMLButtonElement>(null);
    return <Modal open={open} onClose={onReview} title={`Có ${items.length} chỗ nghi trùng`} initialFocus={keep} className='v4-dupdlg'
                  footer={<><Button variant='secondary' onClick={onReview}>Xem lại</Button><Button variant='primary' ref={keep} onClick={onKeep}>Vẫn nhập</Button></>}>
        <ul className='v4-duplist'>
            {items.map(i => <li key={i.key}><b>{i.title}</b> <Badge tone='sun'>{i.badge}</Badge><span>{i.text}</span></li>)}
        </ul>
        <p className='v4-muted'>Vẫn nhập: lưu cả {total} đề như hiện tại, kể cả phần trùng. Xem lại: đóng hộp này, chỗ trùng được đánh dấu trên danh sách đề để bạn bỏ chọn hoặc sửa.</p>
    </Modal>;
}

/** Inside the open exam, on top of a suspected block (artboard dup-review). A ticked box = this block is left out of the import. */
export function DupNote({text, others, dropped, onToggle}: {text: ReactNode; others: number; dropped: boolean; onToggle: () => void}) {
    return <div className='v4-dup-head' role='status'>
        <icons.IconWarn size={16}/>
        <div>
            <b>Khối này nghi trùng</b>
            <span>{text}</span>
            <label className='vt-bk-check'>
                <input type='checkbox' checked={dropped} onChange={onToggle}/>
                Không nhập khối này ({others} khối còn lại của đề vẫn nhập)
            </label>
        </div>
    </div>;
}

type SaveProps = {saved: number; total: number; left: number; lines: Array<{id: string; name: string; file: string; message: string}>; bankId: string};

/** After a partial save (artboard save-error): what failed and what is safe. The retry is the bar's own button. */
export function SaveErrorPanel({saved, total, left, lines, bankId}: SaveProps) {
    return <BankAlert tone='err' role='alert' title={`Đã lưu ${saved}/${total} đề. ${left} đề chưa lưu`}
                      acts={<Link className={buttonClass({variant: 'secondary', size: 'sm'})} to={'/question-bank/' + bankId}>Xem ngân hàng</Link>}>
        <ul>{lines.map(l => <li key={l.id}><b>{l.name}</b>{l.file && ` (${l.file})`}: {l.message}</li>)}</ul>
        {saved > 0 && <span>{saved} đề đã lưu nằm trong ngân hàng, không cần nhập lại.</span>}
    </BankAlert>;
}
