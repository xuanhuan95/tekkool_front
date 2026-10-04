import React from 'react';
import {setNestedValue} from "../../../tools";
import type {Question, Section} from "../Default";

export type BaseQuestionProps = {
    question: Question;
    section: Section;
    setSectionState: (state: {section: Section}) => void;
};

// ponytail: van la class component — 5 loai cau hoi ke thua lop nay. Chuyen
// sang function component lam cung luc voi connectGlobalState o lat sau.
export default class BaseQuestion<P extends BaseQuestionProps = BaseQuestionProps,
                                  S = {}> extends React.Component<P, S> {
    setQuestionState = (newState: {data?: Record<string, any>}) => {
        const {question, section, setSectionState} = this.props;

        if ('data' in newState) {
            setNestedValue(section, `questions[id=${question.id}].data`, newState.data);
        }

        setSectionState({section});
    };
}
