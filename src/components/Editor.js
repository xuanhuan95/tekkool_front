import React from "react";
import ReactMediumEditor from 'react-medium-editor';

import 'medium-editor/dist/css/medium-editor.min.css';
import 'medium-editor/dist/css/themes/default.min.css';

import {FillBlankAnswerBtn} from "./editor-buttons/FillBlankAnswerBtn";
import {ErrorIdentifyAnswerBtn} from "./editor-buttons/ErrorIdentifyAnswerBtn";


export class Editor extends React.Component {
    constructor(props) {
        super(props);

        this.timeout = null;
        this.options = {};
    }

    componentWillMount() {
        let extensions = {};
        let buttons = [
            'bold',
            'italic',
            'underline',
            {name: 'justifyLeft', contentDefault: '<i class="align left icon"></i>'},
            {name: 'justifyCenter', contentDefault: '<i class="align center icon"></i>'},
            {name: 'justifyRight', contentDefault: '<i class="align right icon"></i>'},
            {name: 'justifyFull', contentDefault: '<i class="align justify icon"></i>'},
        ];

        let {onToAnswerButton, type} = this.props;
        if (onToAnswerButton) {
            if (type === 'FillBlank') {
                extensions['FillBlankAnswerBtn'] = new FillBlankAnswerBtn(onToAnswerButton);
                buttons.push('FillBlankAnswerBtn');

            } else if (type === 'ErrorIdentify') {
                extensions['ErrorIdentifyAnswerBtn'] = new ErrorIdentifyAnswerBtn(onToAnswerButton);
                buttons.push('ErrorIdentifyAnswerBtn');
            }
        }

        let toolbar = (this.props.disableStyle) ? false : {buttons};

        this.options = {
            toolbar,
            extensions: extensions,
            placeholder: {
                text: this.props.placeholder,
                hideOnClick: true
            },
            disableReturn: this.props.disableReturn,
            // paste: {
            //     forcePlainText: false,
            //     cleanPastedHTML: false,
            //     cleanReplacements: [],
            //     cleanAttrs: ['style', 'dir'],
            //     cleanTags: ['meta']
            // }
        };
    }

    componentDidMount() {
        if (!this.props.refMedium) return;
        this.props.refMedium.current.medium.subscribe('editablePaste', (event, element) => {
            if (this.props.onPaste) this.props.onPaste(event, element);
        })
    }

    /** Override onChange for optimizing performance,
     * If use types too fast, then trigger only last action */
    onChange = (content) => {
        if (!this.props.onChange) return;
        if (this.timeout) clearTimeout(this.timeout);

        this.timeout = setTimeout(() => {
            this.props.onChange(content);
        }, 500)
    };

    render() {
        let props = {...this.props};

        let {refMedium} = props;
        delete props.onToAnswerButton;
        delete props.refMedium;
        delete props.onPaste;
        delete props.onChange;
        delete props.disableReturn;
        delete props.disableStyle;

        return (
            <ReactMediumEditor
                ref={refMedium}
                {...props}
                options={this.options}
                onChange={this.onChange}
            />
        )
    }
}
