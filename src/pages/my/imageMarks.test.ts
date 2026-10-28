import {describe, expect, it} from 'vitest';

import {
    clusterMarks, displayToImage, imageToDisplay, markProblem, marksOf, MAX_MARKS_PER_IMAGE, MAX_NOTE_LENGTH, nextRotation, tempId, toPayload,
} from './imageMarks';
import type {Mark, Rotation, ServerMark} from './imageMarks';

const ROTS: Rotation[] = [0, 90, 180, 270];

describe('rotation maths (SPT-84: mark = % of the ORIGINAL photo, rotation is view only)', () => {
    it('a point turns clockwise with the photo: top-left of the original shows top-right after 90°', () => {
        expect(imageToDisplay(0, 0, 90)).toEqual({x: 100, y: 0});
        expect(imageToDisplay(20, 70, 90)).toEqual({x: 30, y: 20});
        expect(imageToDisplay(20, 70, 180)).toEqual({x: 80, y: 30});
        expect(imageToDisplay(20, 70, 270)).toEqual({x: 70, y: 80});
        expect(imageToDisplay(20, 70, 0)).toEqual({x: 20, y: 70});
    });

    it('a tap on the rotated view is stored in original-photo coordinates', () => {
        // tap 20% from the left, 60% from the top of the view rotated 90°
        expect(displayToImage(20, 60, 90)).toEqual({x: 60, y: 80});
        expect(displayToImage(20, 60, 270)).toEqual({x: 40, y: 20});
        expect(displayToImage(20, 60, 180)).toEqual({x: 80, y: 40});
    });

    it('display → image → display is the identity for every rotation', () => {
        for (const r of ROTS) {
            const img = displayToImage(13, 87, r);
            expect(imageToDisplay(img.x, img.y, r)).toEqual({x: 13, y: 87});
        }
    });

    it('nextRotation cycles 0 → 90 → 180 → 270 → 0', () => {
        expect(ROTS.map(nextRotation)).toEqual([90, 180, 270, 0]);
    });
});

describe('toPayload (body part `marks` of exam/grade)', () => {
    it('keeps only touched images, real ids, and drops temp ids / extra text / server-only fields', () => {
        const edited: Record<string, Mark[]> = {
            img1: [
                {id: 'm1', type: 'check', x: 10.126, y: 20, text: 'bỏ'},
                {id: tempId(), type: 'cross', x: 30, y: 40},
                {id: tempId(), type: 'text', x: 50, y: 60, text: '  Sai dấu ở dòng 3  '},
            ],
            img2: [],
        };
        expect(toPayload(edited)).toEqual({
            img1: [
                {id: 'm1', type: 'check', x: 10.13, y: 20},
                {type: 'cross', x: 30, y: 40},
                {type: 'text', x: 50, y: 60, text: 'Sai dấu ở dòng 3'},
            ],
            img2: [], // [] = delete every mark of this image
        });
        expect(Object.keys(toPayload({}))).toEqual([]);
    });

    it('clamps coordinates into 0–100', () => {
        expect(toPayload({a: [{id: 'x', type: 'check', x: -3, y: 140}]}).a).toEqual([{id: 'x', type: 'check', x: 0, y: 100}]);
    });
});

describe('marksOf / markProblem / clusterMarks', () => {
    const server: ServerMark[] = [
        {id: 'a', image_id: 'i1', type: 'check', x: 1, y: 2, created_by: 'u', created_at: 't'},
        {id: 'b', image_id: 'i2', type: 'text', x: 3, y: 4, text: 'Thiếu đơn vị'},
    ];
    it('picks one image and drops server-only fields', () => {
        expect(marksOf(server, 'i1')).toEqual([{id: 'a', type: 'check', x: 1, y: 2}]);
        expect(marksOf(server, 'i2')).toEqual([{id: 'b', type: 'text', x: 3, y: 4, text: 'Thiếu đơn vị'}]);
        expect(marksOf(undefined, 'i1')).toEqual([]);
    });

    it('refuses what the BE would 400: empty note, note > 500, > 200 marks', () => {
        expect(markProblem([{type: 'text', x: 1, y: 1, text: '   '}])).toMatch(/Ghi chú trống/);
        expect(markProblem([{type: 'text', x: 1, y: 1, text: 'a'.repeat(MAX_NOTE_LENGTH + 1)}])).toMatch(/500/);
        expect(markProblem(Array.from({length: MAX_MARKS_PER_IMAGE + 1}, () => ({type: 'check' as const, x: 1, y: 1})))).toMatch(/200/);
        expect(markProblem([{type: 'check', x: 1, y: 1}, {type: 'text', x: 2, y: 2, text: 'ok'}])).toBeNull();
    });

    it('groups close marks into one numbered dot, leaves far ones alone', () => {
        const g = clusterMarks([{x: 10, y: 10}, {x: 12, y: 13}, {x: 11, y: 9}, {x: 70, y: 70}]);
        expect(g.map(x => x.length)).toEqual([3, 1]);
    });
});
