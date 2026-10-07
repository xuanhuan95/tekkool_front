import React from 'react';

import {Dropdown, Form, Input} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import type {BaseQuestionProps} from './BaseQuestion';
import {Editor} from "../../../components/Editor";


// Counts WORDS by default: English "I am a student" = 4 words, Literature
// "Trường Trung học phổ thông" = 5 words — Vietnamese writes each syllable
// separately, so the same space-split works. Character counting is kept for
// exams that need it.
const UNITS = [{key: 'w', value: 'word', text: 'từ'}, {key: 'c', value: 'char', text: 'ký tự'}];

type State = {showLimit: boolean};

export default class FreeAnswer extends BaseQuestion<BaseQuestionProps, State> {
    state: State = {showLimit: false};

    // Shim ref for Editor: {current: {medium: {setContent}}} — see Editor.tsx.
    refAnswer = React.createRef<any>();

    // This number does NOT stop students from writing more — it only shows in
    // the counter and is used to sort blocks in the question bank
    // (TraLoiNgan / VietDoan / VietBai). Keep only 1 unit in data — with both,
    // the Editor would have to guess and the exam would be confusing.
    setLimit = (n: number, unit: string) => this.setQuestionData(
        unit === 'word' ? {max_words: n, max_chars: 0} : {max_chars: n, max_words: 0});

    onToAnswerButton = (answer: string) => {
        this.refAnswer.current.medium.setContent(answer);
    };

    render() {
        let {data} = this.props.question;
        // Old exams only have max_chars -> still shown as 'ký tự'; new exams default to 'từ'.
        const unit = data.max_chars > 0 ? 'char' : 'word';
        const limit = unit === 'char' ? data.max_chars : data.max_words;
        // Most essay questions have no limit -> hidden; exams that already set one show it.
        const showLimit = this.state.showLimit || limit > 0;

        return <Form className='question free-answer'>
            <Editor
                type='FreeAnswer'
                text={data.question}
                placeholder='Type your Open-ended question here...'
                onToAnswerButton={this.onToAnswerButton}
                onChange={(question: string) => this.setQuestionData({question})}
            />

            {showLimit ?
                <Input
                    type='number' min={0} className='margin-top limit-input'
                    label={<Dropdown value={unit} options={UNITS}
                                     onChange={(_e, {value}) => this.setLimit(limit, value as string)}/>}
                    labelPosition='right'
                    placeholder='Độ dài mong muốn (0 = không ghi)'
                    value={limit || ''}
                    onChange={(_e, {value}) => this.setLimit(parseInt(value, 10) || 0, unit)}
                />
                :
                <a className='cursor' onClick={() => this.setState({showLimit: true})}>
                    + Độ dài mong muốn của bài làm
                </a>}
        </Form>
    }
}
