import React from 'react';

import {Form} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import {Editor} from "../../../components/Editor";


export default class FreeAnswer extends BaseQuestion {
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

        return <Form className='question free-answer'>
            <Editor
                type='FreeAnswer'
                text={data.question}
                placeholder='Type your Open-ended question here...'
                onToAnswerButton={this.onToAnswerButton}
                onChange={question => this.setQuestionData({question})}
            />
        </Form>
    }
}
