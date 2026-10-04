import React from 'react';

import {Dropdown, Form, Input} from 'semantic-ui-react';
import BaseQuestion from './BaseQuestion';
import type {BaseQuestionProps} from './BaseQuestion';
import {Editor} from "../../../components/Editor";


// Mặc định đếm TỪ: Tiếng Anh "I am a student" = 4 từ, Ngữ văn "Trường Trung
// học phổ thông" = 5 chữ — tiếng Việt viết rời từng tiếng nên cùng một phép tách
// dấu cách. Đếm ký tự vẫn giữ cho đề nào cần.
const UNITS = [{key: 'w', value: 'word', text: 'từ'}, {key: 'c', value: 'char', text: 'ký tự'}];

type State = {showLimit: boolean};

export default class FreeAnswer extends BaseQuestion<BaseQuestionProps, State> {
    state: State = {showLimit: false};

    // Shim ref cua Editor: {current: {medium: {setContent}}} — xem Editor.tsx.
    refAnswer = React.createRef<any>();

    // Chỉ giữ 1 đơn vị trong data — để cả hai thì Editor phải đoán, đề cũng khó hiểu.
    setLimit = (n: number, unit: string) => this.setQuestionData(
        unit === 'word' ? {max_words: n, max_chars: 0} : {max_chars: n, max_words: 0});

    onToAnswerButton = (answer: string) => {
        this.refAnswer.current.medium.setContent(answer);
    };

    render() {
        let {data} = this.props.question;
        // Đề cũ chỉ có max_chars -> vẫn hiện đúng 'ký tự'; đề mới mặc định 'từ'.
        const unit = data.max_chars > 0 ? 'char' : 'word';
        const limit = unit === 'char' ? data.max_chars : data.max_words;
        // Đa số câu tự luận không giới hạn -> ẩn, đề nào đã đặt rồi thì hiện sẵn.
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
                    placeholder='Giới hạn bài viết (0 = bỏ giới hạn)'
                    value={limit || ''}
                    onChange={(_e, {value}) => this.setLimit(parseInt(value, 10) || 0, unit)}
                />
                :
                <a className='cursor' onClick={() => this.setState({showLimit: true})}>
                    + Giới hạn độ dài bài làm
                </a>}
        </Form>
    }
}
