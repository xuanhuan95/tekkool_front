import {Fragment, useState} from 'react';

import {Menu, Icon, Rail, Sticky} from 'semantic-ui-react';
import MultipleChoice from './questions/MultipleChoice';
import FillBlank from './questions/FillBlank';
import TrueFalseBlock from './TrueFalseBlock';
import {toUnits} from './examRules';
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

    // A question component calls `setSectionState({section})` after mutating
    // `question.data` in place — nothing to write, just a re-render is needed.
    const setSectionState = (patch: SectionPatch | {section: SectionType}) => {
        if ('section' in patch) return touch();
        write(section.id, patch);
    };

    const addQuestion = (questionType: string) => {
        // A Đúng/Sai question is a block of 4 ý, never a single one (SPT-63).
        const added = questionType === 'TrueFalse'
            ? Default.trueFalseGroup(section.exam, section.id)
            : [Default.question(questionType, section.exam, section.id)];
        const questions = [...section.questions, ...added];
        // Merged into a single write: the old version called setSectionState twice in a row,
        // re-rendering twice for the same action.
        setSectionState({question_type: questionType, questions});
    };

    // Removing a Đúng/Sai block removes all its ý together.
    const removeUnit = (unit: Question[]) => {
        const ids = unit.map(q => q.id);
        setSectionState({questions: section.questions.filter(q => !ids.includes(q.id))});
    };

    const patchData = (id: string, data: Record<string, unknown>) =>
        setSectionState({questions: section.questions.map(q =>
            q.id === id ? {...q, data: {...q.data, ...data}} : q)});

    // ponytail: the passage is copied into EACH question of the group -> an edit must be written
    // back to the whole group by passageId. Editing only the first question leaves the later ones
    // with the old copy, and students read the unedited text — a silent bug.
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

        {toUnits(questions).map((unit, uidx, units) => {
            const question = unit[0];
            const isTrueFalse = question.type === 'TrueFalse';
            const QuestionView = questionTypes[question.type];
            const prev = uidx ? units[uidx - 1][0] : undefined;
            const {passage, passageId} = question.data || {};
            // Only show the passage editor on the FIRST question of the group.
            const showPassage = !isTrueFalse && passage &&
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
                    onClick={() => removeUnit(unit)}
                    name='close'
                    className='cursor'
                    style={{position: 'absolute', right: '5px', zIndex: '999'}}
                />

                <div id={question.id} style={{marginBottom: '18px'}}>
                    {isTrueFalse
                        ? <TrueFalseBlock unit={unit} onPatch={patchData}
                                          onPassage={html => setPassage(passageId, html)}/>
                        : <QuestionView question={question} section={section}
                                        setSectionState={setSectionState}/>}
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
