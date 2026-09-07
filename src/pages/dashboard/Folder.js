import React from 'react';
import {Link} from 'react-router-dom';
import striptags from 'striptags';
import {List} from 'semantic-ui-react';
import Api from '../../services/api';


class Folder extends React.Component {
    state = {exams: []};

    fetchExams = async (folderId) => {
        let exams = await Api.get('exam/list?folder=' + folderId);
        this.setState({exams});
    };

    componentDidMount = () => {
        this.fetchExams(this.props.match.params.folderId);
    };

    componentWillReceiveProps = (nextProps) => {
        this.fetchExams(nextProps.match.params.folderId);
    };

    render() {
        let {exams} = this.state;

        return <List divided relaxed>
            {exams.map(exam =>
                <List.Item key={exam.id}>
                    <List.Icon name='file outline' size='large' verticalAlign='middle'/>
                    <List.Content>
                        <List.Header as='h4'>
                            <Link to={/edit-exam/ + exam.id}>
                                {striptags(exam.name)}
                            </Link>
                        </List.Header>
                        <List.Description as='div'>{exam.creator.name}</List.Description>
                    </List.Content>
                </List.Item>
            )}
        </List>
    }
}

export default Folder;
