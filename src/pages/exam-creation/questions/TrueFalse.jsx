import React from 'react';
import BaseQuestion from './BaseQuestion';

import {Form, Radio} from 'semantic-ui-react';
import {AnswerLabel} from "../../../components/AnswerLabel";
import {Editor} from "../../../components/Editor";


export default class TrueFalse extends BaseQuestion {
    setQuestionData = (newData) => {
        let {data} = this.props.question;

        Object.keys(newData).forEach(k => {
            data[k] = newData[k];
        });

        this.setQuestionState({data});
    };

    // ponytail: bug gốc — `label === 'A.True' && checked`. Semantic chỉ phát
    // onChange cho nút VỪA được chọn (checked luôn true), nhưng công thức đó
    // đọc như "True chỉ khi đang tick", dễ bị sửa nhầm thành lật ngược.
    // Đáp án do chính nút được bấm quyết định, không cần `checked`.
    onChangeAnswer = (e, {label}) => {
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

            {/* ponytail: bug gốc — mọi câu TrueFalse trong đề chung name='answer',
                nên giáo viên chọn đáp án câu 2 là câu 1 bị bỏ chọn. Nhóm theo id câu. */}
            <Radio label='A.True' name={'answer-' + this.props.question.id}
                   checked={data.answer !== undefined && data.answer}
                   onChange={this.onChangeAnswer}/>
            <Radio label='B.False' name={'answer-' + this.props.question.id}
                   checked={data.answer !== undefined && !data.answer}
                   onChange={this.onChangeAnswer} className='margin-left'/>
        </Form>
    }
}
