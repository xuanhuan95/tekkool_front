import React from 'react';
import striptags from 'striptags';
import BaseQuestion from './BaseQuestion';
import type {BaseQuestionProps} from './BaseQuestion';

import {setNestedValue} from "../../../tools";
import {Form, Icon} from 'semantic-ui-react';
import MultipleChoiceAnswer from './MultipleChoiceAnswer';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";
import {uuid} from "../../../tools";


/**
 * ponytail: ErrorIdentify tung la ban chep y het file nay (177 dong, khac
 * dung 4 cho). Gio no truyen 3 prop duoi day thay vi chep lai ca logic
 * parse "A. ... B. ...", them/xoa/sua phuong an.
 *
 * `toAnswerButton` khong chi bat/tat mot nut: Editor an luon nut do khi
 * khong co `onToAnswerButton`, nen de mac dinh false la giu nguyen
 * MultipleChoice cu (khong co nut).
 */
export type ChoiceProps = BaseQuestionProps & {
    /** Class CSS cua form. `.ErrorIdentify` co CSS counter danh so o tich. */
    cssClass?: string;
    /** Editor doc de biet chen o tich hay gach chan "______". */
    editorType?: string;
    /** Bat nut "chuyen vung chon thanh dap an". */
    toAnswerButton?: boolean;
    placeholder?: string;
    /**
     * Day icon xoa xuong cho thang hang voi o dap an. ErrorIdentify tat vi
     * dong cua no cao hon, day them la lech nguoc len.
     */
    iconOffset?: boolean;
};

export default class MultipleChoice extends BaseQuestion<ChoiceProps> {
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

    // Boi den mot doan -> Editor chen o tich vao cho do, con chu vua boi den
    // thanh mot phuong an. Khong danh so A/B/C o day: CSS counter trong
    // Editor.css lam viec do (ban cu dung Zepto, window.$ khong con ton tai).
    onToAnswerButton = (content: string) => this.addAnswer(content);

    render() {
        let {data} = this.props.question;
        let {correctAnswerId, question} = data;
        let answers = this.getAnswers();
        let {
            cssClass = 'multiple-choice',
            editorType = 'MultipleChoice',
            toAnswerButton = false,
            placeholder = 'Type your Multiple-choice question here...',
            iconOffset = true,
        } = this.props;

        return <Form className={'question ' + cssClass}>
             <Editor
                type={editorType}
                placeholder={placeholder}
                refMedium={this.refQuestion}
                onChange={(question: string) => this.setQuestionData({question})}
                onToAnswerButton={toAnswerButton ? this.onToAnswerButton : undefined}
                onPaste={(event: any) => this.onPasteQuestionData(event)}
                text={question}
             />

             <AnswerLabel/>

            {answers.map((answer: any, idx: number) => {
                let isCorrect = correctAnswerId === answer.id;

                // Detect if current answer is latest answer, use for deciding should we add new answer
                return <div key={idx}>
                    <Icon onClick={() => this.removeAnswer(answer.id)}
                          style={{float: 'left', marginRight: '10px',
                                 marginTop: iconOffset ? '7px' : undefined}}
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


