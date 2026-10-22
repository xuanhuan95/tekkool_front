import {isValidElement, useId, useRef} from 'react';
import type {KeyboardEvent, ReactNode} from 'react';

import Button from '../Button';
import {IconClip, IconEdit, IconFlag, IconFlagFilled, IconImage} from '../icons';
import {cx} from '../cx';
import {countTrueFalse, countWords} from './types';
import type {TrueFalseValue} from './types';

interface BaseProps {
    number: number;
    /** Question text — caller renders it (SafeHtml / KaTeX / images). */
    prompt: ReactNode;
    /** Overrides "Câu N" (e.g. "Câu 23 · 1,5 điểm"). */
    title?: ReactNode;
    flagged?: boolean;
    /** Omit to hide the "Xem lại sau" button. */
    onToggleFlag?: () => void;
    /** Read-only (after submit / time up). */
    disabled?: boolean;
    /** DOM id used by the strip/grid to scroll here. Default `cau-<number>`. */
    id?: string;
    className?: string;
}

export interface ChoiceOption { key: string; content: ReactNode }

export interface ChoiceQuestionProps extends BaseProps {
    kind: 'choice';
    options: ChoiceOption[];
    value: string | null | undefined;
    onChange: (key: string) => void;
}

export interface TrueFalseStatement { key: string; content: ReactNode }

export interface TrueFalseQuestionProps extends BaseProps {
    kind: 'truefalse';
    statements: TrueFalseStatement[];
    value: TrueFalseValue | null | undefined;
    /** Called with the WHOLE new value. Pressing the chosen Đ/S again clears that statement. */
    onChange: (next: TrueFalseValue) => void;
}

export interface ShortQuestionProps extends BaseProps {
    kind: 'short';
    value: string;
    onChange: (text: string) => void;
    /** "Kết quả (đơn vị: giờ)". */
    label?: string;
    hint?: ReactNode;
}

export type EssayTool = 'bold' | 'italic' | 'formula' | 'image';

export interface EssayQuestionProps extends BaseProps {
    kind: 'essay';
    value: string;
    onChange: (text: string) => void;
    /** Rich editor to use instead of the plain textarea (e.g. the TipTap Editor); it brings its own toolbar. */
    editor?: ReactNode;
    /** Toolbar of the plain textarea (B, I, Σ, image). Hidden when not given. */
    onTool?: (tool: EssayTool) => void;
    /** "Đính kèm ảnh bài làm" button. Hidden when not given. */
    onAttach?: () => void;
}

export type QuestionBlockProps = ChoiceQuestionProps | TrueFalseQuestionProps | ShortQuestionProps | EssayQuestionProps;

/** Short options (numbers like "4", "I = 2") sit four in a row on phones, like the paper; long ones stack. */
function isCompact(options: ChoiceOption[]): boolean {
    return options.length <= 4 && options.every(o =>
        (typeof o.content === 'string' || typeof o.content === 'number') && String(o.content).length <= 6);
}

function ChoiceAnswer({number, options, value, onChange, disabled}: ChoiceQuestionProps) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const selected = options.findIndex(o => o.key === value);
    // Roving tabindex: one Tab stop for the group, arrows move + select (WAI-ARIA radio group).
    const onKeyDown = (e: KeyboardEvent) => {
        if (disabled) return;
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const from = selected < 0 ? (step > 0 ? -1 : 0) : selected;
        const next = (from + step + options.length) % options.length;
        onChange(options[next].key);
        refs.current[next]?.focus();
    };
    return <div role='radiogroup' aria-label={'Đáp án câu ' + number} aria-disabled={disabled || undefined}
                className={cx('vt-options', isCompact(options) && 'vt-options--compact')} onKeyDown={onKeyDown}>
        {options.map((o, i) => {
            const on = o.key === value;
            return <button key={o.key} ref={el => { refs.current[i] = el; }} type='button' role='radio'
                           aria-checked={on} tabIndex={on || (selected < 0 && i === 0) ? 0 : -1}
                           disabled={disabled} className='vt-option'
                           onClick={() => { if (!on) onChange(o.key); }}>
                <span className='vt-option-letter' aria-hidden='true'>{o.key}</span>
                <span className='vt-option-body'><span className='vt-sr-only'>{o.key}. </span>{o.content}</span>
            </button>;
        })}
    </div>;
}

function TrueFalseAnswer({number, statements, value, onChange, disabled}: TrueFalseQuestionProps) {
    const v = value || {};
    const set = (key: string, pick: boolean) => {
        const next: TrueFalseValue = {...v};
        next[key] = v[key] === pick ? null : pick;
        onChange(next);
    };
    return <div className='vt-tf'>
        {statements.map(s => <div key={s.key} role='group' aria-label={`Câu ${number} ý ${s.key}`} className='vt-tf-row'>
            <div className='vt-tf-text'><b>{s.key})</b> {s.content}</div>
            <div className='vt-tf-btns'>
                <button type='button' className='vt-tf-btn' aria-pressed={v[s.key] === true}
                        aria-label={`Ý ${s.key} đúng`} disabled={disabled} onClick={() => set(s.key, true)}>Đ</button>
                <button type='button' className='vt-tf-btn' aria-pressed={v[s.key] === false}
                        aria-label={`Ý ${s.key} sai`} disabled={disabled} onClick={() => set(s.key, false)}>S</button>
            </div>
        </div>)}
    </div>;
}

function ShortAnswer({value, onChange, disabled, label = 'Kết quả',
                      hint = 'Chỉ ghi kết quả, ví dụ: 2,5 hoặc -3'}: ShortQuestionProps) {
    const id = useId();
    return <div className='vt-short'>
        <label htmlFor={id} className='vt-field-label'>{label}</label>
        <input id={id} type='text' inputMode='decimal' autoComplete='off' spellCheck={false}
               className='vt-input vt-input--lg' placeholder='Nhập kết quả'
               aria-describedby={hint ? id + '-hint' : undefined}
               value={value} disabled={disabled} onChange={e => onChange(e.target.value)}/>
        {hint && <span id={id + '-hint'} className='vt-field-hint'>{hint}</span>}
    </div>;
}

const TOOLS: Array<{tool: EssayTool; label: string; body: ReactNode}> = [
    {tool: 'bold', label: 'In đậm', body: <b>B</b>},
    {tool: 'italic', label: 'In nghiêng', body: <i style={{fontFamily: 'Georgia, serif', fontSize: 17}}>I</i>},
    {tool: 'formula', label: 'Chèn công thức', body: <span style={{fontSize: 18}}>Σ</span>},
    {tool: 'image', label: 'Chèn ảnh', body: <IconImage/>},
];

function EssayAnswer({value, onChange, disabled, editor, onTool, onAttach}: EssayQuestionProps) {
    const id = useId();
    const words = countWords(value);
    return <div className='vt-essay'>
        <label htmlFor={editor ? undefined : id} className='vt-field-label'>Bài làm của bạn</label>
        {editor ?? <div className='vt-essay-box'>
            {onTool && <div role='toolbar' aria-label='Định dạng' className='vt-essay-tools'>
                {TOOLS.map(t => <button key={t.tool} type='button' className='vt-essay-tool' aria-label={t.label}
                                        disabled={disabled} onClick={() => onTool(t.tool)}>{t.body}</button>)}
            </div>}
            <textarea id={id} className='vt-essay-text' value={value} disabled={disabled}
                      aria-describedby={id + '-count'} onChange={e => onChange(e.target.value)}/>
            <div id={id + '-count'} className='vt-essay-count'>{words} chữ</div>
        </div>}
        <div className='vt-essay-foot'>
            <div className='vt-essay-note'><IconEdit/> Giáo viên sẽ chấm phần này</div>
            {onAttach && <Button variant='secondary' icon={<IconClip/>} disabled={disabled} onClick={onAttach}>
                Đính kèm ảnh bài làm</Button>}
        </div>
    </div>;
}

/**
 * One question on the single-scroll exam page (HS-LamBai*.dc.html). Presentation only: the caller owns
 * the answer state, autosave and submit. Four SPT kinds: choice (A–D), truefalse (a–d, Đ/S),
 * short (one-line result), essay (graded by the teacher).
 */
export default function QuestionBlock(props: QuestionBlockProps) {
    const {number, prompt, title, flagged, onToggleFlag, disabled, id, className} = props;
    const titleId = useId();

    const sub = props.kind === 'truefalse'
        ? `đã trả lời ${countTrueFalse(props.value)} / ${props.statements.length} ý` : null;

    return <div id={id ?? 'cau-' + number} role='group' aria-labelledby={titleId} className={cx('vt-q', className)}>
        <div className='vt-q-head'>
            <span className='vt-q-titlewrap'>
                <h3 id={titleId} className='vt-q-title'>{title ?? 'Câu ' + number}</h3>
                {sub && <span className='vt-q-sub'>{sub}</span>}
            </span>
            {onToggleFlag &&
                <Button variant='secondary' className='vt-flag' aria-pressed={!!flagged} disabled={disabled}
                        icon={flagged ? <IconFlagFilled/> : <IconFlag/>} onClick={onToggleFlag}>
                    {flagged ? 'Đã đánh dấu' : 'Xem lại sau'}
                </Button>}
        </div>
        {isValidElement(prompt) ? <div className='vt-q-prompt'>{prompt}</div> : <p className='vt-q-prompt'>{prompt}</p>}
        {props.kind === 'choice' && <ChoiceAnswer {...props}/>}
        {props.kind === 'truefalse' && <TrueFalseAnswer {...props}/>}
        {props.kind === 'short' && <ShortAnswer {...props}/>}
        {props.kind === 'essay' && <EssayAnswer {...props}/>}
    </div>;
}
