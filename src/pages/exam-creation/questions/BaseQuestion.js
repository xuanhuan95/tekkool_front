import React from 'react';
import {setNestedValue} from "../../../tools";


export default class BaseQuestion extends React.Component {
    setQuestionState = (newState) => {
        // State: {name, questions}
        let {question, section, setSectionState} = this.props;

        if ('data' in newState) {
            setNestedValue(section, `questions[id=${question.id}].data`, newState.data);
        }

        setSectionState({section});
    };
}


