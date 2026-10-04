import {Fragment, useState} from 'react';

import {Menu, Icon, Rail, Sticky} from 'semantic-ui-react';
import MultipleChoice from './questions/MultipleChoice';
import FillBlank from './questions/FillBlank';
import TrueFalse from './questions/TrueFalse';
import ErrorIdentify from './questions/ErrorIdentify';
import FreeAnswer from './questions/FreeAnswer';
import Default from './Default';
import type {Question, Section as SectionType} from './Default';
import {useExamDraftStore} from '../../stores/examDraftStore';
import type {SectionPatch} from '../../stores/examDraftStore';
import {Editor} from "../../components/Editor";


const questionTypes: Record<string, any> = {
    'FillBlank': FillBlank,
    'MultipleChoice': MultipleChoice,
    'TrueFalse': TrueFalse,
    'ErrorIdentify': ErrorIdentify,
    'FreeAnswer': FreeAnswer,
};

type Props = {
    section: SectionType;
    questionIndex?: number;
};

export default function Section({section}: Props) {
    const [contextRef, setContextRef] = useState<HTMLElement | null>(null);
    const write = useExamDraftStore(s => s.setSectionState);
    const touch = useExamDraftStore(s => s.touch);

    // Question component gọi `setSectionState({section})` sau khi đã tự sửa
    // `question.data` tại chỗ — không có gì để ghi, chỉ cần vẽ lại.
    const setSectionState = (patch: SectionPatch | {section: SectionType}) => {
        if ('section' in patch) return touch();
        write(section.id, patch);
    };

    const addQuestion = (questionType: string) => {
        const questions = [...section.questions,
            Default.question(questionType, section.exam, section.id)];
        // Gộp một lần ghi: bản cũ gọi setSectionState hai lần liên tiếp nên
        // vẽ lại hai lượt cho cùng một thao tác.
        setSectionState({question_type: questionType, questions});
    };

    const removeQuestion = (question: Question) => {
        setSectionState({questions: section.questions.filter(q => q.id !== question.id)});
    };

    // ponytail: ngu lieu la ban sao trong TUNG cau cung nhom -> sua phai ghi lai
    // cho ca nhom theo passageId. Sua moi cau dau thi cac cau sau giu ban cu,
    // hoc sinh doc phai van ban chua sua — loi im lang.
    const setPassage = (passageId: string, html: string) => {
        const questions = section.questions.map(q =>
            q.data && q.data.passageId === passageId
                ? {...q, data: {...q.data, passage: html}} : q);
        setSectionState({questions});
    };

    const {name, questions} = section;
    const questionType = questions.length ? questions[0].type : '';

    return <div className='form' ref={setContextRef}>
        <Editor
            text={name}
            placeholder='Type your section requirements here...'
            onChange={(value: string) => setSectionState({name: value})}
        />

        {questions.map((question, idx) => {
            const QuestionView = questionTypes[question.type];
            const prev = questions[idx - 1];
            const {passage, passageId} = question.data || {};
            // Chi hien o soan ngu lieu o cau DAU nhom.
            const showPassage = passage &&
                !(prev && prev.data && prev.data.passageId === passageId);

            return <div key={question.id} style={{position: 'relative'}}>
                <div className='separator'/>

                {showPassage &&
                <div className='passage passage-edit'>
                    <div className='passage-label'>
                        Ngữ liệu dùng chung — sửa ở đây áp dụng cho cả nhóm câu
                    </div>
                    <Editor text={passage}
                            onChange={(html: string) => setPassage(passageId, html)}/>
                </div>}

                <Icon
                    onClick={() => removeQuestion(question)}
                    name='close'
                    className='cursor'
                    style={{position: 'absolute', right: '5px', zIndex: '999'}}
                />

                <div id={question.id} style={{marginBottom: '18px'}}>
                    <QuestionView question={question} section={section}
                                  setSectionState={setSectionState}/>
                </div>
            </div>
        })}

        <Rail position='right'>
            <Sticky context={contextRef}>
                <Menu className='question-types' icon vertical>
                    {questionType ?
                        <Menu.Item onClick={() => addQuestion(questionType)}>
                            <Icon name='plus'/>
                        </Menu.Item>
                        :
                        <Fragment>
                            <Menu.Item onClick={() => addQuestion('MultipleChoice')}>
                                <Icon name='selected radio'/>
                            </Menu.Item>

                            <Menu.Item onClick={() => addQuestion('FillBlank')}>
                                <Icon name='text cursor'/>
                            </Menu.Item>

                            <Menu.Item onClick={() => addQuestion('TrueFalse')}>
                                <Icon name='checkmark'/>
                            </Menu.Item>

                            <Menu.Item onClick={() => addQuestion('ErrorIdentify')}>
                                <Icon name='find'/>
                            </Menu.Item>

                            <Menu.Item onClick={() => addQuestion('FreeAnswer')}>
                                <Icon name='user'/>
                            </Menu.Item>
                        </Fragment>
                    }
                </Menu>
            </Sticky>
        </Rail>
    </div>;
}
