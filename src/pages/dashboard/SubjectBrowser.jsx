import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Card, Icon, List, Loader, Message, Label, Button} from 'semantic-ui-react';
import striptags from 'striptags';

import Api from '../../services/api';

// ponytail: màn hình DUY NHẤT cho học sinh — chọn môn, chọn đề, bấm làm bài.
// Không tách thêm route /subject/:id: state 1 biến `subject` là đủ, thêm route
// là thêm một chỗ phải giữ đồng bộ mà chẳng ai bookmark trang này.
export default function SubjectBrowser() {
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState(null);
    const [subject, setSubject] = useState(null);
    const [exams, setExams] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        Api.get('folder/subjects')
            .then(setSubjects)
            .catch(e => setError(e.error || e.message || 'Không tải được danh sách môn học'));
    }, []);

    const openSubject = async (f) => {
        setSubject(f);
        setExams(null);
        try {
            setExams(await Api.get('exam/browse?folder=' + f.id));
        } catch (e) {
            setError(e.error || e.message || 'Không tải được danh sách đề');
        }
    };

    // Đề miễn phí vào thẳng; đề có giá thì qua trang thanh toán. Mỗi lượt làm
    // bài là một đơn nên KHÔNG nhớ "đã mua" ở đây — BE trả 403 là quay lại đây.
    const openExam = (exam) => {
        if (exam.price > 0) return navigate('/payment/' + exam.id);
        return navigate('/do-exam/' + exam.id);
    };

    if (error) return <Message negative className='margin'>{error}</Message>;
    if (!subjects) return <Loader active/>;

    if (!subject) return <div className='margin'>
        <h2>Chọn môn học</h2>
        <Card.Group itemsPerRow={4} stackable>
            {subjects.map(f =>
                <Card key={f.id} link onClick={() => openSubject(f)}>
                    <Card.Content textAlign='center'>
                        <Icon name='folder open outline' size='huge' color='orange'/>
                        <Card.Header className='margin-top'>{f.name}</Card.Header>
                    </Card.Content>
                </Card>
            )}
        </Card.Group>
        {!subjects.length && <Message info>Chưa có môn học nào.</Message>}
    </div>;

    return <div className='margin'>
        <Button basic onClick={() => setSubject(null)}>
            <Icon name='arrow left'/> Tất cả môn học
        </Button>

        <h2>{subject.name}</h2>

        {!exams ? <Loader active inline/> :
            !exams.length ? <Message info>Môn này chưa có đề nào.</Message> :
                <List divided relaxed size='large'>
                    {exams.map(exam =>
                        <List.Item key={exam.id} className='cursor' onClick={() => openExam(exam)}>
                            <List.Content floated='right'>
                                <Label color={exam.price > 0 ? 'orange' : 'green'}>
                                    {exam.price > 0
                                        ? (exam.price).toLocaleString('vi-VN') + ' đ / lượt'
                                        : 'Miễn phí'}
                                </Label>
                            </List.Content>
                            <List.Icon name='file alternate outline' size='large' verticalAlign='middle'/>
                            <List.Content>
                                <List.Header as='a'>{striptags(exam.name) || 'Đề không tên'}</List.Header>
                            </List.Content>
                        </List.Item>
                    )}
                </List>}
    </div>;
}
