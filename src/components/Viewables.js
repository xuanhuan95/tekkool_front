import addViewable from "./hocs/addPreviewable";
import {Form} from "semantic-ui-react";

export var ViewableTextArea = addViewable(Form.TextArea);
export var ViewableInput = addViewable(Form.Input);
