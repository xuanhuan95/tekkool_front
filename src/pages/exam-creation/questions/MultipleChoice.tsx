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
 * ponytail: ErrorIdentify used to be an exact copy of this file (177 lines,
 * differing in exactly 4 places). Now it passes the props below instead of
 * duplicating the logic for parsing "A. ... B. ...", adding/removing/editing options.
 *
 * `toAnswerButton` is not just an on/off switch for a button: Editor also hides
 * that button when there is no `onToAnswerButton`, so defaulting to false keeps
 * the old MultipleChoice unchanged (no button).
 */
export type ChoiceProps = BaseQuestionProps & {
    /** CSS class of the form. `.ErrorIdentify` has a CSS counter that numbers the check boxes. */
    cssClass?: string;
    /** Editor reads this to know whether to insert a check box or a "______" underline. */
    editorType?: string;
    /** Show the "turn selection into answer" button. */
    toAnswerButton?: boolean;
    placeholder?: string;
    /**
     * Push the remove icon down to line up with the answer box. ErrorIdentify
     * turns it off because its row is taller; pushing further would misalign it upward.
     */
    iconOffset?: boolean;
};

export default class MultipleChoice extends BaseQuestion<ChoiceProps> {
    // Shim ref for Editor: {current: {medium: {...}}} — see Editor.tsx.
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

        // ponytail: the old version called setState({answers}, cb) on a component
        // with NO state — nobody read `answers`, setState was only used as "run
        // after render". setQuestionData above already re-rendered, so calling directly is enough.
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

    // Select a span of text -> Editor inserts a check box there, and the selected
    // text becomes an option. No A/B/C numbering here: the CSS counter in
    // Editor.css does that (the old version used Zepto; window.$ no longer exists).
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


