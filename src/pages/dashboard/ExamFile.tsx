import {Button, Icon, Dropdown, Popup} from 'semantic-ui-react';
import {Link} from 'react-router-dom';
import toast from 'react-hot-toast';
import striptags from 'striptags';

import Api from '../../services/api';
import Default from '../exam-creation/Default';
import {useRefreshExams} from '../../queries/exams';
import type {ExamSummary} from '../../types/exam';

/** `value: ''` = "(outside any folder)". Semantic does not accept `null` as a Dropdown
 * value, so use an empty string and map it back to null in `moveToFolder`. */
export type FolderOption = {text: string; value: string};

type Props = {
    exam: ExamSummary;
    folderOptions: FolderOption[];
    moveToFolder: (examId: string, folderId: string | null) => void;
};

export default function ExamFile({exam, folderOptions, moveToFolder}: Props) {
    const refreshExams = useRefreshExams();

    const handleDelete = async () => {
        if (!window.confirm('Xoá đề này? Bài học sinh đã nộp cũng mất theo.')) return;
        await Api.post(`exam/delete/${exam.id}`);
        refreshExams();
        toast.success('Đã xoá đề');
    };

    const handleDuplicate = async () => {
        await Api.post(`exam/duplicate/${exam.id}`, Default.exam());
        refreshExams();
        toast.success('Đã nhân bản đề');
    };

    return <div className='tk-dexam'>
        <Link to={'/edit-exam/' + exam.id} className='tk-dexam-name'>
            <Icon name='file text outline'/>
            {striptags(exam.name) || '(đề không tên)'}
        </Link>

        {/* Button group pushed to the right, aligned down the whole column for quick scanning. */}
        <div className='tk-dexam-actions'>
            <Popup
                trigger={<Button size='mini' basic icon title='Chuyển sang thư mục khác'>
                    <Icon name='folder outline'/>
                </Button>}
                content={<Dropdown
                    onChange={(_e, {value}) => moveToFolder(exam.id, (value as string) || null)}
                    placeholder='Chuyển vào thư mục'
                    selection
                    options={folderOptions}
                />}
                on='click'
                hideOnScroll
            />

            {/* Entry to grading — without this button the teacher cannot tell what
                students submitted, and essays stay stuck at 'awaiting grading'. */}
            <Link to={'/to-grade/' + exam.id}>
                <Button size='mini' basic color='blue'>
                    <Icon name='check square outline'/> Bài nộp
                </Button>
            </Link>

            <Button size='mini' basic onClick={handleDuplicate}>
                <Icon name='copy outline'/> Nhân bản
            </Button>

            {/* Deleting cannot be undone: keep it basic so it is paler than
                'Submissions', don't let the destructive button be the most prominent in the row. */}
            <Button size='mini' basic icon title='Xoá đề' onClick={handleDelete}>
                <Icon name='trash alternate outline' color='red'/>
            </Button>
        </div>
    </div>;
}
