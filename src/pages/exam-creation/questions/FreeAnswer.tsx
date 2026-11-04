import React from 'react';

import {Form} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import {Editor} from "../../../components/Editor";


// ponytail: no length box any more (anh Thịnh, 03/11/2026). `data.max_words` / `max_chars` of an
// exam that already has them are left alone: the BE sorts Ngữ văn blocks (short_answer / paragraph / essay) by them.
export default class FreeAnswer extends BaseQuestion {
    // Shim ref for Editor: {current: {medium: {setContent}}} — see Editor.tsx.
    refAnswer = React.createRef<any>();

    onToAnswerButton = (answer: string) => {
        this.refAnswer.current.medium.setContent(answer);
    };

    render() {
        let {data} = this.props.question;

        return <Form className='question free-answer'>
            <Editor
                type='FreeAnswer'
                text={data.question}
                placeholder='Nhập câu hỏi tự luận...'
                onToAnswerButton={this.onToAnswerButton}
                onChange={(question: string) => this.setQuestionData({question})}
            />
        </Form>
    }
}
