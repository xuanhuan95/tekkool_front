import React from 'react';
import renderHTML from '../../components/SafeHtml';
import {connectGlobalState} from "../../stateUtils";
import {Grid} from 'semantic-ui-react';


class PreviewAnswer extends React.Component {

    numToChar = (n) => {
        //convert int to string uppercase
        return String.fromCharCode(65 + n);
    };

    getCorrectAnswerIdMultipleChoice = (data) => {
        let res = '';
        data.answers.forEach((item, idx) => {
            if (item.id === data.correctAnswerId) {
                res = this.numToChar(idx);
            }
        });

        return res;
    };

    render() {
        let {exam} = this.globalState;
        let qIdx = 0;

        return <div id="PreviewAnswer">
            <div className='text-center'>{renderHTML(exam.name || '')}</div>

            <Grid>
                {exam.sections.map((s, idx) =>
                    s.questions.map((q, idx) => {
                        if(!Object.keys(q.data).length)
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
                                {qIdx}. {this.getCorrectAnswerIdMultipleChoice(q.data)}
                            </span>
                            }
                        </Grid.Column>
                    })
                )}
            </Grid>
        </div>
    }
}


export default connectGlobalState(PreviewAnswer);
