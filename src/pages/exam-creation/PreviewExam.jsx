import React, {Fragment} from 'react';
import renderHTML from '../../components/SafeHtml';
import {connectGlobalState} from "../../stateUtils";
import {ExamHeader} from "./ExamHeader";
import striptags from 'striptags';
import {Grid} from 'semantic-ui-react';

const marginLeft = {
    marginLeft: '20px'
};

const boldText = {
    fontWeight: 'bold'
};

const pageNonBreak = {
    pageBreakInside: 'avoid'
};


class PreviewExam extends React.Component {

    numToChar = (n) => {
        //convert int to string uppercase
        return String.fromCharCode(65 + n);
    };

    getCorrectAnswerMultipleChoice = (data) => {
        let res = '';
        data.answers.forEach((item, idx) => {
            if (item.id === data.correctAnswerId) {
                res = this.numToChar(idx) + '. ' + item.value;
            }
        });

        return res;
    };

    componentDidMount() {
        let {action} = this.props;

        if (action === 'print') {
            let testContent = document.getElementById("PreviewExam").outerHTML;
            this.props.closeModal();

            let w = window.open();

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
            // TODO catch onload event
            // w.onload = () => console.log('dasdasd');
            // w.addEventListener('load', function(){console.log("loaded")}, false);

            // w.print();
            // w.close();

            setTimeout(function () {
                w.focus();
                w.print();
                w.close();
            }, 3000);
        }
    }

    render() {
        let {exam} = this.globalState;
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

                    {s.questions.map((q, idx) => {
                        if (!Object.keys(q.data).length)
                            return null;
                        qIdx++;

                        let columnWidthSingleChoice = 4;

                        return <Fragment key={q.id}>
                            {q.type === 'FillBlank' &&
                            <div className='question FillBlank' style={pageNonBreak}>
                                <span style={boldText}>Question {qIdx}:</span>
                                <br/>
                                <span style={marginLeft}>{renderHTML(q.data.question || '')}</span>

                                <div className="answer">{renderHTML(q.data.answer || '')}</div>
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

                                <div className="answer">{q.data.answer ? 'A. True' : 'B. False'}</div>
                            </div>
                            }

                            {(q.type === 'SingleChoice' || q.type === 'ErrorIdentify') &&
                            <div className={'question ' + q.type} style={pageNonBreak}>
                                <span style={boldText}>Question {qIdx}:</span>
                                {striptags(q.data.question) ? renderHTML(q.data.question) : ''}

                                <Grid>
                                    {q.data.answers &&
                                    <Grid.Row>
                                        {q.data.answers.map((answer, i) => {
                                            if(answer.value.length > 15)
                                                columnWidthSingleChoice = 16;

                                            return <Grid.Column
                                                className='answer no-margin no-padding'
                                                width={columnWidthSingleChoice} key={i}
                                            >
                                                <b className={answer.id === q.data.correctAnswerId ? 'correct' : ''}>{this.numToChar(i)}. </b>

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

                                <div>...................................................................................</div>
                            </div>
                            }
                        </Fragment>
                    })}
                </div>
            })}
        </div>
    }
}


export default connectGlobalState(PreviewExam);
