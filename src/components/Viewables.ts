import addViewable from "./hocs/addPreviewable";
import {Form} from "semantic-ui-react";

export const ViewableTextArea = addViewable(Form.TextArea);
export const ViewableInput = addViewable(Form.Input);
