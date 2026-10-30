import {Fragment, useEffect} from 'react';
import toast from 'react-hot-toast';import renderHTML from '../../components/SafeHtml';
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
     * ponytail: original 2018 bug — answers were printed straight into the student's exam
     * (including the paper printout). This component is shared by Preview exam and Print, both
     * of which are the student copy -> hidden by default. PreviewAnswer handles the answers.
     */
    showAnswer?: boolean;
};

/**
 * The print window loads only print.css/fix.css, so KaTeX (formulas, reaction arrows) would print as bare
 * lines. Copy the KaTeX rules and @font-face (already resolved to /assets/… by the bundler) from this page.
 */
export function katexCss(): string {
    const out: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const r of Array.from(rules)) {
            const text = r.cssText;
            if (/\.katex/.test(text) || (r.constructor.name === 'CSSFontFaceRule' && /KaTeX/.test(text))) out.push(text);
        }
    }
    return out.join('\n');
}

export default function PreviewExam({action, closeModal, showAnswer = false}: Props) {
    const exam = useExamDraftStore(s => s.exam);
    useExamDraftStore(s => s.version);   // re-render when the exam is mutated in place

    useEffect(() => {
        if (action !== 'print') return;

        const testContent = document.getElementById("PreviewExam")?.outerHTML || '';
        closeModal && closeModal();

        const w = window.open();

        // ponytail: window.open() returns null when the browser blocks popups ->
        // the original 2018 code threw a silent TypeError. Tell the user instead of crashing.
        if (!w) {
            toast.error('Trình duyệt đang chặn popup. Hãy cho phép popup cho trang này để in.');
            return;
        }

        w.document.write('<html><head><title>viettestpro</title>');
        w.document.write('</head><body>');
        w.document.write('<link rel="stylesheet" href="/static/print.css">');
        w.document.write('<link rel="stylesheet" href="/static/fix.css">');
        w.document.write('<style>' + katexCss() + '</style>');
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
                {/* an imported name already starts with "Phần I …": no second prefix */}
                {!/^\s*(<[^>]+>\s*)*Phần\s/i.test(s.name || '') && <b>Phần {idx + 1}: </b>}

                {renderHTML(s.name || '')}

                {s.questions.map((q, qi) => {
                    if (!Object.keys(q.data).length)
                        return null;
                    qIdx++;

                    let columnWidthSingleChoice: any = 4;

                    return <Fragment key={q.id}>
                        <Passage question={q} prev={s.questions[qi - 1]} questions={s.questions}/>

                        {q.type === 'FillBlank' &&
                        <div className='question FillBlank' style={pageNonBreak}>
                            <span style={boldText}>Câu {qIdx}:</span>
                            <br/>
                            <span style={marginLeft}>{renderHTML(q.data.question || '')}</span>

                            {showAnswer && <div className="answer">{renderHTML(q.data.answer || '')}</div>}
                        </div>
                        }

                        {q.type === 'TrueFalse' &&
                        <div className='question TrueFalse' style={pageNonBreak}>
                            <span style={boldText}>Câu {qIdx}:</span>
                            <br/>
                            <span style={marginLeft}>{renderHTML(q.data.question)}</span>
                            <br/>
                            <span style={marginLeft}>A. True</span>
                            <span style={marginLeft}>B. False</span>

                            {showAnswer && <div className="answer">{q.data.answer ? 'A. True' : 'B. False'}</div>}
                        </div>
                        }

                        {/* ponytail: original 2018 bug — compared against 'SingleChoice', a type the app
                            never creates (Section only produces 'MultipleChoice'), so every
                            multiple-choice question vanished from Preview and the printout. */}
                        {(q.type === 'MultipleChoice' || q.type === 'ErrorIdentify') &&
                        <div className={'question ' + q.type} style={pageNonBreak}>
                            <span style={boldText}>Câu {qIdx}:</span>
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
                            <span style={boldText}>Câu {qIdx}:</span>

                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}


                            <div>...................................................................................</div>
                        </div>
                        }
                    </Fragment>
                })}
            </div>
        })}
    </div>;
}
