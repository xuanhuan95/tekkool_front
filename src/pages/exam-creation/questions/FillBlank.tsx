import React from 'react';

import {Form} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";


export default class FillBlank extends BaseQuestion {
    // Shim ref for Editor: {current: {medium: {setContent}}} — see Editor.tsx.
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
                placeholder='Nhập câu hỏi trả lời ngắn...'
                onToAnswerButton={this.onToAnswerButton}
                onChange={(question: string) => this.setQuestionData({question})}
            />

            <AnswerLabel />

            <Editor
                refMedium={this.refAnswer}
                text={data.answer}
                placeholder='Nhập đáp án...'
                onChange={(answer: string) => this.setQuestionData({answer})}
            />
        </Form>
    }
}
