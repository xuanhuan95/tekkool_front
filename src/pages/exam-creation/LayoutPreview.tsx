import {Fragment, useMemo} from 'react';

import {Button, Card, ErrorState, Loading, ExamSection} from '../../components/ui';
import Passage from '../../components/Passage';
import {errorText} from '../../lib/format';
import {buildPaper} from '../exam/paper';
import QuestionView from '../exam/QuestionView';
import type {LayoutDraw} from '../../queries/questionBank';
import type {TestExam} from '../../types/exam';
import type {Question as LegacyQuestion} from './Default';

type Query = {data?: LayoutDraw; isError: boolean; error: unknown; isFetching: boolean; refetch: () => unknown};

const noop = () => undefined;

/**
 * Step 3: ONE trial draw from the bank, drawn by the BE exactly as a student's attempt (titles, numbers, no answers).
 * "Rút lần khác" draws again; every attempt of a student is a different draw of the same frame.
 */
export default function LayoutPreview({name, minutes, draw}: {name: string; minutes: number; draw: Query}) {
    const {data, isError, error, isFetching, refetch} = draw;
    const paper = useMemo(() => data && !data.shortage.length ? buildPaper({id: 'preview', sections: data.sections} as TestExam) : null, [data]);

    if (isError) return <ErrorState title='Chưa rút thử được đề' description={errorText(error, 'Kiểm tra mạng rồi thử lại.')}
                                    onRetry={() => refetch()} retrying={isFetching}/>;
    if (!data) return <Card as='section' aria-label='Xem trước đề'><Loading/></Card>;
    if (data.shortage.length) return <Card as='section' aria-label='Xem trước đề'>
        <p className='vt-cfb-err' role='alert'>Ngân hàng chưa đủ khối để rút thử:</p>
        <ul>{data.shortage.map(s => <li key={s.block_type}>{s.name}: cần {s.need}, ngân hàng có {s.have}.</li>)}</ul>
        <p className='vt-cfb-hint'>Quay lại sửa khung hoặc nhập thêm đề vào ngân hàng.</p>
    </Card>;

    return <Card className='vt-cfb-preview' as='section' aria-label='Xem trước đề' aria-busy={isFetching}>
        <div className='vt-cfb-row'>
            <div><h2 className='vt-cfb-pname'>{name}</h2>
                <p className='vt-cfb-hint'>Thời gian làm bài: {minutes} phút · {data.points_total} điểm · {paper?.questions.length ?? 0} câu</p></div>
            <Button variant='secondary' loading={isFetching} loadingText='Đang rút…' onClick={() => refetch()}>Rút lần khác</Button>
        </div>
        <div className='nb-ok' role='note'>
            <b>Đây là một lần rút thử.</b> Mỗi lượt thi học sinh rút một đề khác: cùng khung, khối khác. Đáp án không hiện ở đây.
        </div>
        {paper?.parts.map(part => <ExamSection key={part.id} id={'pv-' + part.id} title={part.title} group={part.groupTitle} lead={part.lead} sub={part.subTitle}>
            {part.questions.map(q => <Fragment key={q.questionIds[0]}>
                {q.kind !== 'truefalse' && <Passage question={q.raw as unknown as LegacyQuestion}
                                                    prev={q.rawPrev as unknown as LegacyQuestion | undefined}
                                                    questions={part.rawQuestions as unknown as LegacyQuestion[]}/>}
                <QuestionView question={q} answers={{}} flagged={false} disabled onToggleFlag={noop} onWrite={noop} textDelayMs={0}/>
            </Fragment>)}
        </ExamSection>)}
    </Card>;
}
