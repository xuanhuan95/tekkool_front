import BaseQuestion from './BaseQuestion';

import {Form, Radio} from 'semantic-ui-react';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";


export default class TrueFalse extends BaseQuestion {
    // ponytail: original bug — `label === 'A.True' && checked`. Semantic only fires
    // onChange for the button JUST selected (checked is always true), but that
    // formula reads like "True only when ticked", easy to "fix" into an inversion.
    // The answer is decided by the clicked button itself, no need for `checked`.
    onChangeAnswer = (_e: unknown, {label}: {label?: any}) => {
        this.setQuestionData({answer: label === 'A.True'});
    };

    render() {
        let {data} = this.props.question;

        return <Form className='question true-false'>
            <Editor
                onChange={question => this.setQuestionData({question})}
                placeholder='Type your True/False question here...'
                text={data.question}
            />

            <AnswerLabel/>

            {/* ponytail: original bug — every TrueFalse question in the exam shared
                name='answer', so the teacher choosing question 2's answer cleared
                question 1's. Group by question id. */}
            <Radio label='A.True' name={'answer-' + this.props.question.id}
                   checked={data.answer !== undefined && data.answer}
                   onChange={this.onChangeAnswer}/>
            <Radio label='B.False' name={'answer-' + this.props.question.id}
                   checked={data.answer !== undefined && !data.answer}
                   onChange={this.onChangeAnswer} className='margin-left'/>
        </Form>
    }
}
