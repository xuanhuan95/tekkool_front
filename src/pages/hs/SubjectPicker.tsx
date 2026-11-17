import type {ReactNode} from 'react';

import {COMBOS, applyCombo, comboPressed, pickStatus, sortSubjects, subjectKey, toggleSubject} from './subjects';
import type {SubjectKey} from './subjects';
import '../student/home.css';

/** Line icons of the 12 subjects, copied path for path from the artboards (APP-student-*). */
const ICONS: Record<SubjectKey, ReactNode> = {
    math: <><rect x='5' y='3' width='14' height='18' rx='2'/><path d='M8 7h8'/><path d='M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01'/></>,
    lit: <><path d='M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6z'/><path d='M12 6v13'/></>,
    eng: <><path d='M4 5h16v11h-9l-4 4v-4H4z'/><path d='M9.5 13.5L12 7.5l2.5 6'/><path d='M10.4 11.5h3.2'/></>,
    phys: <><ellipse cx='12' cy='12' rx='9' ry='3.5'/><ellipse cx='12' cy='12' rx='9' ry='3.5' transform='rotate(60 12 12)'/><ellipse cx='12' cy='12' rx='9' ry='3.5' transform='rotate(120 12 12)'/><circle cx='12' cy='12' r='1.2'/></>,
    chem: <><path d='M9 3h6'/><path d='M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3'/><path d='M7.5 15h9'/></>,
    bio: <><path d='M8 3c0 6 8 6 8 9s-8 3-8 9'/><path d='M16 3c0 6-8 6-8 9s8 3 8 9'/><path d='M9 6.5h6M9 17.5h6'/></>,
    hist: <><path d='M3 9l9-5 9 5z'/><path d='M5 20h14'/><path d='M6 9v8M10 9v8M14 9v8M18 9v8'/></>,
    geo: <><circle cx='12' cy='12' r='9'/><path d='M3 12h18'/><ellipse cx='12' cy='12' rx='4' ry='9'/></>,
    civ: <><path d='M12 3v18'/><path d='M6 21h12'/><path d='M5 7h14'/><path d='M5 7l-3 7a3 3 0 0 0 6 0z'/><path d='M19 7l-3 7a3 3 0 0 0 6 0z'/></>,
    inf: <><path d='M9 7l-5 5 5 5'/><path d='M15 7l5 5-5 5'/><path d='M13.5 5l-3 14'/></>,
    techi: <><circle cx='12' cy='12' r='3'/><circle cx='12' cy='12' r='6.5'/><path d='M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8'/></>,
    techa: <><path d='M12 21V8'/><path d='M12 8c-3 0-4-2-4-4 3 0 4 2 4 4zM12 8c3 0 4-2 4-4-3 0-4 2-4 4z'/><path d='M12 14c-3 0-4-2-4-4 3 0 4 2 4 4zM12 14c3 0 4-2 4-4-3 0-4 2-4 4z'/><path d='M12 20c-3 0-4-2-4-4 3 0 4 2 4 4zM12 20c3 0 4-2 4-4-3 0-4 2-4 4z'/></>,
};

const GENERIC = <><path d='M6 3h9l4 4v14H6z'/><path d='M14 3v5h5'/><path d='M9 13h6M9 17h4'/></>;

/** Colour class of a subject name: "sj sj--math"; unknown name → plain "sj". */
export function sjClass(name?: string | null): string {
    const k = subjectKey(name);
    return k ? 'sj sj--' + k : 'sj';
}

/** Subject tile icon (decorative). `small` = the 34px variant. */
export function SubjectIcon({name, small}: {name?: string | null; small?: boolean}) {
    const k = subjectKey(name);
    return <span className={'sj-ico' + (small ? ' sj-ico--sm' : '')} aria-hidden='true'>
        <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'
             strokeLinejoin='round' aria-hidden='true' focusable='false'>{k ? ICONS[k] : GENERIC}</svg>
    </span>;
}

export type PickSubject = {id: string; name: string; exams?: number};

/**
 * "Chọn môn em thi" body shared by sign-up step 2 and Hồ sơ (edit): combos, tiles, then `children`
 * (the button row). Controlled; 3–7 rules live in subjects.ts.
 */
export function SubjectPicker({subjects, selected, onChange, gridClass = 'g3', children}: {
    subjects: PickSubject[]; selected: string[]; onChange: (ids: string[]) => void; gridClass?: string; children?: ReactNode;
}) {
    const list = sortSubjects(subjects);
    const st = pickStatus(selected.length);
    return <>
        <p className='ch-lab' style={{margin: 0}}>Chọn nhanh theo tổ hợp</p>
        <div className='c-combos' role='group' aria-label='Tổ hợp môn' style={{margin: 0}}>
            {COMBOS.map(c => <button key={c.code} type='button' className='c-combo' aria-pressed={comboPressed(c, selected, list)}
                                     onClick={() => onChange(applyCombo(c, selected, list))}>
                <b>{c.code}</b><span>{c.label}</span>
            </button>)}
        </div>
        <p className='ch-lab' style={{margin: 0}}>Hoặc chọn từng môn</p>
        <div className={'ch-grid ' + gridClass}>
            {list.map(s => {
                const on = selected.includes(s.id);
                const locked = st.full && !on;
                return <button key={s.id} type='button' className={'ch-t ' + sjClass(s.name)} aria-pressed={on}
                               aria-disabled={locked ? true : undefined} onClick={() => !locked && onChange(toggleSubject(selected, s.id))}>
                    {s.exams === 0 && <span className='soon'>Sắp có</span>}
                    <span className='ck'><svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'
                                              strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>
                        <path d='M5 12l5 5 9-10'/></svg></span>
                    <SubjectIcon name={s.name} small/>
                    <span><b>{s.name}</b></span>
                </button>;
            })}
        </div>
        {children}
        {st.note && <p className='ch-note' role='status' style={{color: st.tone === 'err' ? 'var(--vt-err)' : 'var(--vt-muted)'}}>{st.note}</p>}
    </>;
}
