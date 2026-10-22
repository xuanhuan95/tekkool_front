import React from 'react';
import {Editor} from "../../../components/Editor";
import {Form, Radio} from 'semantic-ui-react';
import striptags from "striptags";
import {numToChar} from "../../../services/tools";


// ponytail: does NOT extend BaseQuestion. It used to, but never used
// setQuestionData/setQuestionState — every change goes up to the parent via
// callbacks. The needless inheritance made it require 3 extra props the parent never passed.
type Props = {
    answerId: string;
    value: string;
    order: number;
    isCorrect: boolean;
    /**
     * Radio group name, passed down by the parent question together with its id.
     * ponytail: original bug — all answers shared name='answer', so choosing the
     * correct answer in question 2 cleared question 1's choice. Same bug fixed in DoExam and TrueFalse.
     */
    groupName: string;
    selectCorrectAnswer: (answerId: string) => void;
    updateAnswer: (answerId: string, value: string) => void;
    removeAnswer: (answerId: string) => void;
    focusNewInput: () => void;
};

export default class MultipleChoiceAnswer extends React.Component<Props> {
    // Shim ref for Editor: {current: {medium: {getContent, setContent}}}.
    me = React.createRef<any>();

    getAnswerContent = () => {
        let content = this.me.current.medium.getContent();
        return striptags(content, ['b', 'i', 'u']).replace('&nbsp;', '');
    };

    updateAnswer = () => {
        let value = this.getAnswerContent();
        let {answerId, updateAnswer, removeAnswer} = this.props;

        if (value) updateAnswer(answerId, value);
        else removeAnswer(answerId);

        this.props.focusNewInput();
    };

    handleEnter = ({keyCode}: {keyCode: number}) => {
        if (keyCode === 13) {
            // Set value manual for avoiding adding new line in value
            let value = this.getAnswerContent();
            this.me.current.medium.setContent(value);

            this.updateAnswer();
        }
    };

    handleSelect = (_e: unknown, {value}: {value?: any}) => {
        this.props.selectCorrectAnswer(value);
    };

    render() {
        let {answerId, isCorrect, order, value, groupName} = this.props;

        return <Form.Group inline className='answer'>
            <Radio
                onChange={this.handleSelect}
                checked={isCorrect}
                key='radio'
                name={groupName}
                value={answerId}
                style={{padding: 'auto'}}
            />

            <span style={{marginRight: '3px'}}>{numToChar(order)}.</span>

            <Editor
                refMedium={this.me}
                text={value}
                onKeyUp={this.handleEnter}
                onChange={this.updateAnswer}
                placeholder={'Type answer here...'}
            />
        </Form.Group>
    }
}
