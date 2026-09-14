import React from 'react';
import {Form} from 'semantic-ui-react';


export default function addPreviewable(WrappedComponent) {
    return class Previewable extends React.Component {
        constructor(props) {
            super(props);

            this.state = {
                value: this.props.value || '',
                mode: props.mode || 'view'
            };

            this.me = React.createRef();
        }

        handleEnter = ({keyCode}) => {
            if (keyCode === 13 && WrappedComponent.name === 'FormInput') {
                this.toViewMode();
            }
        };

        toViewMode = () => {
            // this.setState({mode: 'view'});
        };

        toEditMode = () => {
            this.setState({mode: 'edit'});
        };

        onChange = ({target}) => {
            let {onUpdated} = this.props;

            this.setState({value: target.value});

            onUpdated && onUpdated(target.value);
        };

        render() {
            let props = {...this.props};

            // Remove custom props
            delete props.onUpdated;

            let {value, mode} = this.state;
            let isEmpty = !!value;
            let isTextArea = WrappedComponent.name === 'FormTextArea';

            // Add default placeholder if not given
            // let placeholder = props.placeholder || isTextArea
            //     ? `Type ${props.name} here (multiline) ...`
            //     : `Type ${props.name} here (single line) ...`;

            let placeholder = props.placeholder || `Type ${props.name} here...`;

            // Add autoHeight if TextArea
            if (isTextArea) {
                props['autoHeight'] = true;
                props['rows'] = 1;
            }

            // Element displayed in Edit mode
            let edit = <WrappedComponent
                {...props}
                className='edit-mode'
                placeholder={placeholder}
                value={value}
                onChange={this.onChange}
                onKeyUp={this.handleEnter}
                onBlur={this.toViewMode}
            />;

            if (!value) {
                value = <span className='txt-blue cap'>
                    {/*<Icon name='plus' /> Add {props.name} ...*/}
                    {props.name} ...
                </span>;
            }

            let view = <Form.Field>
                {isEmpty && <label key='label'>{props.label}</label>}
                <div size='large' key='view' className='view-mode cursor' onClick={this.toEditMode}>
                    {WrappedComponent.name === 'FormInput'
                        ? value
                        : <pre>{value}</pre>
                    }
                </div>
            </Form.Field>

            return mode === 'edit' ? edit : view;
        }
    }
}
