/**
 * Marks on a handwriting photo (SPT-84). Pure logic, no DOM: coordinates, payload, grouping.
 *
 * Stored position is x/y in % of the ORIGINAL (unrotated) image — rotation is only a viewing aid.
 */

export type MarkType = 'check' | 'cross' | 'text';

/** What the grader edits and what we send to `exam/grade`. A mark without `id` is new. */
export type Mark = {id?: string; type: MarkType; x: number; y: number; text?: string};

/** What `answers[].marks` returns (extra fields are ignored when sending back). */
export type ServerMark = Mark & {image_id: string; created_by?: string; created_at?: string};

export type Rotation = 0 | 90 | 180 | 270;

/** BE caps (docs/api.md): 200 marks per image, 500 characters per note. */
export const MAX_MARKS_PER_IMAGE = 200;
export const MAX_NOTE_LENGTH = 500;

/** Marks closer than this (in % of the image) merge into one numbered dot on a phone. */
export const CLUSTER_GAP = 5;

const TEMP_PREFIX = 'new-';
let tempSeq = 0;
/** Local key for a mark the server has not seen; stripped by `toPayload`. */
export const tempId = () => TEMP_PREFIX + (++tempSeq);

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rotation (clockwise degrees) after one more quarter turn. */
export const nextRotation = (r: Rotation): Rotation => ((r + 90) % 360) as Rotation;

/** Image position (0–100 each) → position in the box as displayed after `rot` clockwise degrees. */
export function imageToDisplay(x: number, y: number, rot: Rotation): {x: number; y: number} {
    switch (rot) {
        case 90: return {x: 100 - y, y: x};
        case 180: return {x: 100 - x, y: 100 - y};
        case 270: return {x: y, y: 100 - x};
        default: return {x, y};
    }
}

/** Inverse of `imageToDisplay`: a tap at (x, y) % of the displayed box → position on the original image. */
export function displayToImage(x: number, y: number, rot: Rotation): {x: number; y: number} {
    switch (rot) {
        case 90: return {x: y, y: 100 - x};
        case 180: return {x: 100 - x, y: 100 - y};
        case 270: return {x: 100 - y, y: x};
        default: return {x, y};
    }
}

/** Marks of one image from the flat `answers[].marks` list. */
export const marksOf = (all: ServerMark[] | undefined, imageId: string): Mark[] =>
    (all || []).filter(m => m.image_id === imageId)
        .map(m => ({id: m.id, type: m.type, x: m.x, y: m.y, ...(m.type === 'text' ? {text: m.text || ''} : {})}));

/**
 * Body part `marks` of `exam/grade`: `{image_id: [{id?, type, x, y, text?}]}`. Only images the grader touched are in
 * `edited` (the BE replaces the whole list of every image we send, and leaves the others alone).
 * Temp ids are dropped (new mark), ✓/✗ carry no text, notes are trimmed, coordinates kept within 0–100.
 */
export function toPayload(edited: Record<string, Mark[]>): Record<string, Array<Record<string, unknown>>> {
    const out: Record<string, Array<Record<string, unknown>>> = {};
    for (const [imageId, list] of Object.entries(edited)) {
        out[imageId] = list.map(m => ({
            ...(m.id && !m.id.startsWith(TEMP_PREFIX) ? {id: m.id} : {}),
            type: m.type,
            x: round2(clamp(m.x)),
            y: round2(clamp(m.y)),
            ...(m.type === 'text' ? {text: (m.text || '').trim()} : {}),
        }));
    }
    return out;
}

/** Why this mark cannot be sent, or null. Checked before saving so the grader sees it next to the image. */
export function markProblem(list: Mark[]): string | null {
    if (list.length > MAX_MARKS_PER_IMAGE) return `Mỗi ảnh tối đa ${MAX_MARKS_PER_IMAGE} dấu.`;
    if (list.some(m => m.type === 'text' && !(m.text || '').trim())) return 'Ghi chú trống, hãy nhập chữ hoặc xoá dấu.';
    if (list.some(m => m.type === 'text' && (m.text || '').length > MAX_NOTE_LENGTH)) return `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.`;
    return null;
}

/** Marks sitting within `gap` % of each other (both axes) become one group; groups of 1 are plain marks. */
export function clusterMarks<T extends {x: number; y: number}>(list: T[], gap = CLUSTER_GAP): T[][] {
    const groups: T[][] = [];
    for (const m of list) {
        const g = groups.find(grp => grp.some(o => Math.abs(o.x - m.x) < gap && Math.abs(o.y - m.y) < gap));
        if (g) g.push(m); else groups.push([m]);
    }
    return groups;
}

export const MARK_NAME: Record<MarkType, string> = {check: 'Dấu đúng', cross: 'Dấu sai', text: 'Ghi chữ'};
