import React from 'react';
import {setNestedValue} from "../../../tools";
import type {Question, Section} from "../Default";

export type BaseQuestionProps = {
    question: Question;
    section: Section;
    /**
     * ponytail: `setNestedValue` đã sửa `section` TẠI CHỖ (cùng object nằm
     * trong `exam`), nên lời gọi này không mang dữ liệu gì — nó chỉ báo cho
     * store biết "có thay đổi, vẽ lại đi". Section truyền xuống một hàm
     * `touch`; chữ ký giữ nguyên để 5 file câu hỏi khỏi phải sửa.
     */
    setSectionState: (state: {section: Section}) => void;
};

// ponytail: van la class component — 5 loai cau hoi ke thua lop nay. Khong
// con dinh global state; chuyen sang function component de sau, khong gap.
export default class BaseQuestion<P extends BaseQuestionProps = BaseQuestionProps,
                                  S = {}> extends React.Component<P, S> {
    /**
     * Gộp vài field vào `question.data`. Năm loại câu hỏi đều có một bản sao
     * y hệt hàm này — gom về đây.
     */
    setQuestionData = (newData: Record<string, any>) => {
        const {data} = this.props.question;
        Object.assign(data, newData);
        this.setQuestionState({data});
    };

    setQuestionState = (newState: {data?: Record<string, any>}) => {
        const {question, section, setSectionState} = this.props;

        if ('data' in newState) {
            setNestedValue(section, `questions[id=${question.id}].data`, newState.data);
        }

        setSectionState({section});
    };
}
