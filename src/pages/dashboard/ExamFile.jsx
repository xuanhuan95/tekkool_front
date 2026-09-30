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
        let confirm = window.confirm('Xoá đề này? Bài học sinh đã nộp cũng mất theo.');
        if (confirm) {
            await Api.post(`exam/delete/${examId}`);
            let exams = await Api.get('exam/list');
            this.setGlobalState({exams});

            toast.success('Đã xoá đề');
        }
    };

    handleDuplicate = async (examId) => {
        let exam = Default.exam();
        await Api.post(`exam/duplicate/${examId}`, exam);

        let exams = await Api.get('exam/list');

        this.setGlobalState({exams});
        toast.success('Đã nhân bản đề');
    };

    render() {
        let {exam, folderOptions, moveToFolder} = this.props;

        return <div className='tk-dexam'>
            <Link to={'/edit-exam/' + exam.id} className='tk-dexam-name'>
                <Icon name='file text outline'/>
                {striptags(exam.name) || '(đề không tên)'}
            </Link>

            {/* Nhom nut day sang phai, doc ca cot thang hang cho nhanh. */}
            <div className='tk-dexam-actions'>
                <Popup
                    trigger={<Button size='mini' basic icon title='Chuyển sang thư mục khác'>
                        <Icon name='folder outline'/>
                    </Button>}
                    content={<Dropdown
                        onChange={(e, {value}) => {
                            moveToFolder(exam.id, value)
                        }}
                        placeholder='Chuyển vào thư mục'
                        selection
                        options={folderOptions}
                    />}
                    on='click'
                    hideOnScroll
                />

                {/* Loi vao cham bai — khong co nut nay thi giao vien khong biet
                    hoc sinh da nop gi, bai tu luan treo mai o 'cho cham'. */}
                <Link to={'/to-grade/' + exam.id}>
                    <Button size='mini' basic color='blue'>
                        <Icon name='check square outline'/> Bài nộp
                    </Button>
                </Link>

                <Button size='mini' basic onClick={() => this.handleDuplicate(exam.id)}>
                    <Icon name='copy outline'/> Nhân bản
                </Button>

                {/* Xoa la viec khong go lai duoc: de basic cho no nhat hon
                    'Bai nop', dung de nut pha huy noi nhat dong. */}
                <Button size='mini' basic icon title='Xoá đề'
                        onClick={() => this.handleDelete(exam.id)}>
                    <Icon name='trash alternate outline' color='red'/>
                </Button>
            </div>
        </div>
    }
}

export default connectGlobalState(ExamFile);
