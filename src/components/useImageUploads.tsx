import {useEffect, useRef, useState} from 'react';
import type {RefObject} from 'react';
import type {Editor as TiptapEditor} from '@tiptap/react';

import Api from '../services/api';
import {errorText} from '../lib/format';
import {addPending} from '../stores/uploadStore';
import {imageProblem} from './ImageDialog';

type Upload = {id: number; name: string; size: number; status: 'busy' | 'error'; msg?: string; retry: boolean};

const mb = (n: number) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';

/** Image files of a paste / drop (any image type: the wrong ones are refused with a message, not silently pasted as broken tags). */
export const imageFiles = (list?: FileList | null) => Array.from(list || []).filter(f => f.type.startsWith('image/'));

/**
 * Paste / drop an image into the editor (DS-Editor-Anh): checked first (JPG/PNG ≤ 2 MB), uploaded at once through
 * `image/upload`, inserted as "/api/image/view/<id>" when done. While any upload runs, `useUploadStore.pending`
 * is > 0 so the Save buttons wait (the BE drops `data:` images). Cancel = the result is ignored.
 */
export function useImageUploads(editorRef: RefObject<TiptapEditor | null>, allowed: boolean, onPickOther: () => void) {
    const [list, setList] = useState<Upload[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const seq = useRef(0);
    const files = useRef(new Map<number, File>());
    const patch = (id: number, p: Partial<Upload>) => setList(l => l.map(u => u.id === id ? {...u, ...p} : u));
    const drop = (id: number) => { files.current.delete(id); setList(l => l.filter(u => u.id !== id)); };

    const busy = list.filter(u => u.status === 'busy').length;
    const reported = useRef(0);
    useEffect(() => { addPending(busy - reported.current); reported.current = busy; }, [busy]);
    useEffect(() => () => addPending(-reported.current), []);

    const run = async (id: number, file: File) => {
        patch(id, {status: 'busy', msg: undefined});
        try {
            const r = await Api.upload<{path: string}>('image/upload', file);
            if (!files.current.has(id)) return;   // cancelled meanwhile
            const ed = editorRef.current;
            if (ed && !ed.isDestroyed) ed.chain().focus().insertContent({type: 'image', attrs: {src: '/api/' + r.path}}).run();
            drop(id);
        } catch (e) {
            if (files.current.has(id)) patch(id, {status: 'error', retry: true,
                msg: errorText(e, 'Tải ảnh lên chưa được. Mạng yếu hoặc máy chủ bận. Ảnh chưa mất, bấm Thử lại.')});
        }
    };

    /** Returns true when it took the files (the caller then stops the browser's own paste / drop). */
    const add = (fs: File[]) => {
        if (!fs.length) return false;
        if (!allowed) { setNotice('Ô này không chèn được ảnh. Ảnh bài làm: dùng nút “Ảnh bài làm” (chụp hoặc tải lên) bên dưới.'); return true; }
        setNotice(null);
        for (const f of fs) {
            const id = ++seq.current;
            const bad = imageProblem(f);
            setList(l => [...l, {id, name: f.name || 'ảnh dán', size: f.size, status: bad ? 'error' : 'busy', msg: bad ?? undefined, retry: false}]);
            if (!bad) { files.current.set(id, f); run(id, f); }
        }
        return true;
    };

    const view = <>
        {notice && <div role='alert' className='tt-up err'>{notice}
            <button type='button' onClick={() => setNotice(null)}>Đóng</button></div>}
        {list.map(u => u.status === 'busy'
            ? <div key={u.id} role='status' className='tt-up'>Đang tải ảnh… {u.name} · {mb(u.size)}
                <button type='button' onClick={() => drop(u.id)}>Huỷ tải</button></div>
            : <div key={u.id} role='alert' className='tt-up err'>
                {u.retry ? u.msg : `Ảnh “${u.name}” (${mb(u.size)}): ${u.msg}`}
                {u.retry && <button type='button' onClick={() => run(u.id, files.current.get(u.id)!)}>Thử lại</button>}
                {!u.retry && <button type='button' onClick={() => { drop(u.id); onPickOther(); }}>Chọn ảnh khác</button>}
                <button type='button' onClick={() => drop(u.id)}>Bỏ</button></div>)}
    </>;

    return {add, view};
}
