import React from 'react';
import {Menu} from 'semantic-ui-react';
import {connectGlobalState} from "../../stateUtils";
import striptags from 'striptags';


class ExamResume extends React.Component {
    render() {
        let {sections} = this.props;
        let qIdx = 0;

        return <div className='exam-resume'>
            {sections.map((section, idx) => {
                let sectionTitle = 'S' + (idx+1);
                if (section.name) {
                    sectionTitle += ': ' + section.name;
                }

                return <Menu.Item key={idx}>
                    <Menu.Header className='cut-text'>
                        <a href={'#' + section.id}>{striptags(sectionTitle)}</a>
                    </Menu.Header>

                    <Menu.Menu>
                        {section.questions.map((q, idx) => {
                            qIdx ++;
                            let questionTitle = 'Q' + (qIdx);
                            if (q.data.question) {
                                questionTitle += ': ' + q.data.question;
                            }

                            return <Menu.Item key={idx} className='cut-text margin-left'>
                                <a className='txt-orange' href={'#' + q.id}>
                                    {striptags(questionTitle)}
                                </a>
                            </Menu.Item>
                        })}
                    </Menu.Menu>
                </Menu.Item>
            })}
        </div>


    }
}

 export default connectGlobalState(ExamResume);

