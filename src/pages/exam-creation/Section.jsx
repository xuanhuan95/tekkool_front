import React, {Fragment} from 'react';

import {Menu, Icon, Rail, Sticky} from 'semantic-ui-react';
import MultipleChoice from './questions/MultipleChoice';
import FillBlank from './questions/FillBlank';
import TrueFalse from './questions/TrueFalse';
import ErrorIdentify from './questions/ErrorIdentify';
import FreeAnswer from './questions/FreeAnswer';
import Default from './Default';
import {setNestedValue} from "../../tools";
import {connectGlobalState} from "../../stateUtils";
import {Editor} from "../../components/Editor";


let questionTypes = {
    'FillBlank': FillBlank,
    'MultipleChoice': MultipleChoice,
    'TrueFalse': TrueFalse,
    'ErrorIdentify': ErrorIdentify,
    'FreeAnswer': FreeAnswer,
};

class Section extends React.Component {
    state = {};

    addQuestion = (questionType) => {
        let {section} = this.props;
        let {questions} = section;

        questions = [...questions, Default.question(questionType, section.exam, section.id)];

        this.setSectionState({question_type: questionType});
        this.setSectionState({questions})
    };

    removeQuestion = (question) => {
        let {section} = this.props;
        let {questions} = section;

        questions = questions.filter(q => q.id !== question.id);

        this.setSectionState({questions});
    };

    setSectionState = (newState) => {
        // State: {name, questions}
        let {section} = this.props;
        let {exam} = this.globalState;

        if ('name' in newState) {
            setNestedValue(exam, `sections[id=${section.id}].name`, newState.name);
        }

        if ('questions' in newState) {
            setNestedValue(exam, `sections[id=${section.id}].questions`, newState.questions);
        }

        // ponytail: bug gốc 2018 — addQuestion() gọi setSectionState({question_type})
        // nhưng hàm này chỉ xử lý name/questions, nên section mới không bao giờ có
        // field đó -> POST exam/create trả 500 KeyError: 'question_type'.
        if ('question_type' in newState) {
            setNestedValue(exam, `sections[id=${section.id}].question_type`, newState.question_type);
        }

        this.setGlobalState({exam});
    };

    handleContextRef = contextRef => this.setState({contextRef});

    render() {
        let {section} = this.props;
        let {name, questions} = section;
        let questionType = '';
        if (questions.length)
            questionType = questions[0].type;

        const {contextRef} = this.state;

        return <div className='form' ref={this.handleContextRef}>
            <Editor
                text={name}
                placeholder='Type your section requirements here...'
                onChange={(value) => this.setSectionState({name: value})}
            />

            {questions.length > 0 &&
            questions.map((question) => {
                let Question = questionTypes[question.type];
                return <div key={question.id} style={{position: 'relative'}}>
                    <div className='separator' />

                    <Icon
                        onClick={() => this.removeQuestion(question)}
                        name='close'
                        className='cursor'
                        style={{position: 'absolute', right: '5px', zIndex: '999'}}
                    />

                    <div id={question.id} style={{marginBottom: '18px'}}>
                        <Question question={question} section={section} setSectionState={this.setSectionState}/>
                    </div>
                </div>
                })
            }

            <Rail position='right'>
                <Sticky context={contextRef}>
                    <Menu className='question-types' icon vertical>
                        {questionType ?
                            <Menu.Item onClick={() => this.addQuestion(questionType)} >
                                <Icon name='plus' />
                            </Menu.Item>
                            :
                            <Fragment>
                                <Menu.Item onClick={() => this.addQuestion('MultipleChoice')} >
                                    <Icon name='selected radio' />
                                </Menu.Item>

                                <Menu.Item onClick={() => this.addQuestion('FillBlank')}>
                                    <Icon name='text cursor' />
                                </Menu.Item>

                                <Menu.Item onClick={() => this.addQuestion('TrueFalse')} >
                                    <Icon name='checkmark' />
                                </Menu.Item>

                                <Menu.Item onClick={() => this.addQuestion('ErrorIdentify')}>
                                    <Icon name='find' />
                                </Menu.Item>

                                <Menu.Item onClick={() => this.addQuestion('FreeAnswer')}>
                                    <Icon name='user' />
                                </Menu.Item>
                            </Fragment>
                        }
                    </Menu>
                </Sticky>
            </Rail>
        </div>
    }
}


export default connectGlobalState(Section);
