import {Fragment, useEffect} from 'react';
import renderHTML from '../../components/SafeHtml';
import Passage from '../../components/Passage';
import {useExamDraftStore} from '../../stores/examDraftStore';
import {ExamHeader} from "./ExamHeader";
import {numToChar} from '../../services/tools';
import striptags from 'striptags';
import {Grid} from 'semantic-ui-react';

const marginLeft = {marginLeft: '20px'};
const boldText = {fontWeight: 'bold'};
const pageNonBreak = {pageBreakInside: 'avoid' as const};

type Props = {
    action?: 'print';
    closeModal?: () => void;
    /**
     * ponytail: bug gốc 2018 — đáp án in thẳng vào bản đề cho học sinh (cả bản
     * in giấy). Component này dùng chung cho Preview exam và Print, cả hai đều
     * là bản học sinh -> mặc định ẩn. PreviewAnswer lo phần đáp án.
     */
    showAnswer?: boolean;
};

export default function PreviewExam({action, closeModal, showAnswer = false}: Props) {
    const exam = useExamDraftStore(s => s.exam);
    useExamDraftStore(s => s.version);   // vẽ lại khi exam bị sửa tại chỗ

    useEffect(() => {
        if (action !== 'print') return;

        const testContent = document.getElementById("PreviewExam")?.outerHTML || '';
        closeModal && closeModal();

        const w = window.open();

        // ponytail: window.open() trả null khi trình duyệt chặn popup ->
        // code gốc 2018 nổ TypeError im lặng. Báo cho user thay vì crash.
        if (!w) {
            alert('Trình duyệt đang chặn popup. Hãy cho phép popup cho trang này để in.');
            return;
        }

        w.document.write('<html><head><title>Tekkool</title>');
        w.document.write('</head><body>');
        w.document.write('<link rel="stylesheet" href="/static/print.css">');
        w.document.write('<link rel="stylesheet" href="/static/fix.css">');
        w.document.write(testContent);
        w.document.write('</body></html>');
        w.document.write('<script>window.print()</script>');

        const t = setTimeout(() => {
            w.focus();
            w.print();
            w.close();
        }, 3000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action]);

    if (!exam) return null;

    let qIdx = 0;

    return <div id="PreviewExam" style={{fontFamily: '"Times New Roman", Times, serif'}}>
        <Grid>
            <Grid.Column width={4} className='text-center'>
                {renderHTML(exam.left_header || '')}
            </Grid.Column>

            <Grid.Column width={12} className='text-center'>
                {renderHTML(exam.right_header || '')}
            </Grid.Column>
        </Grid>

        <ExamHeader/>

        {exam.sections.map((s, idx) => {
            return <div className="section" style={{marginTop: '30px'}} key={s.id}>
                <b>Part {idx + 1}: </b>

                {renderHTML(s.name || '')}

                {s.questions.map((q, qi) => {
                    if (!Object.keys(q.data).length)
                        return null;
                    qIdx++;

                    let columnWidthSingleChoice: any = 4;

                    return <Fragment key={q.id}>
                        <Passage question={q} prev={s.questions[qi - 1]}/>

                        {q.type === 'FillBlank' &&
                        <div className='question FillBlank' style={pageNonBreak}>
                            <span style={boldText}>Question {qIdx}:</span>
                            <br/>
                            <span style={marginLeft}>{renderHTML(q.data.question || '')}</span>

                            {showAnswer && <div className="answer">{renderHTML(q.data.answer || '')}</div>}
                        </div>
                        }

                        {q.type === 'TrueFalse' &&
                        <div className='question TrueFalse' style={pageNonBreak}>
                            <span style={boldText}>Question {qIdx}:</span>
                            <br/>
                            <span style={marginLeft}>{renderHTML(q.data.question)}</span>
                            <br/>
                            <span style={marginLeft}>A. True</span>
                            <span style={marginLeft}>B. False</span>

                            {showAnswer && <div className="answer">{q.data.answer ? 'A. True' : 'B. False'}</div>}
                        </div>
                        }

                        {/* ponytail: bug gốc 2018 — so với 'SingleChoice', một type app
                            không hề tạo ra (Section chỉ sinh 'MultipleChoice'), nên mọi
                            câu trắc nghiệm biến mất khỏi Preview và bản in. */}
                        {(q.type === 'MultipleChoice' || q.type === 'ErrorIdentify') &&
                        <div className={'question ' + q.type} style={pageNonBreak}>
                            <span style={boldText}>Question {qIdx}:</span>
                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}

                            <Grid>
                                {q.data.answers &&
                                <Grid.Row>
                                    {q.data.answers.map((answer: any, i: number) => {
                                        if (answer.value.length > 15)
                                            columnWidthSingleChoice = 16;

                                        return <Grid.Column
                                            className='answer no-margin no-padding'
                                            width={columnWidthSingleChoice} key={i}
                                        >
                                            <b className={showAnswer && answer.id === q.data.correctAnswerId ? 'correct' : ''}>{numToChar(i)}. </b>

                                            {renderHTML(answer.value || '')}
                                        </Grid.Column>
                                    })}
                                </Grid.Row>
                                }
                            </Grid>
                        </div>
                        }

                        {q.type === 'FreeAnswer' &&
                        <div className={'question FreeAnswer'} style={pageNonBreak}>
                            <span style={boldText}>Question {qIdx}:</span>

                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}

                            {q.data.max_words > 0 &&
                            <div><i>(Viết không quá {q.data.max_words} từ)</i></div>}
                            {q.data.max_chars > 0 &&
                            <div><i>(Viết không quá {q.data.max_chars} ký tự)</i></div>}

                            <div>...................................................................................</div>
                        </div>
                        }
                    </Fragment>
                })}
            </div>
        })}
    </div>;
}
