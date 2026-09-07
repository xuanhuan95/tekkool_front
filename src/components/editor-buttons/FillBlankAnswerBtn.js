import MediumEditor from 'medium-editor';


export var FillBlankAnswerBtn = MediumEditor.Extension.extend({
    name: 'FillBlankAnswerBtn',

    constructor: function (onToAnswerButton) {
        this.onToAnswerButton = onToAnswerButton;
    },

    init: function () {
        this.button = this.document.createElement('button');
        this.button.classList.add('medium-editor-action');
        this.button.innerHTML = '<i class="angle double down icon"></i>';
        this.on(this.button, 'click', (event) => {
            if (!this.onToAnswerButton) return;

            let range = MediumEditor.selection.getSelectionRange(document);
            let selectedContent = range.toString();
            this.base.pasteHTML('__________');
            this.onToAnswerButton(selectedContent);

            let toolbar = this.base.getExtensionByName('toolbar');
            if (toolbar) {
                toolbar.hideToolbar();
            }

            // Ensure the editor knows about an html change so watchers are notified
            // ie: <textarea> elements depend on the editableInput event to stay synchronized
            this.base.checkContentChanged();
        });
    },

    getButton: function () {
        return this.button;
    }
});
