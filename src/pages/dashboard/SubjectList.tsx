import {Link} from 'react-router-dom';

import {Badge} from '../../components/ui';
import type {Folder} from '../../types/exam';

/** "5 đề · 2 nháp" / "3 đề" / "Chưa có đề"; null when BE is old and sends no count (never claim "Chưa có đề" wrongly). */
export function examCountText({exam_count: n, draft_count: d}: Pick<Folder, 'exam_count' | 'draft_count'>): string | null {
    if (n == null) return null;
    return n === 0 ? 'Chưa có đề' : n + ' đề' + (d ? ` · ${d} nháp` : '');
}

function SubjectLink({subject, active, card}: {subject: Folder; active?: boolean; card?: boolean}) {
    const meta = examCountText(subject);
    return <Link to={'/subject/' + subject.id} className={'vt-th-subj' + (card ? ' vt-card' : '')} aria-current={active ? 'page' : undefined}>
        <b>{subject.name}{subject.hidden && <Badge tone='sun'>Đang ẩn</Badge>}</b>
        {meta && <span>{meta}</span>}
    </Link>;
}

/** Left column of the master–detail (≥1024): subjects with "N đề · M nháp"; the open one is filled blue. */
export function SubjectNav({subjects, activeId}: {subjects: Folder[]; activeId?: string}) {
    return <nav className='vt-card vt-th-subjects' aria-label='Môn'>
        <ul>{subjects.map(s => <li key={s.id}><SubjectLink subject={s} active={s.id === activeId}/></li>)}</ul>
        <p className='vt-th-subjects-foot'>Môn do Admin tạo. Số đề gồm cả nháp của bạn.</p>
    </nav>;
}

/** `/` on a phone: one card per subject; tapping opens `/subject/:id`. */
export function SubjectCards({subjects}: {subjects: Folder[]}) {
    return <>
        <ul className='vt-th-exams'>{subjects.map(s => <li key={s.id}><SubjectLink subject={s} card/></li>)}</ul>
        <p className='vt-th-note'>Bấm một môn để xem các đề của môn đó.</p>
    </>;
}
