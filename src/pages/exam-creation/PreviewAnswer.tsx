import renderHTML from '../../components/SafeHtml';
import {useExamDraftStore} from '../../stores/examDraftStore';
import {numToChar} from '../../services/tools';
import {Grid} from 'semantic-ui-react';

const correctChoiceLabel = (data: Record<string, any>) => {
    const idx = (data.answers || []).findIndex((a: any) => a.id === data.correctAnswerId);
    return idx < 0 ? '' : numToChar(idx);
};

export default function PreviewAnswer() {
    const exam = useExamDraftStore(s => s.exam);
    useExamDraftStore(s => s.version);   // vẽ lại khi exam bị sửa tại chỗ
    if (!exam) return null;

    let qIdx = 0;

    return <div id="PreviewAnswer">
        <div className='text-center'>{renderHTML(exam.name || '')}</div>

        <Grid>
            {exam.sections.map(s =>
                s.questions.map(q => {
                    if (!Object.keys(q.data).length)
                        return null;
                    qIdx++;

                    return <Grid.Column key={q.id}>
                        {q.type === 'FillBlank' &&
                        <span className='question FillBlank'>
                            {qIdx}. {renderHTML(q.data.answer || '')}
                        </span>
                        }

                        {q.type === 'TrueFalse' &&
                        <span className='question TrueFalse'>
                            {qIdx}. {q.data.answer ? 'A. True' : 'B. False'}
                        </span>
                        }

                        {(q.type === 'MultipleChoice' || q.type === 'ErrorIdentify') &&
                        <span className={'question ' + q.type}>
                            {qIdx}. {correctChoiceLabel(q.data)}
                        </span>
                        }
                    </Grid.Column>
                })
            )}
        </Grid>
    </div>;
}
