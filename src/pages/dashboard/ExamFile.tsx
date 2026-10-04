import {Button, Icon, Dropdown, Popup} from 'semantic-ui-react';
import {Link} from 'react-router-dom';
import toast from 'react-hot-toast';
import striptags from 'striptags';

import Api from '../../services/api';
import Default from '../exam-creation/Default';
import {useRefreshExams} from '../../queries/exams';
import type {ExamSummary} from '../../types/exam';

/** `value: ''` = "(ngoài thư mục)". Semantic không nhận `null` làm value
 * của Dropdown, nên dùng chuỗi rỗng rồi quy về null ở `moveToFolder`. */
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

        {/* Nhóm nút đẩy sang phải, dọc cả cột thẳng hàng cho nhanh. */}
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

            {/* Lối vào chấm bài — không có nút này thì giáo viên không biết
                học sinh đã nộp gì, bài tự luận treo mãi ở 'chờ chấm'. */}
            <Link to={'/to-grade/' + exam.id}>
                <Button size='mini' basic color='blue'>
                    <Icon name='check square outline'/> Bài nộp
                </Button>
            </Link>

            <Button size='mini' basic onClick={handleDuplicate}>
                <Icon name='copy outline'/> Nhân bản
            </Button>

            {/* Xoá là việc không gỡ lại được: để basic cho nó nhạt hơn
                'Bài nộp', đừng để nút phá huỷ nổi nhất dòng. */}
            <Button size='mini' basic icon title='Xoá đề' onClick={handleDelete}>
                <Icon name='trash alternate outline' color='red'/>
            </Button>
        </div>
    </div>;
}
