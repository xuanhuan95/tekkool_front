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

    onChangeAnswer = (e, {label, checked}) => {
        let {data} = this.props.question;
        data.answer = label === 'A.True' && checked;
        this.setQuestionData(data);
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

            <Radio label='A.True' name='answer' checked={data.answer !== undefined && data.answer} onChange={this.onChangeAnswer} />
            <Radio label='B.False' name='answer' checked={data.answer !== undefined && !data.answer} onChange={this.onChangeAnswer} className='margin-left' />
        </Form>
    }
}
