import React from 'react';

import {Form} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";


export default class FillBlank extends BaseQuestion {
    // Shim ref cua Editor: {current: {medium: {setContent}}} — xem Editor.tsx.
    refAnswer = React.createRef<any>();

    onToAnswerButton = (answer: string) => {
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
                onChange={(question: string) => this.setQuestionData({question})}
            />

            <AnswerLabel />

            <Editor
                refMedium={this.refAnswer}
                text={data.answer}
                placeholder='Type your answer here...'
                onChange={(answer: string) => this.setQuestionData({answer})}
            />
        </Form>
    }
}
