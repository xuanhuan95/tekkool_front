import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

import {Badge, ErrorState, ProgressBar, buttonClass} from '../../components/ui';
import {IconCrown} from '../../components/ui/icons';
import type {InProgress} from '../../queries/inProgress';
import {errorText, minutesLeft, plainText} from './format';
import type {TitleInfo} from './title';
import './hs.css';

/** Route builders in ONE place (PM merges three branches — fix a path here, not in every screen). */
export const hsPath = {
    exams: (subjectId?: string) => '/exams' + (subjectId ? '?mon=' + encodeURIComponent(subjectId) : ''),
    exam: (examId: string, subjectId?: string) =>
        '/exams/' + encodeURIComponent(examId) + (subjectId ? '?mon=' + encodeURIComponent(subjectId) : ''),
    /** Existing exam route. `?lam_lai=1` = the student CHOSE to start (BE skips the "just submitted" redirect). */
    take: (examId: string, fresh: boolean) => '/do-exam/' + encodeURIComponent(examId) + (fresh ? '?lam_lai=1' : ''),
    result: (submissionId: string) => '/result/' + encodeURIComponent(submissionId),
    history: '/history',
    ranking: '/ranking',
    packages: '/packages',
    me: '/me',
};

/** "Nguyễn Minh Anh" → "Minh Anh" (design greets with middle + given name). */
export function greetName(name?: string | null): string {
    const w = (name || '').trim().split(/\s+/).filter(Boolean);
    return w.length >= 3 ? w.slice(-2).join(' ') : w.join(' ');
}

export function PageHead({title, sub, as: Tag = 'h1'}: {title: ReactNode; sub?: ReactNode; as?: 'h1' | 'h2'}) {
    return <div className='hs-head'>
        <Tag className='hs-head-title'>{title}</Tag>
        {sub && <p className='hs-head-sub'>{sub}</p>}
    </div>;
}

export function LoadError({error, onRetry, what}: {error: unknown; onRetry: () => void; what: string}) {
    return <ErrorState title={'Không tải được ' + what} description={errorText(error, 'Máy chủ đang bận, thử lại sau ít phút.')}
                       onRetry={onRetry}/>;
}

/** "Đang làm dở" card (HS-TrangChu / HS-Web-TrangChu). */
export function ContinueCard({cont, web}: {cont: InProgress; web?: boolean}) {
    const name = plainText(cont.exam_name) || 'Đề không tên';
    const go = <Link to={hsPath.take(cont.exam_id, false)} className={buttonClass({variant: web ? 'primary' : 'secondary'})}
                     aria-label={'Làm tiếp ' + name}>Làm tiếp →</Link>;
    const progress = <ProgressBar value={cont.answered} max={cont.total || 1} label='Số câu đã làm'/>;
    if (web) return <section className='vt-card hs-cont hs-cont--web' aria-label='Bài đang làm dở'>
        <div className='hs-cont-main'>
            <Badge tone='sun-strong'>Đang làm dở</Badge>
            <span className='hs-cont-name'>{cont.subject ? cont.subject + ' — ' : ''}{name}</span>
            {progress}
            <span className='hs-meta vt-num'>{cont.answered} / {cont.total} câu · {minutesLeft(cont.remaining_sec)}</span>
        </div>
        {go}
    </section>;
    return <section className='vt-card hs-cont' aria-label='Bài đang làm dở'>
        <div className='hs-row'>
            <Badge tone='sun-strong'>Đang làm dở</Badge>
            <span className='hs-meta'>{minutesLeft(cont.remaining_sec).replace(/^c/, 'C')}</span>
        </div>
        <div className='hs-col2'>
            {cont.subject && <span className='hs-meta'>{cont.subject}</span>}
            <span className='hs-cont-name'>{name}</span>
        </div>
        {progress}
        <div className='hs-row'>
            <span className='hs-meta vt-num'>{cont.answered} / {cont.total} câu</span>
            {go}
        </div>
    </section>;
}

/** Title card with progress to the next title (temporary rule, hs/title.ts). */
export function TitleCard({info, web}: {info: TitleInfo; web?: boolean}) {
    return <section className={'vt-card vt-card--md hs-title' + (web ? ' hs-title--web' : '')} aria-label='Danh hiệu'>
        <span className='hs-title-icon'><IconCrown size={20}/></span>
        <div className='hs-title-main'>
            <div className='hs-row'>
                {web ? <span className='hs-col2'><span className='hs-meta'>Danh hiệu</span>
                        <span className='hs-title-name'>{info.title}</span></span>
                    : <Badge tone='title'>{info.title}</Badge>}
                {info.next && <span className='hs-meta vt-num'>{info.next.value} / {info.next.max} đề</span>}
            </div>
            {info.next
                ? <>
                    <ProgressBar value={info.next.value} max={info.next.max} label={'Tiến độ lên ' + info.next.title}/>
                    <span className='hs-meta'>Làm thêm {info.next.remaining} đề trong tháng này để lên “{info.next.title}”.</span>
                </>
                : <span className='hs-meta'>{info.month} đề trong tháng này. Giữ nhịp nhé!</span>}
        </div>
    </section>;
}
