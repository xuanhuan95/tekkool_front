import {useEffect, useRef, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import Loading from '../../components/Loading';
import {Segment, Icon, Menu, Modal, Grid, Sticky, Input} from 'semantic-ui-react';
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
import {errorText} from '../../lib/format';
import {backendProblems, examTotal, publishProblems, reviewHints, withDefaultScores} from './examRules';
import {useFolders} from '../../queries/exams';
import {suggestedMinutes} from './CreateFromBank';
import {Badge, Button, ConfirmDialog, ErrorState, IconButton, icons} from '../../components/ui';

const MAX_SHOWN = 6;

/** One toast listing the questions that block Xuất bản / In. */
const showProblems = (problems: string[], head = 'Chưa xuất bản được:') => toast.error(
    [head, ...problems.slice(0, MAX_SHOWN),
        problems.length > MAX_SHOWN ? `… và ${problems.length - MAX_SHOWN} lỗi nữa` : ''].filter(Boolean).join('\n'),
    {duration: 8000, style: {whiteSpace: 'pre-line'}});

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
    const [confirmUnpublish, setConfirmUnpublish] = useState(false);
    const movedToFolder = useRef(false);

    // Subject name decides the default score (Ngữ văn 0,3): from ?folder= when creating, from the exam's folder otherwise.
    const foldersQ = useFolders();
    const folders = foldersQ.data;
    const [loadError, setLoadError] = useState<string | null>(null);
    const [tries, setTries] = useState(0);
    const folderId = new URLSearchParams(location.search).get('folder') || (exam as {folder?: string} | null)?.folder;
    const subject = folders?.find(f => f.id === folderId)?.name ?? null;

    // New exam: duration follows the subject (SPT: Toán/Ngữ văn 90, others 60) until the teacher types their own.
    const durationTouched = useRef(false);
    useEffect(() => {
        if (!examId && ready && subject && !durationTouched.current) patchExam({duration: suggestedMinutes(subject)});
    }, [examId, ready, subject, patchExam]);

    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setLoadError(null);
        (async () => {
            try {
                // With an examId = editing an exam, without = creating a new one.
                const draft: Exam = examId
                    ? await Api.get<Exam>('exam/info/' + examId)
                    : Default.exam();
                if (cancelled) return;
                draft.user = user?.id;
                setExam(draft);
                setReady(true);
            } catch (e) {
                if (!cancelled) setLoadError(errorText(e, 'Kiểm tra mạng rồi thử lại.'));
            }
        })();
        return () => { cancelled = true; };
    }, [examId, user, setExam, tries]);

    // ponytail: `save` reads the exam from the store at call time (getState) instead of
    // closing over it — otherwise the interval holds the first render's draft and auto-save
    // overwrites everything typed afterwards.
    // Q15: a draft saves even with errors (auto-save included); only Xuất bản / In are blocked.
    // Returns true when the exam is on the server.
    const save = async (successMsg: string | null, manual = true): Promise<boolean> => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return false;
        const published = current.status === 'published';
        // A published exam is live for students: never overwrite it silently in the background.
        if (published && !manual) return false;
        try {
            await Api.post('exam/create', {...current, sections: withDefaultScores(current.sections, subject)});
        } catch (e) {
            const fromServer = backendProblems(e);
            if (manual) {
                if (fromServer) showProblems(fromServer, published
                    ? 'Đề đã xuất bản nên không lưu được khi còn lỗi. Hãy sửa các lỗi dưới đây hoặc chuyển đề về Nháp trước:'
                    : 'Chưa lưu được:');
                else toast.error(errorText(e, 'Lưu thất bại'));
            }
            return false;
        }

        // ponytail: exam/create does NOT accept a folder field (the BE keeps the old
        // version's folder; a new exam -> null). Call the existing move_to_folder instead of changing the BE.
        // Runs only once: after that the folder is set, and later saves keep it on the BE.
        const folder = new URLSearchParams(location.search).get('folder');
        if (folder && !movedToFolder.current) {
            await Api.post('exam/move_to_folder', {examId: current.id, folderId: folder});
            movedToFolder.current = true;
        }

        if (successMsg) toast.success(successMsg);
        return true;
    };

    const publish = async () => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return;
        const problems = publishProblems(current.sections);
        if (problems.length) return showProblems(problems);
        if (!(await save(null))) return;
        try {
            await Api.post('exam/publish/' + current.id, {});
            patchExam({status: 'published'});
            toast.success('Đã xuất bản — học sinh đã thấy đề này');
        } catch (e) {
            const fromServer = backendProblems(e);
            fromServer ? showProblems(fromServer) : toast.error(errorText(e, 'Xuất bản thất bại'));
        }
    };

    const unpublish = async () => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return;
        setConfirmUnpublish(false);
        try {
            await Api.post('exam/unpublish/' + current.id, {});
            patchExam({status: 'draft'});
            toast.success('Đã chuyển về Nháp — học sinh không còn thấy đề này');
        } catch (e) {
            toast.error(errorText(e, 'Không chuyển về nháp được'));
        }
    };

    // Light warning only when the exam already has submissions; none → switch at once.
    const askUnpublish = async () => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return;
        try {
            const subs = await Api.get<unknown[]>('exam/to_grade/' + current.id);
            if (subs.length) return setConfirmUnpublish(true);
        } catch { /* cannot tell → still ask */ return setConfirmUnpublish(true); }
        unpublish();
    };

    // ponytail: original 2018 bug — the interval wasn't cleared on unmount, so 2 minutes
    // after leaving the page it still POSTed exam/create with stale state (creating empty exams in the DB).
    useEffect(() => {
        if (!ready) return;
        const id = setInterval(() => { save(null, false); }, AUTO_SAVE_MS);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // In is blocked like Xuất bản. Saves first (quietly) so the printout matches the stored exam.
    const printExam = () => {
        const current = useExamDraftStore.getState().exam;
        if (!current) return;
        const problems = publishProblems(current.sections);
        if (problems.length) return showProblems(problems, 'Chưa in được:');
        setModalPrint(true);
        save(null, false);
    };

    // ponytail: Element.closest + classList replace Zepto — vendor/zepto.min.js is dropped entirely.
    const onMouseOver = ({target}: React.MouseEvent) =>
        (target as HTMLElement).closest('.exam-section-wrapper')?.classList.add('active');

    const onMouseOut = ({target}: React.MouseEvent) =>
        (target as HTMLElement).closest('.exam-section-wrapper')?.classList.remove('active');

    if (loadError || foldersQ.isError) return <div className='margin'>
        <ErrorState title={loadError ? 'Không tải được đề' : 'Không tải được danh sách môn'} description={loadError || errorText(foldersQ.error, 'Kiểm tra mạng rồi thử lại.')}
                    onRetry={() => loadError ? setTries(t => t + 1) : foldersQ.refetch()}/>
    </div>;
    if (!ready || !exam) return <Loading/>;

    const {sections} = exam;
    let questionIndex = 0;
    const published = exam.status === 'published';
    const blocking = publishProblems(sections);
    const hints = reviewHints(sections, subject);
    const total = String(examTotal(sections, subject)).replace('.', ',');

    return <div id='ExamCreation'>
        <Menu id='leftMenu' vertical>
            <Menu.Item header>Tổng quan đề</Menu.Item>

            <div className='vt-editor-summary'>
                <div>Tổng điểm: <strong>{total}</strong></div>
                {blocking.length > 0 && <div className='vt-editor-problems'>
                    <div className='vt-editor-problems-title'>Phải sửa trước khi xuất bản ({blocking.length})</div>
                    <ul>{blocking.slice(0, MAX_SHOWN).map((p, i) => <li key={i}>{p}</li>)}</ul>
                    {blocking.length > MAX_SHOWN && <div>… và {blocking.length - MAX_SHOWN} lỗi nữa</div>}
                </div>}
                {hints.length > 0 && <div className='vt-editor-hints'>
                    <div className='vt-editor-problems-title'>Nên xem lại</div>
                    <ul>{hints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>}
            </div>

            <ExamResume sections={sections}/>
        </Menu>

        <div id='content'>
            <Menu id='topMenu'>
                <Menu.Item className='vt-status-item'>
                    <Badge tone={published ? 'ok' : 'draft'}>
                        {published ? 'Đã xuất bản' : 'Nháp · học sinh chưa thấy'}
                    </Badge>
                </Menu.Item>

                <Menu.Item onClick={addSection}>
                    <Icon name='plus'/> Thêm phần
                </Menu.Item>

                <Modal className='full-width margin-top'
                       trigger={<Menu.Item> <Icon name='eye'/> Xem đề </Menu.Item>}>
                    <Modal.Content>
                        <PreviewExam/>
                    </Modal.Content>
                </Modal>

                <Modal className='full-width margin-top'
                       trigger={<Menu.Item> <Icon name='eye'/> Xem đáp án </Menu.Item>}>
                    <Modal.Content>
                        <PreviewAnswer/>
                    </Modal.Content>
                </Modal>

                <Menu.Item onClick={printExam}>
                    <Icon name='print'/> In
                </Menu.Item>

                <Menu.Menu position='right'>
                    <Menu.Item>
                        {published
                            ? <>
                                <Button variant='secondary' onClick={askUnpublish}>Chuyển về nháp</Button>
                                <Button onClick={() => save('Đã lưu thay đổi')}>Lưu thay đổi</Button>
                              </>
                            : <>
                                <Button variant='secondary' onClick={() => save('Đã lưu nháp')}>Lưu nháp</Button>
                                <Button onClick={publish}>Xuất bản</Button>
                              </>}
                    </Menu.Item>
                </Menu.Menu>

                <Modal className='full-width margin-top' open={modalPrint}>
                    <Modal.Content>
                        <PreviewExam action='print' closeModal={() => setModalPrint(false)}/>
                    </Modal.Content>
                </Modal>

                <ConfirmDialog open={confirmUnpublish} title='Chuyển đề về Nháp?'
                               message='Đề này đã có học sinh làm. Chuyển về Nháp thì học sinh mới không thấy đề nữa; bài đã nộp vẫn giữ nguyên.'
                               confirmLabel='Chuyển về nháp'
                               onConfirm={unpublish} onCancel={() => setConfirmUnpublish(false)}/>
            </Menu>

            <div className='content-wrapper' id='sectionWrapper'>
                <Editor
                    text={exam.name}
                    placeholder='Nhập tên đề...'
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
                                    onChange={(_e, {value}) => { durationTouched.current = true; patchExam({duration: parseInt(value, 10) || 0}); }}
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
                        questionIndex={questionIndex} subject={subject}
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
    subject: string | null;
    onRemove: () => void;
    onMouseOver: (e: React.MouseEvent) => void;
    onMouseOut: (e: React.MouseEvent) => void;
};

/**
 * ponytail: split out because `<Sticky context>` needs a ref that is ALREADY attached. The old
 * version assigned `sectionContextRef` to a plain variable in a callback ref, so when Sticky
 * read it, it was still null — the section title bar never stuck.
 */
function SectionCard({section, index, questionIndex, subject, onRemove, onMouseOver, onMouseOut}: CardProps) {
    const [ref, setRef] = useState<HTMLElement | null>(null);
    const [confirmRemove, setConfirmRemove] = useState(false);

    return <div className='exam-section-wrapper' ref={setRef}
                onMouseOver={onMouseOver} onMouseOut={onMouseOut}>
        <Segment id={section.id} className='exam-section'>
            <Sticky context={ref}>
                <Segment>Phần {index + 1}
                    <IconButton label={'Xoá phần ' + (index + 1)} variant='outline' tipEnd style={{float: 'right'}}
                                icon={<icons.IconClose size={18}/>} onClick={() => setConfirmRemove(true)}/>
                </Segment>
            </Sticky>

            <Section section={section} questionIndex={questionIndex} subject={subject}/>
        </Segment>
        <ConfirmDialog open={confirmRemove} tone='danger' title={'Xoá phần ' + (index + 1) + '?'} cancelLabel='Giữ lại' confirmLabel='Xoá phần'
                       message='Mọi câu hỏi trong phần này sẽ bị xoá khỏi đề.'
                       onCancel={() => setConfirmRemove(false)} onConfirm={() => { setConfirmRemove(false); onRemove(); }}/>
    </div>;
}
