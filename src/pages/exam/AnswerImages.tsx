import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';

import {Button, IconButton, Modal} from '../../components/ui';
import {IconClose} from '../../components/ui/icons';
import {imageProblem} from '../../components/ImageDialog';
import {errorText} from '../../lib/format';
import Api from '../../services/api';
import {answerImageUrl} from './answerImageUrl';
import {DESKTOP, useMediaQuery} from '../useMediaQuery';
import ImageMarker from '../my/ImageMarker';
import {marksOf} from '../my/imageMarks';
import type {ServerMark} from '../my/imageMarks';
import '../hs/hs.css';

export const MAX_ANSWER_IMAGES = 3;

export {answerImageUrl};

const Ico = ({children}: {children: React.ReactNode}) =>
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'
         strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>{children}</svg>;

/**
 * Thumbnails row; tap = full-size viewer. `onRemove` only while the student can still edit.
 * `marks` (SPT-84, review screens): the viewer then shows the teacher's marks and the notes are listed under the row.
 */
export function AnswerImageThumbs({ids, onRemove, busyId, marks}: {ids: string[]; onRemove?: (id: string) => void; busyId?: string | null; marks?: ServerMark[]}) {
    const [big, setBig] = useState<string | null>(null);
    if (!ids.length) return null;
    const notes = (marks || []).filter(m => m.type === 'text' && m.text && ids.includes(m.image_id))
        .sort((a, b) => ids.indexOf(a.image_id) - ids.indexOf(b.image_id));
    return <>
        <ul className='hs-aimgs' aria-label='Ảnh bài làm đã đính kèm'>
            {ids.map((id, i) => <li key={id} className='hs-aimg'>
                <button type='button' className='hs-aimg-open' aria-label={`Xem ảnh ${i + 1}`} onClick={() => setBig(id)}>
                    <img src={answerImageUrl(id)} alt={`Ảnh bài làm ${i + 1}`}/>
                </button>
                {onRemove && <IconButton variant='outline' tipEnd className='hs-aimg-x' label={`Xoá ảnh ${i + 1}`}
                                         icon={<IconClose size={14}/>} disabled={busyId === id} onClick={() => onRemove(id)}/>}
            </li>)}
        </ul>
        {marks && notes.length > 0 && <>
            <p className='mk-notes-title'>Ghi chú của giáo viên trên ảnh</p>
            <ul className='mk-notes'>{notes.map(m => <li key={m.id} className='mk-note-line'><b>Ảnh {ids.indexOf(m.image_id) + 1}</b> · {m.text}</li>)}</ul>
        </>}
        <Modal open={!!big} onClose={() => setBig(null)} title='Ảnh bài làm' size='md' showClose>
            {big && (marks
                ? <ImageMarker ids={ids} startIndex={ids.indexOf(big)} noFullscreen
                               marks={Object.fromEntries(ids.map(i => [i, marksOf(marks, i)]))}/>
                : <img className='hs-aimg-big' src={answerImageUrl(big)} alt='Ảnh bài làm phóng to'/>)}
        </Modal>
    </>;
}

/**
 * "Ảnh bài làm" (SPT-83, HS-LamBai-TuLuan): up to 3 photos of handwriting under an essay answer.
 * Each photo is uploaded at once (`answer_image/upload/<question>`, 1 per call, ≤ 2 MB) — it does not go through the
 * text autosave. Phone: "Chụp ảnh" (camera) + "Chọn từ thư viện"; desktop: "Tải ảnh lên".
 */
export default function AnswerImages({questionId, initial, disabled}: {questionId: string; initial: string[]; disabled: boolean}) {
    const web = useMediaQuery(DESKTOP);
    const [ids, setIds] = useState<string[]>(initial);
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const camera = useRef<HTMLInputElement>(null);
    const library = useRef<HTMLInputElement>(null);
    const full = ids.length >= MAX_ANSWER_IMAGES;

    const upload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || busy) return;
        const bad = imageProblem(file);
        if (bad) return setErr(bad);
        setBusy(true); setErr(null);
        try {
            const r = await Api.upload<{images: string[]}>('answer_image/upload/' + questionId, file);
            setIds(r.images);
        } catch (ex) {
            setErr(errorText(ex, 'Chưa tải ảnh lên được. Kiểm tra mạng rồi thử lại.'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        setRemoving(id); setErr(null);
        try {
            const r = await Api.post<{images: string[]}>('answer_image/remove/' + questionId, {id});
            setIds(r.images);
        } catch (ex) {
            setErr(errorText(ex, 'Chưa xoá được ảnh. Thử lại.'));
        } finally {
            setRemoving(null);
        }
    };

    return <section className='hs-aimgs-box' aria-label='Ảnh bài làm'>
        <div className='hs-row'>
            <span className='hs-aimgs-title'>Ảnh bài làm</span>
            <span className='hs-meta vt-num' aria-label={`${ids.length} trên ${MAX_ANSWER_IMAGES} ảnh`}>{ids.length}/{MAX_ANSWER_IMAGES}</span>
        </div>
        <AnswerImageThumbs ids={ids} busyId={removing} onRemove={disabled ? undefined : remove}/>
        {!disabled && <div className='hs-aimgs-actions'>
            {/* capture=environment opens the rear camera on phones; the library input has no capture so the OS offers the gallery */}
            <input ref={camera} type='file' accept='image/jpeg,image/png' capture='environment' hidden onChange={upload}/>
            <input ref={library} type='file' accept='image/jpeg,image/png' hidden onChange={upload}/>
            {web
                ? <Button variant='secondary' icon={<Ico><path d='M12 16V4M7 9l5-5 5 5M4 20h16'/></Ico>} loading={busy} loadingText='Đang tải lên…'
                          disabled={full} onClick={() => library.current?.click()}>Tải ảnh lên</Button>
                : <>
                    <Button variant='secondary' icon={<Ico><path d='M4 8h3l2-3h6l2 3h3v11H4z'/><circle cx='12' cy='13' r='3.5'/></Ico>}
                            loading={busy} loadingText='Đang tải lên…' disabled={full} onClick={() => camera.current?.click()}>Chụp ảnh</Button>
                    <Button variant='secondary' icon={<Ico><rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='10' r='1.6'/><path d='M21 16l-5-5-8 8'/></Ico>}
                            disabled={full || busy} onClick={() => library.current?.click()}>Chọn từ thư viện</Button>
                </>}
        </div>}
        {err && <p role='alert' className='hs-aimgs-err'>{err}</p>}
    </section>;
}

