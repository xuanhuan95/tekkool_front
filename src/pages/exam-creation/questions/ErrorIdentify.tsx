import MultipleChoice from './MultipleChoice';
import type {BaseQuestionProps} from './BaseQuestion';

// ponytail: tung la ban chep 177 dong cua MultipleChoice, khac dung 4 cho —
// nen sua bug o mot file thi file kia van hong. Gio chi con phan KHAC that:
//
//   - o tich thay cho gach chan "______"  (editorType)
//   - nut "chuyen vung chon thanh dap an" (toAnswerButton; Editor an nut nay
//     khi khong co onToAnswerButton, nen MultipleChoice mac dinh khong co)
//   - class .ErrorIdentify -> CSS counter trong Editor.css danh so A/B/C cho
//     tung o tich. Doi class la mat het so thu tu.
//   - icon xoa khong day xuong 7px (iconOffset) vi dong cua no cao hon.
//
// Phan chung — parse "A. ... B. ..." khi dan tu Word, them/xoa/sua phuong an,
// chon dap an dung — nam ca o MultipleChoice.
export default function ErrorIdentify(props: BaseQuestionProps) {
    return <MultipleChoice
        {...props}
        cssClass='ErrorIdentify'
        editorType='ErrorIdentify'
        toAnswerButton
        iconOffset={false}
        placeholder='Type your Error-identification question here...'
    />;
}
