import React from 'react';
import striptags from 'striptags';
import BaseQuestion from './BaseQuestion';

import {setNestedValue} from "../../../tools";
import {Form, Icon} from 'semantic-ui-react';
import MultipleChoiceAnswer from './MultipleChoiceAnswer';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";
import {uuid} from "../../../tools";


export default class MultipleChoice extends BaseQuestion {
    constructor(props) {
        super(props);
        this.refNewAnswer = React.createRef();
        this.refQuestion = React.createRef();
    }

    getAnswers = () => {
        let {answers} = this.props.question.data;
        return answers || [];
    };

    cleanAnswer = (content) => {
        return striptags(content, ['b', 'i', 'u']).replace('&nbsp;', '');
    };

    getAnswerContent = () => {
        let content = this.refNewAnswer.current.medium.getContent();
        return this.cleanAnswer(content);
    };

    addAnswer = (answer) => {
        if (!answer) return;

        // Check auto parse answers for multi input at same time
        answer = answer.replace(/\s*[A-Z]\s*\.\s*/g, '( ͡° ͜ʖ ͡°)');
        let tmpAnswers = answer.split('( ͡° ͜ʖ ͡°)');
        tmpAnswers.shift();

        let answers = [...this.getAnswers()];

        if (tmpAnswers && tmpAnswers.length > 0) {
            tmpAnswers.forEach(value => {
                value = this.cleanAnswer(value);
                answers.push({id: uuid(), value});
            });

        // Simple input value
        } else {
            let value = this.cleanAnswer(answer);
            answers.push({id: uuid(), value});
        }

        let {data} = this.props.question;
        data.answers = answers;
        this.setQuestionData(data);

        this.setState({answers}, () => {
            this.resetAnswerInput();
        })
    };

    removeAnswer = (answerId) => {
        let {data} = this.props.question;

        data.answers = data.answers.filter(answer => answer.id !== answerId);

        this.setQuestionData(data);
    };

    focusNewInput = () => {
        // Focus on new answer input
        this.refNewAnswer.current.medium.elements[0].focus();
    };

    updateAnswer = (answerId, value) => {
        let {data} = this.props.question;

        setNestedValue(data, `answers[id=${answerId}].value`, value);
        this.setQuestionData(data);

        this.focusNewInput();
    };

    resetAnswerInput = () => {
        this.refNewAnswer.current.medium.setContent('&nbsp;');
    };

    selectCorrectAnswer = (answerId) => {
        this.setQuestionData({correctAnswerId: answerId});
    };

    handleEnter = ({keyCode}) => {
        let value = this.getAnswerContent();

        if (keyCode === 13) {
            if (value) this.addAnswer(value);
            else this.resetAnswerInput();
        }
    };

    setQuestionData = (newData) => {
        let {data} = this.props.question;

        Object.keys(newData).forEach(k => {
            data[k] = newData[k];
        });

        this.setQuestionState({data});
    };

    onPasteQuestionData = (event) => {
        // Check auto parse answers for multi input at same time
        let content = event.target.innerText.replace(/\s*A\s*\.\s*/g, '( ͡° ͜ʖ ͡°)');
        let tmp = content.split('( ͡° ͜ʖ ͡°)');

        if (tmp && tmp.length === 2) {
            let question = tmp[0].replace(/^Question\s*\d{1,2}\.\s*/g, '');

            this.refQuestion.current.medium.setContent(question);
            this.addAnswer('A.' + tmp[1]);
        }
    };

    render() {
        let {data} = this.props.question;
        let {correctAnswerId, question} = data;
        let answers = this.getAnswers();

        return <Form className='question multiple-choice'>
             <Editor
                type='MultipleChoice'
                placeholder='Type your Multiple-choice question here...'
                refMedium={this.refQuestion}
                onChange={question => this.setQuestionData({question})}
                onPaste={event => this.onPasteQuestionData(event)}
                text={question}
             />

             <AnswerLabel/>

            {answers.map((answer, idx) => {
                let isCorrect = correctAnswerId === answer.id;

                // Detect if current answer is latest answer, use for deciding should we add new answer
                return <div key={idx}>
                    <Icon onClick={() => this.removeAnswer(answer.id)}
                          style={{float: 'left', marginRight: '10px', marginTop: '7px'}}
                          name='remove'
                          color='grey'
                          className='cursor'
                    />

                    <MultipleChoiceAnswer
                        value={answer.value}
                        answerId={answer.id}
                        order={idx}
                        selectCorrectAnswer={this.selectCorrectAnswer}
                        isCorrect={isCorrect}
                        updateAnswer={this.updateAnswer}
                        removeAnswer={this.removeAnswer}
                        focusNewInput={this.focusNewInput}
                    />
                </div>
            })}

            <Editor
                refMedium={this.refNewAnswer}
                placeholder='Type answer here...'
                onKeyUp={this.handleEnter}
                onBlur={() => this.addAnswer(this.getAnswerContent())}
            />
        </Form>
    }
}


