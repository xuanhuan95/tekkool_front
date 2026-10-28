import {memo} from 'react';

import {QuestionBlock} from '../../components/ui';
import renderHTML from '../../components/SafeHtml';
import {Editor} from '../../components/Editor';
import {formatDecimal} from '../../lib/format';
import AnswerImages from './AnswerImages';
import {choiceKey, choiceWrites, textValue, trueFalseValue, trueFalseWrites} from './paper';
import type {PaperQuestion, RawAnswers} from './paper';

type QuestionViewProps = {
    question: PaperQuestion;
    answers: RawAnswers;
    flagged: boolean;
    disabled: boolean;
    onToggleFlag: (number: number) => void;
    /** Raw writes + debounce for the autosave queue. */
    onWrite: (writes: RawAnswers, delayMs: number) => void;
    textDelayMs: number;
};

/** Plain text stays a string (QuestionBlock lays short options 4 in a row); HTML/KaTeX/images go through SafeHtml. */
const content = (html: string) => /[<&]/.test(html) ? renderHTML(html) : html;

/** Maps one paper question onto the kit's QuestionBlock (4 SPT kinds). */
function QuestionView({question: q, answers, flagged, disabled, onToggleFlag, onWrite, textDelayMs}: QuestionViewProps) {
    const common = {
        number: q.number,
        flagged,
        disabled,
        onToggleFlag: () => onToggleFlag(q.number),
        prompt: <>{renderHTML(q.prompt)}</>,
        title: q.showPoints && q.maxScore !== null
            ? <>Câu {q.number} <small className='vt-q-pts'>{formatDecimal(q.maxScore)}đ</small></> : undefined,
    };
    const id = q.questionIds[0];

    if (q.kind === 'choice') {
        return <QuestionBlock kind='choice' {...common}
                              options={q.options.map(o => ({key: o.key, content: content(o.value)}))}
                              value={choiceKey(q, answers)}
                              onChange={key => onWrite(choiceWrites(q, key), 0)}/>;
    }
    if (q.kind === 'truefalse') {
        const value = trueFalseValue(q, answers);
        return <QuestionBlock kind='truefalse' {...common}
                              statements={q.statements.map(s => ({key: s.key, content: renderHTML(s.html)}))}
                              value={value}
                              onChange={next => onWrite(trueFalseWrites(q, value, next), 0)}/>;
    }
    if (q.kind === 'short') {
        return <QuestionBlock kind='short' {...common} value={textValue(q, answers)}
                              onChange={text => onWrite({[id]: text}, textDelayMs)}/>;
    }
    const raw = answers[id] || '';
    return <QuestionBlock kind='essay' {...common}
                          title={q.maxScore !== null ? `Câu ${q.number} · ${formatDecimal(q.maxScore)} điểm` : undefined}
                          value={raw} onChange={() => {}}
                          editor={disabled
                              ? <div className='tt-editor'><div className='ProseMirror'>{renderHTML(raw)}</div></div>
                              : <Editor text={raw} placeholder='Viết bài làm của bạn…' variant='student'
                                        maxChars={q.maxChars} maxWords={q.maxWords}
                                        onChange={html => onWrite({[id]: html}, textDelayMs)}/>}
                          extra={<AnswerImages questionId={id} initial={(q.raw as {markedImages?: string[]}).markedImages || []}
                                               disabled={disabled}/>}/>;
}

export default memo(QuestionView);
