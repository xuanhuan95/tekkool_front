import {beforeEach, describe, expect, it, vi} from 'vitest';

import Api from '../../services/api';
import {uploadImages} from './imageUpload';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQ';
const exam = {id: 'E1', sections: [{questions: [
    {data: {question: `<p>a<img src="${PNG}"></p>`, answers: [{value: `<img src="${JPG}">`}], explanation: `<img src="${PNG}">`}},
]}]};

describe('uploadImages', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('uploads each distinct image once, in order, and rewrites src to a relative path', async () => {
        const up = vi.spyOn(Api, 'upload').mockImplementation(async (_u, f) => ({path: 'image/view/' + (f as Blob).type.slice(6)}));
        const out = await uploadImages(exam, new Map());

        expect(up).toHaveBeenCalledTimes(2);
        expect(up.mock.calls[0][0]).toBe('image/upload');
        const s = JSON.stringify(out);
        expect(s).not.toContain('data:image');
        expect(s).toContain('src=\\"/api/image/view/png\\"');
        expect(s).toContain('src=\\"/api/image/view/jpeg\\"');
        expect(s).not.toContain('http');
    });

    it('no images: nothing uploaded, same content', async () => {
        const up = vi.spyOn(Api, 'upload');
        expect(await uploadImages({a: '<p>x</p>'}, new Map())).toEqual({a: '<p>x</p>'});
        expect(up).not.toHaveBeenCalled();
    });

    it('network failure mid-way throws; retry only uploads what is missing', async () => {
        const cache = new Map();
        const up = vi.spyOn(Api, 'upload')
            .mockResolvedValueOnce({path: 'image/view/a'})
            .mockRejectedValueOnce(new TypeError('fetch'));
        await expect(uploadImages(exam, cache)).rejects.toBeInstanceOf(TypeError);
        expect(cache.size).toBe(1);

        up.mockResolvedValueOnce({path: 'image/view/b'});
        const out = await uploadImages(exam, cache);
        expect(up).toHaveBeenCalledTimes(3);
        expect(JSON.stringify(out)).not.toContain('data:image');
    });
});
