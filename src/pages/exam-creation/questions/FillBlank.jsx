import React from 'react';

import {Form} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";


export default class FillBlank extends BaseQuestion {
    constructor(props) {
        super(props);

        this.refAnswer = React.createRef();
    }

    setQuestionData = (newData) => {
        let {data} = this.props.question;

        Object.keys(newData).forEach(k => {
            data[k] = newData[k];
        });

        this.setQuestionState({data});
    };

    onToAnswerButton = (answer) => {
        this.refAnswer.current.medium.setContent(answer);
    };

    render() {
        let {data} = this.props.question;

        return <Form className='question fill-blank'>
            <Editor
                type='FillBlank'
                text={data.question}
                placeholder='Type your Fill-in-blank question here...'
                onToAnswerButton={this.onToAnswerButton}
                onChange={question => this.setQuestionData({question})}
            />

            <AnswerLabel />

            <Editor
                refMedium={this.refAnswer}
                text={data.answer}
                placeholder='Type your answer here...'
                onChange={answer => this.setQuestionData({answer})}
            />
        </Form>
    }
}
