import React from 'react';
import {Segment, Icon, Menu, Loader, Divider, Modal, Grid, Sticky} from 'semantic-ui-react';
import 'toastr/build/toastr.min.css'
import toastr from 'toastr';

import Api from "../../services/api";
import Section from './Section';
import Default from './Default';
import ExamResume from './ExamResume';
import PreviewExam from './PreviewExam';
import PreviewAnswer from './PreviewAnswer';
import {connectGlobalState} from "../../stateUtils";
import {Editor} from "../../components/Editor";


class CreateExam extends React.Component {
    autoSaveInterval = null;

    state = {
        isReady: false,
        exam: Default.exam(),
        activeSegment: null,
        modalPrint: false,
    };

    async componentWillMount() {
        clearInterval(this.autoSaveInterval);
        // If has examId => edit mode, else => creation mode
        let {examId} = this.props.match.params;
        let {auth} = this.globalState;

        let exam;

        if (examId) {
            exam = await Api.get('exam/info/' + examId);
        } else {
            exam = Default.exam();
        }

        exam.user = auth.user.id;

        this.setGlobalState({exam});
        this.setState({isReady: true});
    };

    componentDidUpdate() {
        // this.scrollToBottom();
    }

    addSection = () => {
        let {exam} = this.globalState;
        let {sections} = exam;

        sections = [...sections, Default.section(exam.id)];
        exam.sections = sections;
        this.setGlobalState({exam});
    };

    setExamData = (data) => {
        let {exam} = this.globalState;

        Object.keys(data).forEach(attr => {
            exam[attr] = data[attr];
        });

        this.setGlobalState({exam});
    };

    removeSection = (section) => {
        let {exam} = this.globalState;
        let {sections} = exam;

        exam.sections = sections.filter(s => s.id !== section.id);
        this.setGlobalState({exam});
    };

    save = async (successMsg) => {
        await Api.post('exam/create', this.globalState.exam);
        toastr.success(successMsg);
    };

    printExam = () => {
        this.setState({modalPrint: true});
        Api.post('exam/create', this.globalState.exam);
    };

    closeModalPrint = () => {
        this.setState({modalPrint: false});
    };

    onMouseOver = ({target}) => {
        let currentSection = window.$(target).closest('.exam-section-wrapper');
        if (!currentSection.hasClass('active')) currentSection.addClass('active');
    };

    onMouseOut = ({target}) => {
        let currentSection = window.$(target).closest('.exam-section-wrapper');
        currentSection.removeClass('active');
    };

    componentDidMount(){
        this.autoSaveInterval = setInterval(()=>{
            this.save('Auto save successfully')
        }, 120000)
    }

    render() {
        let {isReady, modalPrint} = this.state;
        if (!isReady) {
            return <Loader active/>
        }

        let {exam} = this.globalState;
        let {sections} = exam;
        let questionIndex = 0;

        return <div id='ExamCreation'>
            <Menu id='leftMenu' vertical>
                <Menu.Item header>
                    Resume
                </Menu.Item>

                <Divider style={{margin: 0}}/>

                <ExamResume sections={sections}/>
            </Menu>

            <div id='content'>
                <Menu id='topMenu'>
                    <Menu.Item onClick={this.addSection}>
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

                    <Menu.Item onClick={()=> {this.save('Your exam is saved successfully')}}>
                        <Icon name='save'/> Save
                    </Menu.Item>

                    <Menu.Item onClick={this.printExam}>
                        <Icon name='print'/> Print
                    </Menu.Item>

                    <Modal className='full-width margin-top' open={modalPrint}>
                        <Modal.Content>
                            <PreviewExam action='print' closeModal={this.closeModalPrint}/>
                        </Modal.Content>
                    </Modal>
                </Menu>

                <div className='content-wrapper' id='sectionWrapper'>
                    <Editor
                        text={exam.name}
                        placeholder='Type your test name here...'
                        onChange={name => this.setGlobalState({exam: {...exam, name}})}
                    />

                    <hr/>

                    <Segment>
                        <Grid>
                            <Grid.Row>
                                <Grid.Column width={4}>
                                    <Editor
                                        text={exam.left_header}
                                        placeholder='Left header here...'
                                        onChange={left_header => this.setExamData({left_header})}
                                    />
                                </Grid.Column>

                                <Grid.Column width={12}>
                                    <Editor
                                        text={exam.right_header}
                                        placeholder='Right header here...'
                                        onChange={right_header => this.setExamData({right_header})}
                                    />
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Segment>

                    {sections.map((section, idx) => {
                        if (idx > 0) {
                            questionIndex += sections[idx - 1].questions.length;
                        }

                        let sectionContextRef = null;

                        return <div
                            key={section.id} className='exam-section-wrapper'
                            onMouseOver={this.onMouseOver}
                            onMouseOut={this.onMouseOut}
                            ref={ref => {
                                sectionContextRef = ref;
                                // this.forceUpdate();
                            }}
                        >
                            <Segment id={section.id} className='exam-section'>
                                <Sticky context={sectionContextRef}>
                                    <Segment>Section {idx + 1}
                                        <Icon
                                            onClick={() => this.removeSection(section)}
                                            name='close'
                                            color='grey'
                                            className='cursor'
                                            style={{float: 'right'}}
                                        />
                                    </Segment>
                                </Sticky>

                                <Section section={section} questionIndex={questionIndex}/>
                            </Segment>
                        </div>
                    })}
                </div>
            </div>
        </div>;
    }
}


export default connectGlobalState(CreateExam);
