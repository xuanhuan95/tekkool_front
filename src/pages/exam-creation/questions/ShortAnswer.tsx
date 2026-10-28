import {Form} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";


/**
 * "Trả lời ngắn" (SPT). The backend grades it against `correctAnswer` (falls back to `answer`),
 * so edits go to `correctAnswer` — writing `answer` would leave a stale `correctAnswer` winning.
 */
export default class ShortAnswer extends BaseQuestion {
    render() {
        const {data} = this.props.question;

        return <Form className='question short-answer'>
            <Editor
                text={data.question}
                placeholder='Nhập câu hỏi trả lời ngắn...'
                onChange={(question: string) => this.setQuestionData({question})}
            />

            <AnswerLabel />

            <Editor
                text={data.correctAnswer ?? data.answer}
                placeholder='Nhập đáp án (nhiều đáp án đúng ngăn bằng |)...'
                onChange={(correctAnswer: string) => this.setQuestionData({correctAnswer})}
            />
        </Form>
    }
}
