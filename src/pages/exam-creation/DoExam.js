import React, {Fragment} from 'react';
import renderHTML from 'react-render-html';
import striptags from 'striptags';

import {connectGlobalState} from "../../stateUtils";
import {Dimmer, Loader, Segment, Radio, Grid, Button, Icon, Rail, Sticky} from 'semantic-ui-react';
import {numToChar} from "../../services/tools";
import {Editor} from "../../components/Editor";
import Api from "../../services/api";


class DoExam extends React.Component {
    state = {
        exam: null,
        answers: [],
        startAt: null,
        endAt: null,
        passedTime: 0,
        remainingTime: 0
    };

    constructor(props) {
        super(props);

        this._counter = null;
    }

    handleContextRef = contextRef => this.setState({contextRef});

    componentDidMount = async () => {
        let {examId} = this.props.match.params;
        let exam = await Api.get('exam/during_test/' + examId);
        this.setState({exam});
    };

    setAnswer = async (questionId, answer) => {
        let {exam} = this.state;

        let {auth} = this.globalState;

        await Api.post('exam/save_answer/' + questionId, {
            answer:answer,
            user_id: auth.user.id
        });

        exam.sections.forEach((section)=> {
            section.questions.map(question => {
                if(question.id === questionId){
                    question.markedAnswer = answer;
                    return question;
                }
                return question;
            })
        });
        this.setState({exam});
    };

    finish = () => {
        let {passedTime} = this.state;

        clearInterval(this._counter);
        alert("Congratulations. You've finished the exam in: " + Math.floor(passedTime / 60) + ' minutes');
    };

    startExam = () => {
        this.setState({startAt: new Date()});

        this._counter = setInterval(() => {
            // Duration 45min
            let passedTime =  this.calculPassedTime();
            let remainingTime = 45 * 60 - passedTime;
            this.setState({passedTime, remainingTime});
        }, 1000);
    };

    calculPassedTime = () => {
        return Math.round((+new Date() - +this.state.startAt) / 1000);
    };

    render() {
        const {contextRef} = this.state;
        let {exam, remainingTime, startAt} = this.state;
        let qIdx = 0;

        if (!exam) {
            return <Dimmer active={true}><Loader/></Dimmer>;
        }

        return <Grid id="Exam" className='margin padding'>
            <Grid.Column width={13}>
                <div ref={this.handleContextRef}>
                    <Segment>
                        {exam.sections.map((s, idx) => {
                            return <div className="section" style={{marginTop: '10px'}} key={s.id}>
                                <h4>Part {idx + 1}: </h4>

                                {renderHTML(s.name || '')}

                                {s.questions.map((q, idx) => {
                                    if (!Object.keys(q.data).length)
                                        return null;
                                    qIdx++;

                                    return <Fragment key={q.id}>
                                        <i><b>Question {qIdx}:</b></i>

                                        {q.type === 'FillBlank' &&
                                        <div className='question FillBlank'>
                                            <span>{renderHTML(q.data.question || '')}</span>
                                            <Editor
                                                placeholder='Type your answer here...'
                                                onChange={answer => this.setAnswer(q.id, answer)}
                                                disableReturn={true}
                                                disableStyle={true}
                                                text={q.markedAnswer}
                                            />
                                        </div>
                                        }

                                        {q.type === 'TrueFalse' &&
                                        <div className='question TrueFalse'>
                                            <span>{renderHTML(q.data.question)}</span>
                                            <Radio label='A.True'
                                                   checked={q.markedAnswer==='true'}
                                                   name='answerTrueFale'
                                                   onChange={() => this.setAnswer(q.id, 'true')}/>
                                            <br/>
                                            <Radio label='B.False'
                                                   checked={q.markedAnswer==='false'}
                                                   name='answerTrueFale'
                                                   onChange={() => this.setAnswer(q.id, 'false')}/>
                                        </div>
                                        }

                                        {(q.type === 'MultipleChoice' || q.type === 'ErrorIdentify') &&
                                        <div className={'question ' + q.type}>
                                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}

                                            <div className='no-margin no-padding'>
                                                {q.data.answers && q.data.answers.map((answer, i) => {
                                                    let checked = answer.value === q.markedAnswer;

                                                    return <div key={i}>
                                                        <Radio type='radio' value={answer.value}
                                                               label={numToChar(i) + '. ' + answer.value}
                                                               name='answer'
                                                               onChange={(e, {value}) => this.setAnswer(q.id, value)}
                                                               checked={checked}
                                                        />
                                                    </div>
                                                })}
                                            </div>
                                        </div>
                                        }

                                        {q.type === 'FreeAnswer' &&
                                        <div className={'question FreeAnswer'}>
                                            {striptags(q.data.question) ? renderHTML(q.data.question) : ''}
                                            <Editor
                                                placeholder='Type your answer here...'
                                                onChange={answer => this.setAnswer(q.id, answer)}
                                                disableReturn={true}
                                                disableStyle={true}
                                                text={q.markedAnswer}
                                            />
                                        </div>
                                        }

                                        <hr/>
                                    </Fragment>
                                })}
                            </div>
                        })}
                    </Segment>

                    <Rail position='right' style={{width: '24%', margin: 0, padding: 0}} className='text-center margin-top'>
                        <Sticky context={contextRef}>
                            {!startAt &&
                            <Button onClick={this.startExam} color='green' fluid>
                                <Icon name='clock'/> Start
                            </Button>
                            }

                            {startAt &&
                            <h1 className='text-center'>
                                {Math.floor(remainingTime / 60)} : {remainingTime % 60}
                            </h1>
                            }

                            {startAt &&
                            <Button onClick={this.finish} color='blue' fluid className='margin-top'>
                                <Icon name='check'/> Finish
                            </Button>
                            }
                        </Sticky>
                    </Rail>
                </div>
            </Grid.Column>
        </Grid>
    }
}

export default connectGlobalState(DoExam);
