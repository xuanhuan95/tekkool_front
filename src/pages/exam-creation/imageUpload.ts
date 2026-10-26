import Api from '../../services/api';

const DATA_IMAGE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

/** data URI → path on the server ("/api/image/view/<id>"), shared by retries and by the 3 save buttons. */
export type ImageCache = Map<string, string>;

function toBlob(uri: string): Blob {
    const [head, b64] = uri.split(',');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type: head.slice(5, head.indexOf(';'))});
}

/**
 * Upload every embedded base64 image of `value` (question, answers, passage, explanation — anywhere in the JSON),
 * one at a time, and return a copy whose `src` is a RELATIVE path (never an absolute domain in the DB).
 * Identical images upload once. A failed upload throws; calling again resumes (the cache keeps finished ones,
 * and the server answers 200 with the old id for a repeated image).
 * ponytail: runs over the JSON text — every field is covered without knowing the exam shape. `/` is not escaped by JSON.stringify.
 */
export async function uploadImages<T>(value: T, cache: ImageCache): Promise<T> {
    const json = JSON.stringify(value);
    for (const uri of new Set(json.match(DATA_IMAGE) || [])) {
        if (cache.has(uri)) continue;
        const r = await Api.upload<{path: string}>('image/upload', toBlob(uri));
        cache.set(uri, '/api/' + r.path);
    }
    return JSON.parse(json.replace(DATA_IMAGE, uri => cache.get(uri) as string));
}
