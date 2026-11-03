import renderHTML from '../../components/SafeHtml';
import {useExamDraftStore} from '../../stores/examDraftStore';
import {numToChar} from '../../services/tools';
import {Grid} from 'semantic-ui-react';
import {isChum, tickOf, toUnits} from './examRules';

const correctChoiceLabel = (data: Record<string, any>) => {
    const idx = (data.answers || []).findIndex((a: any) => a.id === data.correctAnswerId);
    return idx < 0 ? '' : numToChar(idx);
};

export default function PreviewAnswer() {
    const exam = useExamDraftStore(s => s.exam);
    useExamDraftStore(s => s.version);   // re-render when the exam is mutated in place
    if (!exam) return null;

    let qIdx = 0;

    return <div id="PreviewAnswer">
        <div className='text-center'>{renderHTML(exam.name || '')}</div>

        <Grid>
            {/* One cell per numbered question (toUnits, same grouping as the exam page): Đúng/Sai and câu chùm list their ý. */}
            {exam.sections.map(s =>
                toUnits(s.questions.filter(q => Object.keys(q.data).length)).map(unit => {
                    const q = unit[0];
                    qIdx++;

                    // Several ý (or a long answer) get their own row; single answers stay in the compact grid.
                    const wide = unit.length > 1 || String(q.data.answer ?? '').replace(/<[^>]*>/g, '').length > 6;

                    return <Grid.Column key={q.id} width={wide ? 16 : undefined}>
                        {isChum(unit) &&
                        <span className='question FillBlank'>
                            {qIdx}. {unit.map((y, k) => <span key={y.id}> <b>{y.data.label || String.fromCharCode(97 + k) + ')'}</b> {renderHTML(y.data.answer || '')}</span>)}
                        </span>
                        }

                        {q.type === 'FillBlank' && !isChum(unit) &&
                        <span className='question FillBlank'>
                            {qIdx}. {renderHTML(q.data.answer || '')}
                        </span>
                        }

                        {q.type === 'TrueFalse' &&
                        <span className='question TrueFalse'>
                            {qIdx}. {unit.map((y, k) => {
                                const tick = tickOf(y);
                                return `${String.fromCharCode(97 + k)}) ${tick === undefined ? '—' : tick ? 'Đúng' : 'Sai'}`;
                            }).join(' · ')}
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
