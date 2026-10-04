import React from 'react';
import striptags from 'striptags';
import BaseQuestion from './BaseQuestion';

import {setNestedValue} from "../../../tools";
import {Form, Icon} from 'semantic-ui-react';
import MultipleChoiceAnswer from './MultipleChoiceAnswer';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";
import {uuid} from "../../../tools";


export default class ErrorIdentify extends BaseQuestion {
    // Shim ref cua Editor: {current: {medium: {...}}} — xem Editor.tsx.
    refNewAnswer = React.createRef<any>();
    refQuestion = React.createRef<any>();

    getAnswers = () => {
        let {answers} = this.props.question.data;
        return answers || [];
    };

    cleanAnswer = (content: string) => {
        return striptags(content, ['b', 'i', 'u']).replace('&nbsp;', '');
    };

    getAnswerContent = () => {
        let content = this.refNewAnswer.current.medium.getContent();
        return this.cleanAnswer(content);
    };

    addAnswer = (answer: string) => {
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

        // ponytail: ban cu goi setState({answers}, cb) tren component KHONG co
        // state — `answers` chang ai doc, setState chi duoc dung lam "chay sau
        // khi ve xong". setQuestionData o tren da ve lai roi, goi thang la du.
        this.resetAnswerInput();
    };

    removeAnswer = (answerId: string) => {
        let {data} = this.props.question;

        data.answers = data.answers.filter((answer: any) => answer.id !== answerId);

        this.setQuestionData(data);
    };

    focusNewInput = () => {
        // Focus on new answer input
        this.refNewAnswer.current.medium.elements[0].focus();
    };

    updateAnswer = (answerId: string, value: string) => {
        let {data} = this.props.question;

        setNestedValue(data, `answers[id=${answerId}].value`, value);
        this.setQuestionData(data);

        this.focusNewInput();
    };

    resetAnswerInput = () => {
        this.refNewAnswer.current.medium.setContent('&nbsp;');
    };

    selectCorrectAnswer = (answerId: string) => {
        this.setQuestionData({correctAnswerId: answerId});
    };

    handleEnter = ({keyCode}: {keyCode: number}) => {
        let value = this.getAnswerContent();

        if (keyCode === 13) {
            if (value) this.addAnswer(value);
            else this.resetAnswerInput();
        }
    };

    onPasteQuestionData = (event: any) => {
        // Check auto parse answers for multi input at same time
        let content = event.target.innerText.replace(/\s*A\s*\.\s*/g, '( ͡° ͜ʖ ͡°)');
        let tmp = content.split('( ͡° ͜ʖ ͡°)');

        if (tmp && tmp.length === 2) {
            let question = tmp[0].replace(/^Question\s*\d{1,2}\.\s*/g, '');

            this.refQuestion.current.medium.setContent(question);
            this.addAnswer('A.' + tmp[1]);
        }
    };

    // ponytail: bỏ đoạn Zepto đánh số A/B/C vào từng .check-item — CSS counter
    // trong Editor.css làm việc đó rồi, và window.$ không còn tồn tại nên đoạn
    // cũ ném "$ is not a function" ngay khi bấm nút chuyển-thành-đáp-án.
    onToAnswerButton = (content: string) => {
        this.addAnswer(content);
    };

    render() {
        let {data} = this.props.question;
        let {correctAnswerId, question} = data;
        let answers = this.getAnswers();

        return <Form className='question ErrorIdentify'>
             <Editor
                type='ErrorIdentify'
                refMedium={this.refQuestion}
                onChange={(question: string) => this.setQuestionData({question})}
                onToAnswerButton={this.onToAnswerButton}
                onPaste={(event: any) => this.onPasteQuestionData(event)}
                placeholder='Type your Error-identification question here...'
                text={question}
             />

             <AnswerLabel/>

            {answers.map((answer: any, idx: number) => {
                let isCorrect = correctAnswerId === answer.id;

                // Detect if current answer is latest answer, use for deciding should we add new answer
                return <div key={idx}>
                    <Icon onClick={() => this.removeAnswer(answer.id)}
                          style={{float: 'left', marginRight: '10px'}}
                          name='remove'
                          color='grey'
                          className='cursor'
                    />

                    <MultipleChoiceAnswer
                        value={answer.value}
                        answerId={answer.id}
                        groupName={'answer-' + this.props.question.id}
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


