import {useEffect, useRef, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import Loading from '../../components/Loading';
import {Segment, Icon, Menu, Divider, Modal, Grid, Sticky, Input} from 'semantic-ui-react';
import toast from 'react-hot-toast';

import Api from "../../services/api";
import Section from './Section';
import Default from './Default';
import type {Exam, Section as SectionType} from './Default';
import ExamResume from './ExamResume';
import PreviewExam from './PreviewExam';
import PreviewAnswer from './PreviewAnswer';
import {useAuthStore} from '../../stores/authStore';
import {useExamDraftStore} from '../../stores/examDraftStore';
import {Editor} from "../../components/Editor";

const AUTO_SAVE_MS = 120_000;

export default function CreateExam() {
    const {examId} = useParams();
    const location = useLocation();
    const user = useAuthStore(s => s.user);

    const exam = useExamDraftStore(s => s.exam);
    useExamDraftStore(s => s.version);   // vẽ lại khi exam bị sửa tại chỗ
    const setExam = useExamDraftStore(s => s.setExam);
    const patchExam = useExamDraftStore(s => s.patchExam);
    const addSection = useExamDraftStore(s => s.addSection);
    const removeSection = useExamDraftStore(s => s.removeSection);

    const [ready, setReady] = useState(false);
    const [modalPrint, setModalPrint] = useState(false);
    const movedToFolder = useRef(false);

    useEffect(() => {
        let cancelled = false;
        setReady(false);
        (async () => {
            // Có examId = sửa đề, không có = tạo mới.
            const draft: Exam = examId
                ? await Api.get<Exam>('exam/info/' + examId)
                : Default.exam();
            if (cancelled) return;
            draft.user = user?.id;
            setExam(draft);
            setReady(true);
        })();
        return () => { cancelled = true; };
    }, [examId, user, setExam]);

    // ponytail: `save` đọc đề từ store lúc gọi (getState) chứ không khép vào
    // closure — nếu không, interval giữ bản nháp của lần render đầu và auto-save
    // ghi đè mọi thứ gõ sau đó.
    const save = async (successMsg: string) => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return;
        await Api.post('exam/create', current);

        // ponytail: exam/create KHÔNG nhận field folder (BE giữ folder của bản
        // cũ, đề mới -> null). Gọi move_to_folder sẵn có thay vì sửa BE.
        // Chỉ chạy một lần: sau đó folder đã có, lần save sau BE tự giữ.
        const folder = new URLSearchParams(location.search).get('folder');
        if (folder && !movedToFolder.current) {
            await Api.post('exam/move_to_folder', {examId: current.id, folderId: folder});
            movedToFolder.current = true;
        }

        toast.success(successMsg);
    };

    // ponytail: bug gốc 2018 — không clear interval khi unmount, nên rời trang
    // xong 2 phút sau vẫn POST exam/create bằng state cũ (sinh ra đề rỗng trong DB).
    useEffect(() => {
        if (!ready) return;
        const id = setInterval(() => { save('Auto save successfully'); }, AUTO_SAVE_MS);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // Lưu trước khi in nhưng không báo toast — người dùng đang chờ hộp in.
    const printExam = () => {
        setModalPrint(true);
        const current = useExamDraftStore.getState().exam;
        if (current) Api.post('exam/create', current);
    };

    // ponytail: Element.closest + classList thay Zepto — bỏ luôn vendor/zepto.min.js.
    const onMouseOver = ({target}: React.MouseEvent) =>
        (target as HTMLElement).closest('.exam-section-wrapper')?.classList.add('active');

    const onMouseOut = ({target}: React.MouseEvent) =>
        (target as HTMLElement).closest('.exam-section-wrapper')?.classList.remove('active');

    if (!ready || !exam) return <Loading/>;

    const {sections} = exam;
    let questionIndex = 0;

    return <div id='ExamCreation'>
        <Menu id='leftMenu' vertical>
            <Menu.Item header>Resume</Menu.Item>

            <Divider style={{margin: 0}}/>

            <ExamResume sections={sections}/>
        </Menu>

        <div id='content'>
            <Menu id='topMenu'>
                <Menu.Item onClick={addSection}>
                    <Icon name='plus'/> Add Section
                </Menu.Item>

                <Modal className='full-width margin-top'
                       trigger={<Menu.Item> <Icon name='eye'/> Preview exam </Menu.Item>}>
                    <Modal.Content>
                        <PreviewExam/>
                    </Modal.Content>
                </Modal>

                <Modal className='full-width margin-top'
                       trigger={<Menu.Item> <Icon name='eye'/> Preview answer </Menu.Item>}>
                    <Modal.Content>
                        <PreviewAnswer/>
                    </Modal.Content>
                </Modal>

                <Menu.Item onClick={() => save('Your exam is saved successfully')}>
                    <Icon name='save'/> Save
                </Menu.Item>

                <Menu.Item onClick={printExam}>
                    <Icon name='print'/> Print
                </Menu.Item>

                <Modal className='full-width margin-top' open={modalPrint}>
                    <Modal.Content>
                        <PreviewExam action='print' closeModal={() => setModalPrint(false)}/>
                    </Modal.Content>
                </Modal>
            </Menu>

            <div className='content-wrapper' id='sectionWrapper'>
                <Editor
                    text={exam.name}
                    placeholder='Type your test name here...'
                    onChange={(name: string) => patchExam({name})}
                />

                <hr/>

                <Segment>
                    <Grid>
                        <Grid.Row>
                            <Grid.Column width={4}>
                                <Editor
                                    text={exam.left_header}
                                    placeholder='Left header here...'
                                    onChange={(left_header: string) => patchExam({left_header})}
                                />
                            </Grid.Column>

                            <Grid.Column width={6}>
                                <Editor
                                    text={exam.right_header}
                                    placeholder='Right header here...'
                                    onChange={(right_header: string) => patchExam({right_header})}
                                />
                            </Grid.Column>

                            <Grid.Column width={3}>
                                <Input
                                    fluid
                                    type='number'
                                    min={0}
                                    label='Phút'
                                    placeholder='0 = không giới hạn'
                                    value={exam.duration === undefined ? Default.DURATION : exam.duration}
                                    onChange={(_e, {value}) => patchExam({duration: parseInt(value, 10) || 0})}
                                />
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Segment>

                {sections.map((section: SectionType, idx: number) => {
                    if (idx > 0) {
                        questionIndex += sections[idx - 1].questions.length;
                    }

                    return <SectionCard
                        key={section.id} section={section} index={idx}
                        questionIndex={questionIndex}
                        onRemove={() => removeSection(section.id)}
                        onMouseOver={onMouseOver} onMouseOut={onMouseOut}
                    />;
                })}
            </div>
        </div>
    </div>;
}

type CardProps = {
    section: SectionType;
    index: number;
    questionIndex: number;
    onRemove: () => void;
    onMouseOver: (e: React.MouseEvent) => void;
    onMouseOut: (e: React.MouseEvent) => void;
};

/**
 * ponytail: tách riêng vì `<Sticky context>` cần một ref ĐÃ gắn. Bản cũ gán
 * `sectionContextRef` bằng biến thường trong callback ref nên lúc Sticky đọc
 * vẫn là null — thanh tiêu đề section không bao giờ dính.
 */
function SectionCard({section, index, questionIndex, onRemove, onMouseOver, onMouseOut}: CardProps) {
    const [ref, setRef] = useState<HTMLElement | null>(null);

    return <div className='exam-section-wrapper' ref={setRef}
                onMouseOver={onMouseOver} onMouseOut={onMouseOut}>
        <Segment id={section.id} className='exam-section'>
            <Sticky context={ref}>
                <Segment>Section {index + 1}
                    <Icon onClick={onRemove} name='close' color='grey'
                          className='cursor' style={{float: 'right'}}/>
                </Segment>
            </Sticky>

            <Section section={section} questionIndex={questionIndex}/>
        </Segment>
    </div>;
}
