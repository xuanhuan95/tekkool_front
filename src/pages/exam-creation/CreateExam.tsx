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
    useExamDraftStore(s => s.version);   // re-render when the exam is mutated in place
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
            // With an examId = editing an exam, without = creating a new one.
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

    // ponytail: `save` reads the exam from the store at call time (getState) instead of
    // closing over it — otherwise the interval holds the first render's draft and auto-save
    // overwrites everything typed afterwards.
    const save = async (successMsg: string) => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return;
        await Api.post('exam/create', current);

        // ponytail: exam/create does NOT accept a folder field (the BE keeps the old
        // version's folder; a new exam -> null). Call the existing move_to_folder instead of changing the BE.
        // Runs only once: after that the folder is set, and later saves keep it on the BE.
        const folder = new URLSearchParams(location.search).get('folder');
        if (folder && !movedToFolder.current) {
            await Api.post('exam/move_to_folder', {examId: current.id, folderId: folder});
            movedToFolder.current = true;
        }

        toast.success(successMsg);
    };

    // ponytail: original 2018 bug — the interval wasn't cleared on unmount, so 2 minutes
    // after leaving the page it still POSTed exam/create with stale state (creating empty exams in the DB).
    useEffect(() => {
        if (!ready) return;
        const id = setInterval(() => { save('Auto save successfully'); }, AUTO_SAVE_MS);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // Save before printing but without a toast — the user is waiting for the print dialog.
    const printExam = () => {
        setModalPrint(true);
        const current = useExamDraftStore.getState().exam;
        if (current) Api.post('exam/create', current);
    };

    // ponytail: Element.closest + classList replace Zepto — vendor/zepto.min.js is dropped entirely.
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
 * ponytail: split out because `<Sticky context>` needs a ref that is ALREADY attached. The old
 * version assigned `sectionContextRef` to a plain variable in a callback ref, so when Sticky
 * read it, it was still null — the section title bar never stuck.
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
