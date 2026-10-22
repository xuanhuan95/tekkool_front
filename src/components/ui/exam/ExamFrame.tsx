import type {ReactNode} from 'react';

import Button from '../Button';
import Card from '../Card';
import ProgressBar from '../ProgressBar';
import {IconAlert, IconBack, IconSaved} from '../icons';
import {cx} from '../cx';
import {WARN_SECONDS, formatClock, spokenClock} from './types';

export interface ExamHeaderProps {
    /** "Toán · Đề thi thử SPT số 3" */
    title: string;
    /** Seconds left — the CALLER computes it from the server deadline; this only draws it. null = no time limit. */
    secondsLeft: number | null;
    answered: number;
    total: number;
    onExit: () => void;
    onSubmit: () => void;
    /** Submit in flight: button spins and ignores clicks (no double submit). */
    submitting?: boolean;
    /** Rendered inside the same sticky block, under the header (phone question strip). */
    strip?: ReactNode;
}

/**
 * Exam header, sticky, white, no menu: exit · clock · "Nộp bài"; under it subject · paper and
 * "x / N đã làm", then the progress bar. Last 5 minutes: clock red.
 * Phone and web are ONE markup rearranged by CSS grid (exam.css).
 */
export function ExamHeader({title, secondsLeft, answered, total, onExit, onSubmit, submitting, strip}: ExamHeaderProps) {
    const warn = secondsLeft !== null && secondsLeft <= WARN_SECONDS;
    return <div className='vt-exam-top'>
        <header className='vt-exam-header'>
            <div className='vt-exam-header-grid'>
                <div className='vt-exam-lead'>
                    <Button variant='secondary' iconOnly className='vt-exam-exit' aria-label='Thoát bài thi'
                            onClick={onExit}><IconBack/></Button>
                    <div className='vt-exam-brand'>
                        <span className='vt-exam-brand-logo' aria-hidden='true'>viettestpro</span>
                        <span className='vt-exam-brand-title'>{title}</span>
                    </div>
                </div>
                <div className='vt-exam-timer-wrap'>
                    {/* role=timer is not live: a screen reader reads it on demand, not every second. */}
                    {secondsLeft === null
                        ? <span className='vt-timer vt-timer--none'>Không giới hạn</span>
                        : <span role='timer' aria-label={'Thời gian còn lại ' + spokenClock(secondsLeft)}
                                className={cx('vt-timer', warn && 'vt-timer--warn')}>{formatClock(secondsLeft)}</span>}
                </div>
                <div className='vt-exam-tail'>
                    <span className='vt-exam-count'>{answered} / {total} đã làm</span>
                    <Button variant='primary' className='vt-exam-submit' loading={submitting}
                            onClick={onSubmit}>Nộp bài</Button>
                </div>
                <ProgressBar className='vt-exam-progress' value={answered} max={total} label='Số câu đã làm'/>
            </div>
        </header>
        {strip}
    </div>;
}

export interface ExamSectionProps {
    id?: string;
    /** "Phần I · Trắc nghiệm" */
    title: ReactNode;
    /** "Câu 1–12 · 0,25 điểm/câu · chọn 1 trong 4 đáp án" */
    note?: ReactNode;
    children: ReactNode;
}

/** One part of the paper; parts are separated by a 2px ink rule. */
export function ExamSection({id, title, note, children}: ExamSectionProps) {
    const hid = (id || 'phan') + '-title';
    return <section id={id} aria-labelledby={hid} className='vt-exam-section'>
        <div className='vt-exam-section-head'>
            <h2 id={hid} className='vt-exam-section-title'>{title}</h2>
            {note && <p className='vt-exam-section-note'>{note}</p>}
        </div>
        {children}
    </section>;
}

export interface AutosaveNoteProps {
    /** "20:41" — time of the last successful save. */
    savedAt?: string | null;
    /** Last save failed for good (e.g. answer too long). */
    error?: boolean;
    /** A save is on its way. */
    saving?: boolean;
    /** Network lost: answers are kept on this device and retried. Wins over the others. */
    offline?: boolean;
}

/** "Đã lưu tự động lúc 20:41" with the green tick; "Đang lưu…"; red when offline or failed. */
export function AutosaveNote({savedAt, error, saving, offline}: AutosaveNoteProps) {
    if (offline) return <span role='status' className='vt-saved vt-saved--error'><IconAlert size={14}/>
        Mất kết nối — đáp án được giữ trên máy, sẽ tự lưu khi có mạng.</span>;
    if (error) return <span role='status' className='vt-saved vt-saved--error'><IconAlert size={14}/>
        Chưa lưu được. Kiểm tra mạng.</span>;
    if (saving) return <span role='status' className='vt-saved'>Đang lưu…</span>;
    if (!savedAt) return null;
    return <span role='status' className='vt-saved'><IconSaved/>Đã lưu tự động lúc {savedAt}</span>;
}

export interface ExamEndProps {
    answered: number;
    total: number;
    flagged?: number;
    savedAt?: string | null;
    saveError?: boolean;
    saving?: boolean;
    offline?: boolean;
    onSubmit: () => void;
    submitting?: boolean;
    /** Paper locked (time up): button disabled. */
    disabled?: boolean;
}

/** End of the paper: "Hết đề", answered/flagged summary, autosave line, big "Nộp bài". */
export function ExamEnd({answered, total, flagged = 0, savedAt, saveError, saving, offline, onSubmit, submitting,
                         disabled}: ExamEndProps) {
    return <Card as='section' aria-label='Nộp bài' className='vt-exam-end'>
        <div className='vt-exam-end-info'>
            <span className='vt-exam-end-title'>Hết đề</span>
            <span className='vt-exam-end-summary'>
                Bạn đã làm <span className='vt-num'>{answered} / {total}</span> câu
                {flagged > 0 && <> · {flagged} câu đánh dấu</>}
            </span>
            <AutosaveNote savedAt={savedAt} error={saveError} saving={saving} offline={offline}/>
        </div>
        <Button variant='primary' size='lg' block loading={submitting} disabled={disabled}
                onClick={onSubmit}>Nộp bài</Button>
    </Card>;
}

export interface ExamBannerProps {
    tone?: 'error' | 'warn';
    icon?: ReactNode;
    children: ReactNode;
}

/**
 * Full-width strip under the exam header (HS-LamBai-DangCuon): "Còn dưới 5 phút — bài sẽ tự nộp
 * khi hết giờ", "Mất kết nối…". role=alert so it is announced once when it appears.
 */
export function ExamBanner({tone = 'error', icon, children}: ExamBannerProps) {
    return <div role='alert' className={cx('vt-exam-banner', tone === 'warn' && 'vt-exam-banner--warn')}>
        {icon ?? <IconAlert size={16}/>}<span>{children}</span>
    </div>;
}

export interface ExamLayoutProps {
    header: ReactNode;
    /** The whole paper: sections + ExamEnd. */
    children: ReactNode;
    /** Web only (≥1024px): sticky side column, usually a QuestionGrid card. */
    aside?: ReactNode;
}

/** White exam page: sticky header on top, paper in the middle (max 820px), sticky grid on the right on web. */
export function ExamLayout({header, children, aside}: ExamLayoutProps) {
    return <div className='vt-plain vt-exam'>
        {header}
        <div className='vt-exam-body'>
            <main className='vt-exam-paper'>{children}</main>
            {aside && <aside aria-label='Danh sách câu' className='vt-exam-aside'>{aside}</aside>}
        </div>
    </div>;
}
