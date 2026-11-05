import {describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import {useRef} from 'react';
import {imageProblem} from './ImageDialog';
import {toCe} from './MathDialog';
import {textLength} from './textLength';
import {useImageUploads} from './useImageUploads';
import {useUploadStore} from '../stores/uploadStore';
import Api from '../services/api';

describe('toCe: Chemistry tab wraps \\ce{}', () => {
    it('wraps plain text', () => expect(toCe(' H2O ')).toBe('\\ce{H2O}'));
    it('wraps an arrow', () => expect(toCe('2H2 + O2 <=> 2H2O')).toBe('\\ce{2H2 + O2 <=> 2H2O}'));
    it('does not wrap twice', () => expect(toCe('\\ce{H2O}')).toBe('\\ce{H2O}'));
});

describe('imageProblem', () => {
    it('blocks > 2 MB', () => expect(imageProblem({type: 'image/png', size: 2 * 1048576 + 1})).toBeTruthy());
    it('blocks wrong format', () => expect(imageProblem({type: 'image/gif', size: 1000})).toBeTruthy());
    it('accepts jpeg and png ≤ 2 MB', () => {
        expect(imageProblem({type: 'image/jpeg', size: 1000})).toBeNull();
        expect(imageProblem({type: 'image/png', size: 2 * 1048576})).toBeNull();
    });
});

describe('textLength', () => it('counts visible text only', () => expect(textLength('<p>ab<b>c</b></p><img src="x">')).toBe(3)));

function Probe({files}: {files: File[]}) {
    const ref = useRef(null);
    const {add, view} = useImageUploads(ref, true, () => {});
    return <div><button onClick={() => add(files)}>go</button>{view}</div>;
}

describe('useImageUploads', () => {
    it('refuses a > 2 MB image before uploading and never locks Save', async () => {
        const up = vi.spyOn(Api, 'upload');
        const big = new File([new Uint8Array(2 * 1048576 + 1)], 'big.png', {type: 'image/png'});
        render(<Probe files={[big]}/>);
        await act(async () => { screen.getByText('go').click(); });
        expect(up).not.toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toMatch(/big\.png/);
        expect(useUploadStore.getState().pending).toBe(0);
    });

    it('locks Save while uploading and releases it on failure', async () => {
        let reject!: (e: unknown) => void;
        vi.spyOn(Api, 'upload').mockReturnValue(new Promise((_, r) => { reject = r; }) as never);
        render(<Probe files={[new File(['x'], 'a.png', {type: 'image/png'})]}/>);
        await act(async () => { screen.getByText('go').click(); });
        expect(useUploadStore.getState().pending).toBe(1);
        await act(async () => { reject(new Error('boom')); });
        expect(useUploadStore.getState().pending).toBe(0);
        expect(screen.getByText('Thử lại')).toBeTruthy();
    });
});
