import {uuid} from "../../tools";


export default class Default {
    // ponytail: bug gốc 2018 — BE apis/exam.py:39 đọc data['section_label']
    // (bắt buộc) nhưng FE không có field này ở đâu cả -> mọi đề TẠO MỚI đều
    // 500 KeyError khi Save. Model BE để StringField() không required nên
    // thêm giá trị mặc định ở đây là đủ, không phải chạm tekkool_back.
    static exam = () => ({
        id: 'E_' + uuid(),
        name: '',
        section_label: 'Phần',
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
