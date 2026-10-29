import {Menu} from 'semantic-ui-react';
import striptags from 'striptags';

import {toUnits} from './examRules';

/**
 * Table of contents on the left of the exam editor. It only needs name + id to
 * build anchor links, so it takes a minimal shape instead of the editor's full Section type.
 */
type ResumeQuestion = {
    id: string;
    type?: string;
    data: {question?: string; passageId?: string};
};

type ResumeSection = {
    id: string;
    name?: string;
    questions: ResumeQuestion[];
};

export default function ExamResume({sections}: {sections: ResumeSection[]}) {
    let qIdx = 0;

    return <div className='exam-resume'>
        {sections.map((section, idx) => {
            let sectionTitle = 'S' + (idx + 1);
            if (section.name) {
                sectionTitle += ': ' + section.name;
            }

            return <Menu.Item key={idx}>
                <Menu.Header className='cut-text'>
                    <a href={'#' + section.id}>{striptags(sectionTitle)}</a>
                </Menu.Header>

                <Menu.Menu>
                    {toUnits(section.questions).map(u => u[0]).map((q, qi) => {
                        qIdx++;
                        let questionTitle = 'Q' + qIdx;
                        if (q.data.question) {
                            questionTitle += ': ' + q.data.question;
                        }

                        return <Menu.Item key={qi} className='cut-text margin-left'>
                            <a href={'#' + q.id}>
                                {striptags(questionTitle)}
                            </a>
                        </Menu.Item>;
                    })}
                </Menu.Menu>
            </Menu.Item>;
        })}
    </div>;
}
