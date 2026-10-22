import MultipleChoice from './MultipleChoice';
import type {BaseQuestionProps} from './BaseQuestion';

// ponytail: used to be a 177-line copy of MultipleChoice differing in exactly 4
// places — so a bug fixed in one file stayed broken in the other. Now only the
// REAL differences remain:
//
//   - check box instead of the "______" underline (editorType)
//   - "turn selection into answer" button (toAnswerButton; Editor hides this
//     button when there is no onToAnswerButton, so MultipleChoice has none)
//   - class .ErrorIdentify -> the CSS counter in Editor.css numbers each check
//     box A/B/C. Changing the class loses all the numbering.
//   - the remove icon is not pushed down 7px (iconOffset) because its row is taller.
//
// The shared part — parsing "A. ... B. ..." pasted from Word, add/remove/edit
// options, choose the correct answer — all lives in MultipleChoice.
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
