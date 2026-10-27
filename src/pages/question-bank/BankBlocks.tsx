import {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';

import renderHTML from '../../components/SafeHtml';
import {Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageTitle, Select, SkeletonCard, TextField, buttonClass, notify}
    from '../../components/ui';
import {errorText} from '../../lib/format';
import {BLOCKS_PER_PAGE, useBankBlocks, useBanks, useDeleteBlock} from '../../queries/questionBank';
import type {BankBlock} from '../../types/exam';
import {BLOCK_LABELS} from '../exam-creation/blockTypes';
import '../exam-creation/import-exam.css';   // passage / explanation styles shared with the import screen
import './question-bank.css';

const isChoiceType = (t: string) => t === 'MultipleChoice' || t === 'ErrorIdentify';

/** SPT-73 · read-only question: prompt, options with the key marked, T/F statements, short answer, explanation. */
function QuestionView({no, q}: {no: string; q: BankBlock['questions'][number]}) {
    const d = q.data;
    return <div className='vt-qbv-q'>
        <div className='vt-qbv-prompt'><b>{no}</b><div>{renderHTML(d.question)}</div>
            {q.type === 'TrueFalse' && <Badge tone={d.answer === true ? 'ok' : d.answer === false ? 'err' : 'draft'}>
                {d.answer === true ? 'Đúng' : d.answer === false ? 'Sai' : 'Chưa có đáp án'}</Badge>}
        </div>
        {isChoiceType(q.type) && <ul className='vt-qbv-answers'>
            {(d.answers || []).map((a: {id: string; value: string}, i: number) => {
                const on = a.id === d.correctAnswerId;
                return <li key={a.id} className={on ? 'on' : undefined}>
                    <span className='vt-qbv-key'>{String.fromCharCode(65 + i)}.</span>
                    <div>{renderHTML(a.value)}</div>
                    {on && <Badge tone='ok'>Đáp án đúng</Badge>}
                </li>;
            })}
        </ul>}
        {q.type === 'FillBlank' && d.answer && <div className='vt-qbv-fill'><b>Đáp án:</b> {renderHTML(d.answer)}</div>}
        {d.explanation && <details className='vt-imp-explain'>
            <summary>Lời giải</summary>
            <div>{renderHTML(d.explanation)}</div>
        </details>}
    </div>;
}

function BlockCard({block, onDelete}: {block: BankBlock; onDelete: () => void}) {
    const tf = block.block_type === 'DungSai';
    return <Card as='article' className='vt-qbv-block'>
        <div className='vt-qbv-head'>
            <Badge tone='title'>{block.block_type_name}</Badge>
            <span className='vt-muted'>{block.count} {tf ? 'ý' : 'câu'}</span>
            <Button variant='ghost' size='sm' className='vt-qb-remove' aria-label={'Xoá khối ' + block.block_type_name}
                    onClick={onDelete}>Xoá</Button>
        </div>
        {block.passage && <div className='vt-imp-passage'>
            <div className='vt-imp-passage-label'>{tf ? 'Đề dẫn chung' : 'Ngữ liệu'}</div>
            {renderHTML(block.passage)}
        </div>}
        {block.questions.map((q, i) => <QuestionView key={q.id} q={q}
            no={tf ? String.fromCharCode(97 + i) + ')' : block.count > 1 ? `Câu ${i + 1}` : 'Câu'}/>)}
    </Card>;
}

/** Message of the confirm box: one question vs a passage with its questions (count comes from the BE). */
export function deleteQuestion(b: BankBlock) {
    if (b.block_type === 'DungSai') return `Xoá câu đúng/sai này (${b.count} ý)?`;
    return b.count > 1 ? `Xoá văn bản này và ${b.count} câu đi kèm?` : 'Xoá câu này?';
}

/**
 * GV-NganHang-NoiDung (SPT-73): what a bank holds — filter by block type, search, 20 per page, delete a whole block.
 * No source-exam info (bank = questions only). Route `/question-bank/:bankId`.
 */
export default function BankBlocks() {
    const {bankId = ''} = useParams();
    const {data: banks} = useBanks();
    const bank = banks?.find(b => b.id === bankId);
    const [type, setType] = useState('');
    const [typed, setTyped] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [removing, setRemoving] = useState<BankBlock | null>(null);
    const remove = useDeleteBlock();
    const {data, isError, error, refetch, isFetching} = useBankBlocks(bankId, page, type, q);

    // Search runs 350ms after the last keystroke; any filter change goes back to page 1.
    useEffect(() => {
        const t = setTimeout(() => { setQ(typed.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [typed]);

    const pages = data ? Math.max(1, Math.ceil(data.total / BLOCKS_PER_PAGE)) : 1;
    // Deleting the last block of the last page: the page no longer exists → step back.
    useEffect(() => { if (data && page > pages) setPage(pages); }, [data, page, pages]);

    const confirmDelete = () => {
        if (!removing) return;
        const b = removing;
        remove.mutate(b.id, {
            onSuccess: () => { notify.success('Đã xoá khối', b.block_type_name); setRemoving(null); },
            onError: e => {
                if ((e as {code?: number}).code === 404) notify.success('Khối này đã được xoá trước đó', 'Đã tải lại danh sách.');
                else notify.error('Không xoá được', errorText(e, 'Thử lại sau.'));
                setRemoving(null);
            },
        });
    };

    return <div className='vt-qb-page'>
        <Link to='/question-bank' className={buttonClass({variant: 'ghost'})}>← Ngân hàng câu hỏi</Link>
        <div className='vt-qb-head'>
            <div>
                <PageTitle>{bank ? bank.name : 'Nội dung ngân hàng'}</PageTitle>
                <p>{data ? `${data.total} khối${type || q ? ' khớp bộ lọc' : ''}` : 'Đang tải…'}</p>
            </div>
        </div>

        <div className='vt-qbv-filters'>
            <Select label='Dạng khối' value={type} onChange={e => { setType(e.target.value); setPage(1); }}
                    options={[{value: '', label: 'Tất cả dạng'}, ...Object.entries(BLOCK_LABELS).map(([value, label]) => ({value, label}))]}/>
            <TextField label='Tìm trong câu hỏi' placeholder='Tìm chữ trong câu, đáp án, ngữ liệu' value={typed}
                       onChange={e => setTyped(e.target.value)}/>
        </div>

        {isError
            ? <ErrorState title='Không tải được nội dung ngân hàng.' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                          onRetry={() => refetch()} retrying={isFetching}/>
            : !data
                ? <><SkeletonCard/><SkeletonCard/></>
                : data.blocks.length === 0
                    ? <EmptyState title={type || q ? 'Không có khối nào khớp' : 'Ngân hàng chưa có khối nào'}
                                  description={type || q ? 'Thử đổi dạng khối hoặc từ khoá.' : 'Bấm Nhập đề ở trang Ngân hàng câu hỏi để thêm.'}/>
                    : <div className='vt-qbv-list' aria-busy={isFetching}>
                        {data.blocks.map(b => <BlockCard key={b.id} block={b} onDelete={() => setRemoving(b)}/>)}
                    </div>}

        {data && data.total > BLOCKS_PER_PAGE && <nav className='vt-qbv-pager' aria-label='Phân trang'>
            <Button variant='secondary' disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</Button>
            <span>Trang {page}/{pages}</span>
            <Button variant='secondary' disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau →</Button>
        </nav>}

        <ConfirmDialog open={!!removing} tone='danger' loading={remove.isPending}
                       title={removing ? deleteQuestion(removing) : ''}
                       message='Đề đã rút từ khối này, bài đang làm và bài đã nộp của học sinh không bị ảnh hưởng.'
                       cancelLabel='Giữ lại' confirmLabel='Xoá'
                       onCancel={() => setRemoving(null)} onConfirm={confirmDelete}/>
    </div>;
}
