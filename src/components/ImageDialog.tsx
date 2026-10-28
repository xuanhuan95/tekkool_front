import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';

import Api from '../services/api';
import {errorText} from '../lib/format';
import {Button, Modal} from './ui';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Client-side check shared with the answer-image area: image type and ≤ 2 MB (BE re-checks by magic bytes). */
export function imageProblem(file: {type: string; size: number}): string | null {
    if (!file.type.startsWith('image/')) return 'Chỉ nhận file ảnh (JPG hoặc PNG).';
    if (file.size > MAX_IMAGE_BYTES) return 'Ảnh vượt 2 MB, chưa tải lên được.';
    return null;
}

/**
 * "Chèn ảnh" (teacher editor, DS-Editor #4): uploads through `image/upload` (SPT-69) and hands back a RELATIVE
 * path ("/api/image/view/<id>") — never base64 in the question, never an absolute domain in the DB.
 */
export default function ImageDialog({open, onClose, onInsert}: {open: boolean; onClose: () => void; onInsert: (src: string) => void}) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const pick = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const bad = imageProblem(file);
        if (bad) return setErr(bad);
        setBusy(true); setErr(null);
        try {
            const r = await Api.upload<{path: string}>('image/upload', file);
            onInsert('/api/' + r.path);
            onClose();
        } catch (ex) {
            setErr(errorText(ex, 'Không tải ảnh lên được. Thử lại sau.'));
        } finally {
            setBusy(false);
        }
    };

    return <Modal open={open} onClose={busy ? undefined : () => { setErr(null); onClose(); }} title='Chèn ảnh'
                  footer={<Button onClick={onClose} disabled={busy}>Huỷ</Button>}>
        <input ref={input} type='file' accept='image/png,image/jpeg' hidden onChange={pick}/>
        <div className='tt-math'>
            <Button variant='primary' loading={busy} loadingText='Đang tải lên…' onClick={() => input.current?.click()}>Tải ảnh lên</Button>
            <span className='vt-muted'>JPG hoặc PNG, tối đa 2 MB. Cũng có thể dán ảnh từ Word.</span>
            {err && <p role='alert' className='vt-field-error'>{err}</p>}
        </div>
    </Modal>;
}
