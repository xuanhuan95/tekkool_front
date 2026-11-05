import {useState} from 'react';
import {Link} from 'react-router-dom';

import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageTitle, SkeletonCard, buttonClass, notify} from '../../components/ui';
import {errorText, stripInfoPrefix} from '../../lib/format';
import {PAPERS_PER_PAGE, useBankPaper, useBankPapers, useDeletePaper} from '../../queries/questionBank';
import type {BankPaperRow, BankSummary} from '../../types/exam';
import {toUnits, type ImportSection} from '../exam-creation/importRules';
import '../exam-creation/import-exam.css';   // passage styles shared with the import screen
import {QuestionView} from './BankBlocks';
import {Signature, useBankStandard, vn} from './PaperStructure';
import './question-bank.css';
import './paper-bank.css';

/** One opened exam: "Cho biết" block, then every question in file order, correct options tinted. */
function PaperBody({id}: {id: string}) {
    const {data, isError, error, refetch} = useBankPaper(id);
    if (isError) return <ErrorState title='Không tải được đề.' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')} onRetry={() => refetch()}/>;
    if (!data) return <SkeletonCard/>;
    let no = 0;
    return <>
        {data.shared_info.length > 0 && <div className='vt-imp-passage'>
            <div className='vt-imp-passage-label'>Cho biết</div>
            {data.shared_info.map((h, i) => <div key={i}>{renderHTML(stripInfoPrefix(h))}</div>)}
        </div>}
        {(data.sections as ImportSection[]).map(s => <div key={s.id} className='vt-qbv-list'>
            <b>{s.name}</b>
            {toUnits(s.questions).map((u, k, all) => {
                const first = u.questions[0];
                const group = u.questions.length > 1;
                const pid = first.data.passageId;
                const sameText = k > 0 && pid && all[k - 1].questions[0].data.passageId === pid;   // reading text shown once
                no++;
                return <div key={u.id} className='vt-qbv-list'>
                    {first.data.passage && !sameText && <div className='vt-imp-passage'>{renderHTML(first.data.passage)}</div>}
                    {group && <b>Câu {no}</b>}
                    {u.questions.map((q, i) => <QuestionView key={q.id} q={q as never} plain
                        no={group ? String.fromCharCode(97 + i) + ')' : `Câu ${no}`}/>)}
                </div>;
            })}
        </div>)}
        <p className='nb-note'>Không có nút sửa: muốn sửa thì sửa Word rồi nhập lại.</p>
    </>;
}

function PaperCard({paper, open, onToggle, onDelete}: {paper: BankPaperRow; open: boolean; onToggle: () => void; onDelete: () => void}) {
    return <Card as='article' className='vt-qbv-block'>
        <div className='vt-qbv-head'>
            <b>{paper.name}</b>
            <span className='vt-muted'>{paper.question_count} câu · {vn(paper.total_score)} điểm</span>
            <span style={{marginLeft: 'auto', display: 'flex', gap: 8}}>
                <Button variant='secondary' size='sm' aria-expanded={open} onClick={onToggle}>{open ? 'Thu gọn' : 'Xem'}</Button>
                <Button variant='ghost' size='sm' className='vt-qb-remove' style={{marginLeft: 0}}
                        aria-label={'Xoá ' + paper.name} onClick={onDelete}>Xoá</Button>
            </span>
        </div>
        {open && <PaperBody id={paper.id}/>}
    </Card>;
}

/** GV · content of a whole-exam bank (canvas "Nguyên đề / bank-view"): standard structure + its exams, one opened at a time. */
export default function BankPapers({bank}: {bank: BankSummary}) {
    const [page, setPage] = useState(1);
    const {data, isError, error, refetch, isFetching} = useBankPapers(bank.id, page);
    const standard = useBankStandard(bank.id);
    const [picked, setOpenId] = useState<string | null | undefined>(undefined);   // undefined = untouched: the first exam is open
    const [removing, setRemoving] = useState<BankPaperRow | null>(null);
    const remove = useDeletePaper();
    const openId = picked === undefined ? (page === 1 ? data?.items[0]?.id ?? null : null) : picked;
    const total = data?.total ?? bank.items ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAPERS_PER_PAGE));
    const importLink = <Link to={'/import-exam?bank=' + bank.id} className={buttonClass({variant: 'secondary'})}>Nhập đề</Link>;

    const confirmDelete = () => {
        if (!removing) return;
        const p = removing;
        remove.mutate(p.id, {
            onSuccess: () => { notify.success('Đã xoá đề', p.name); if (openId === p.id) setOpenId(null); setRemoving(null); },
            onError: e => {
                if ((e as {code?: number}).code === 404) notify.success('Đề này đã được xoá trước đó', 'Đã tải lại danh sách.');
                else notify.error('Không xoá được', errorText(e, 'Thử lại sau.'));   // 409 names the exam that would be left without a stock
                setRemoving(null);
            },
        });
    };

    return <div className='vt-qb-page'>
        <Link to='/question-bank' className={buttonClass({variant: 'ghost'})}>← Ngân hàng câu hỏi</Link>
        <div className='vt-qb-head nb-head'>
            <div>
                <PageTitle>{bank.name}</PageTitle>
                <div className='vt-chip-row'>
                    <span className='nb-kind nb-kind--paper'>Nguyên đề</span>
                    <Badge tone='title'>{bank.subject}</Badge>
                    <Badge tone='draft'>{total} đề</Badge>
                </div>
            </div>
            {importLink}
        </div>

        {isError
            ? <ErrorState title='Không tải được danh sách đề.' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !data
                ? <><SkeletonCard/><SkeletonCard/></>
                : data.items.length === 0 && page === 1
                    ? <EmptyState title='Chưa có đề nào'
                                  description='Nhập file Word có một hoặc nhiều đề. Đề đầu tiên sẽ đặt cấu trúc chuẩn cho cả ngân hàng.' action={importLink}/>
                    : <>
                        {standard && <Card>
                            <h3 className='vt-card-title nb-serif'>Cấu trúc chuẩn</h3>
                            <p className='nb-note'>Mọi đề trong ngân hàng cùng số phần, số câu từng phần, dạng câu và điểm từng câu.</p>
                            <Signature rows={standard}/>
                        </Card>}
                        <div className='vt-qbv-list' aria-busy={isFetching}>
                            {data.items.map(p => <PaperCard key={p.id} paper={p} open={openId === p.id}
                                onToggle={() => setOpenId(openId === p.id ? null : p.id)} onDelete={() => setRemoving(p)}/>)}
                        </div>
                    </>}

        {total > PAPERS_PER_PAGE && <nav className='vt-qbv-pager' aria-label='Phân trang'>
            <Button variant='secondary' disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</Button>
            <span>Trang {page}/{pages}</span>
            <Button variant='secondary' disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau →</Button>
        </nav>}

        <ConfirmDialog open={!!removing} tone='danger' loading={remove.isPending}
                       title={removing ? `Xoá “${removing.name}”?` : ''}
                       message={<>
                           <p>Đề rời khỏi ngân hàng, học sinh không được rút đề này nữa. Bài đã nộp vẫn xem lại được.</p>
                           <div className='nb-alert'>
                               <b>Không xoá được nếu đề đã xuất bản không còn đủ đề để rút.</b>
                               <span>Ví dụ ngân hàng chỉ còn 0 đề trong khi có đề đang dùng ngân hàng này.</span>
                           </div>
                       </>}
                       cancelLabel='Huỷ' confirmLabel='Xoá đề'
                       onCancel={() => setRemoving(null)} onConfirm={confirmDelete}/>
    </div>;
}
