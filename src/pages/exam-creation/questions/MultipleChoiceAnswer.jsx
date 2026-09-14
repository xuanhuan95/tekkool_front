import React from 'react';
import BaseQuestion from './BaseQuestion';
import {Editor} from "../../../components/Editor";
import {Form, Radio} from 'semantic-ui-react';
import striptags from "striptags";


export default class MultipleChoiceAnswer extends BaseQuestion {
    constructor(props) {
        super(props);

        this.state = {
            correct: false
        };

        this.me = React.createRef();
    }

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

    handleEnter = ({keyCode}) => {
        if (keyCode === 13) {
            // Set value manual for avoiding adding new line in value
            let value = this.getAnswerContent();
            this.me.current.medium.setContent(value);

            this.updateAnswer();
        }
    };

    handleSelect = (e, {value}) => {
        this.props.selectCorrectAnswer(value);
    };

    numToChar = (n) => {
        //convert int to string uppercase
        return String.fromCharCode(65 + n);
    };

    render() {
        let {answerId, isCorrect, order, value} = this.props;

        return <Form.Group inline className='answer'>
            <Radio
                onChange={this.handleSelect}
                checked={isCorrect}
                key='radio'
                name='answer'
                value={answerId}
                style={{padding: 'auto'}}
            />

            <span style={{marginRight: '3px'}}>{this.numToChar(order)}.</span>

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
