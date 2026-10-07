import React from 'react';
import {setNestedValue} from "../../../tools";
import type {Question, Section} from "../Default";

export type BaseQuestionProps = {
    question: Question;
    section: Section;
    /**
     * ponytail: `setNestedValue` already mutates `section` IN PLACE (the same
     * object lives inside `exam`), so this call carries no data — it only tells
     * the store "something changed, re-render". Section passes down a `touch`
     * function; the signature is kept so the 5 question files need no changes.
     */
    setSectionState: (state: {section: Section}) => void;
};

// ponytail: still a class component — 5 question types extend this class. No
// longer tied to global state; moving to a function component can wait.
export default class BaseQuestion<P extends BaseQuestionProps = BaseQuestionProps,
                                  S = {}> extends React.Component<P, S> {
    /**
     * Merge a few fields into `question.data`. All five question types had an
     * identical copy of this function — consolidated here.
     */
    setQuestionData = (newData: Record<string, any>) => {
        const {data} = this.props.question;
        Object.assign(data, newData);
        this.setQuestionState({data});
    };

    setQuestionState = (newState: {data?: Record<string, any>}) => {
        const {question, section, setSectionState} = this.props;

        if ('data' in newState) {
            setNestedValue(section, `questions[id=${question.id}].data`, newState.data);
        }

        setSectionState({section});
    };
}
