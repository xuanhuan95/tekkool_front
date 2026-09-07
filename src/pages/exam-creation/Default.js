import {uuid} from "../../tools";


export default class Default {
    static exam = () => ({
        id: 'E_' + uuid(),
        name: '',
        sections: []
    });


    static section = (examId) => ({
        id: 'S_' + uuid(),
        exam: examId,
        name: '',
        questions: []
    });

    static question = (type, examId, sectionId) => ({
        id: 'Q_' + uuid(),
        type: type,
        exam: examId,
        section: sectionId,
        data: {}
    });
}
