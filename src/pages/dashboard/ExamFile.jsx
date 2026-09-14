import React from "react";
import Default from "../exam-creation/Default";
import {Button, Icon, Dropdown, Popup} from 'semantic-ui-react';
import {Link} from 'react-router-dom';
import toast from 'react-hot-toast';
import Api from "../../services/api";
import striptags from "striptags";
import {connectGlobalState} from "../../stateUtils";

class ExamFile extends React.Component {
    handleDelete = async (examId) => {
        let confirm = window.confirm('Are you sure delete exam?');
        if (confirm) {
            await Api.post(`exam/delete/${examId}`);
            let exams = await Api.get('exam/list');
            this.setGlobalState({exams});

            toast.success('Delete exam success');
        }
    };

    handleDuplicate = async (examId) => {
        let exam = Default.exam();
        await Api.post(`exam/duplicate/${examId}`, exam);

        let exams = await Api.get('exam/list');

        this.setGlobalState({exams});
        toast.success('Duplicated exam');
    };

    render() {
        let {exam, folderOptions, moveToFolder} = this.props;

        return <div>
            <Link to={/edit-exam/ + exam.id}>
                <Icon size='large' name='file text'/>
                {striptags(exam.name)}
            </Link>

            <Popup
                trigger={<Icon className='margin-left' name='configure'/>}
                content={<Dropdown
                    onChange={(e, {value}) => {
                        moveToFolder(exam.id, value)
                    }}
                    placeholder='To folder'
                    selection
                    options={folderOptions}
                />}
                on='click'
                hideOnScroll
            />

            <Button size='mini' circular color='red' onClick={() => this.handleDelete(exam.id)}>
                <Icon name='delete'/> Delete
            </Button>

            <Button size='mini' circular color='teal' onClick={() => this.handleDuplicate(exam.id)}>
                <Icon name='copy'/> Duplicate
            </Button>
        </div>
    }
}

export default connectGlobalState(ExamFile);
