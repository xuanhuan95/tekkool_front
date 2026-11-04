import {Link} from 'react-router-dom';

import {Badge, Button, Card, buttonClass} from '../../components/ui';
import {examTotal} from '../exam-creation/examRules';
import {countQuestions, type ImportedExam} from '../exam-creation/importRules';
import {Signature, StructureTable, signature, vn, type SigRow} from './PaperStructure';
import './paper-bank.css';

export type PaperSaveReply = {
    saved: number; total: number;
    papers: {id: string; name: string; question_count: number; total_score: number}[];
    rejected: {id: string; name: string; reason: 'structure' | 'invalid_questions'; message: string}[];
};
export type PaperResult = Pick<PaperSaveReply, 'papers' | 'rejected' | 'total'>;

/** Step 3 of importing into a whole-exam bank: which exams were saved, which were refused and where they differ. */
export default function PaperImportResult({bankId, result, exams, standard, onPickFile}: {
    bankId: string; result: PaperResult; exams: ImportedExam[]; standard?: SigRow[]; onPickFile: () => void;
}) {
    const {papers, rejected, total} = result;
    const none = papers.length === 0;
    const first = rejected[0];
    const byId = (id: string) => exams.find(e => e.id === id);
    const bad = rejected.filter(r => byId(r.id));

    return <>
        {rejected.length === 0
            ? <div className='nb-ok'><b>Đã thêm {papers.length} đề vào ngân hàng.</b> Ngân hàng hiện có {total} đề, học sinh được rút ngẫu nhiên trong {total} đề này.</div>
            : <div className='nb-alert' role='alert'>
                <b>{none ? 'Chưa lưu đề nào.' : `Đã lưu ${papers.length} đề · ${rejected.length} đề chưa được lưu.`}</b>
                <span>{none && rejected.length === exams.length && exams.length > 1 ? `Cả ${exams.length} đề trong file đều chưa được lưu. Ngân hàng không thay đổi.` : none ? 'Ngân hàng không thay đổi.' : ''}
                    {' '}{first.name} chưa được lưu: <b>{first.message}</b>{rejected.length > 1 && ` (và ${rejected.length - 1} đề khác)`}.</span>
            </div>}

        {standard && rejected.length > 0 && <Card>
            <h3 className='vt-card-title'>Cấu trúc chuẩn của ngân hàng</h3>
            <Signature rows={standard}/>
        </Card>}

        <Card>
            <h3 className='vt-card-title'>{none ? 'Kết quả từng đề' : rejected.length ? 'Kết quả từng đề' : 'Đề vừa lưu'}</h3>
            <div className='nb-rows'>
                {papers.map(p => <div key={p.id} className='nb-row'>
                    <div className='nm'>{p.name}</div>
                    <span className='mt'>{p.question_count} câu · {vn(p.total_score)} điểm</span>
                    <Badge tone='ok'>{rejected.length ? 'Đã lưu' : 'Cùng cấu trúc'}</Badge>
                </div>)}
                {rejected.map(r => {
                    const e = byId(r.id);
                    return <div key={r.id} className='nb-row bad'>
                        <div className='nm'>{r.name}</div>
                        {e && <span className='mt'>{countQuestions(e)} câu · {vn(examTotal(e.sections as never))} điểm</span>}
                        <Badge tone='err'>{r.reason === 'structure' ? 'Chưa lưu · khác cấu trúc' : 'Chưa lưu · câu hỏi lỗi'}</Badge>
                    </div>;
                })}
            </div>
            {standard && bad.filter(r => r.reason === 'structure').map(r => <div key={r.id} className='vt-qb-page'>
                <h3 className='vt-card-title'>{r.name} so với cấu trúc chuẩn</h3>
                <StructureTable std={standard} mine={signature(byId(r.id)!.sections)}/>
            </div>)}
            {rejected.length > 0 && <p className='nb-note'>Sửa file Word rồi nhập lại <b>chỉ đề đó</b>. Các đề đã lưu không bị ảnh hưởng.</p>}
            <div className='vt-qb-actions'>
                {none
                    ? <Button variant='primary' onClick={onPickFile}>Chọn file khác</Button>
                    : <>
                        <Link to={'/question-bank/' + bankId} className={buttonClass({variant: 'primary'})}>Xem ngân hàng</Link>
                        {rejected.length > 0 && <Button variant='secondary' onClick={onPickFile}>Chọn file khác</Button>}
                    </>}
            </div>
        </Card>
    </>;
}
