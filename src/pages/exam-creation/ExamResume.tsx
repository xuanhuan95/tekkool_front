import {Menu} from 'semantic-ui-react';
import striptags from 'striptags';

/**
 * Mục lục bên trái màn soạn đề. Chỉ cần tên + id để dựng link neo, nên nhận
 * hình dạng tối thiểu thay vì type Section đầy đủ của màn soạn đề.
 */
type ResumeQuestion = {
    id: string;
    data: {question?: string};
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
                    {section.questions.map((q, qi) => {
                        qIdx++;
                        let questionTitle = 'Q' + qIdx;
                        if (q.data.question) {
                            questionTitle += ': ' + q.data.question;
                        }

                        return <Menu.Item key={qi} className='cut-text margin-left'>
                            <a className='txt-orange' href={'#' + q.id}>
                                {striptags(questionTitle)}
                            </a>
                        </Menu.Item>;
                    })}
                </Menu.Menu>
            </Menu.Item>;
        })}
    </div>;
}
