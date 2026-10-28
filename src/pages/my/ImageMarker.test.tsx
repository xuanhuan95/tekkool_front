import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';

import ImageMarker from './ImageMarker';
import type {Mark} from './imageMarks';

// jsdom has no layout: give the stage a 400×200 box at (100, 50) so a click maps to a known %.
const box = () => {
    const stage = document.querySelector('.mk-stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON() {}});
    return stage;
};
const loadImage = () => fireEvent.load(document.querySelector('.mk-stage img') as HTMLImageElement);
const clickAt = (stage: HTMLElement, fx: number, fy: number) =>
    fireEvent.click(stage, {clientX: 100 + 400 * fx, clientY: 50 + 200 * fy});

/** Holds the marks like SubmissionDetail does, so edits round-trip through `onChange`. */
function Harness({initial = [], spy}: {initial?: Mark[]; spy?: (id: string, list: Mark[]) => void}) {
    const [list, setList] = useState<Mark[]>(initial);
    return <ImageMarker ids={['p1', 'p2']} marks={{p1: list, p2: []}}
                        onChange={(id, l) => { spy?.(id, l); setList(l); }}/>;
}

describe('ImageMarker — teacher (SPT-84)', () => {
    beforeEach(() => { window.token = 'tok'; });
    afterEach(cleanup);

    it('holding ✓ and tapping the photo places a mark at the tapped % (no id → new)', () => {
        const spy = vi.fn();
        render(<Harness spy={spy}/>);
        const stage = box(); loadImage();
        fireEvent.click(screen.getByRole('button', {name: 'Đặt dấu đúng (✓)'}));
        clickAt(stage, 0.25, 0.5);
        expect(spy).toHaveBeenCalledTimes(1);
        const [imageId, list] = spy.mock.calls[0];
        expect(imageId).toBe('p1');
        expect(list).toEqual([expect.objectContaining({type: 'check', x: 25, y: 50})]);
        expect(screen.getByRole('button', {name: 'Dấu đúng 1'})).toBeInTheDocument();
    });

    it('without a tool, tapping the photo places nothing; tools are locked until the photo has loaded', () => {
        const spy = vi.fn();
        render(<Harness spy={spy}/>);
        const stage = box();
        expect(screen.getByRole('button', {name: 'Đặt dấu sai (✗)'})).toBeDisabled();
        expect(screen.getByRole('status', {name: 'Đang tải ảnh'})).toBeInTheDocument();
        loadImage();
        clickAt(stage, 0.5, 0.5);
        expect(spy).not.toHaveBeenCalled();
    });

    it('after rotating 90° a tap is converted back to the ORIGINAL photo coordinates', () => {
        const spy = vi.fn();
        render(<Harness spy={spy}/>);
        const stage = box(); loadImage();
        fireEvent.click(screen.getByRole('button', {name: 'Xoay ảnh'}));
        fireEvent.click(screen.getByRole('button', {name: 'Đặt dấu sai (✗)'}));
        clickAt(stage, 0.2, 0.6); // 20% from left, 60% from top of the rotated view
        expect(spy.mock.calls[0][1][0]).toEqual(expect.objectContaining({type: 'cross', x: 60, y: 80}));
    });

    it('a note: the text dialog adds it (empty is refused), a tap on it edits, ✕ in the list deletes', () => {
        const spy = vi.fn();
        render(<Harness spy={spy}/>);
        const stage = box(); loadImage();
        fireEvent.click(screen.getByRole('button', {name: 'Ghi chữ ngắn'}));
        clickAt(stage, 0.5, 0.5);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('button', {name: 'Xong'})).toBeDisabled();
        fireEvent.change(within(dialog).getByRole('textbox'), {target: {value: ' Sai dấu ở dòng 3 '}});
        fireEvent.click(within(dialog).getByRole('button', {name: 'Xong'}));
        expect(spy.mock.calls[0][1][0]).toEqual(expect.objectContaining({type: 'text', text: 'Sai dấu ở dòng 3'}));

        // edit it
        fireEvent.click(screen.getAllByRole('button', {name: /Ghi chữ 1: Sai dấu ở dòng 3/})[0]);
        fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Thiếu đơn vị'}});
        fireEvent.click(screen.getByRole('button', {name: 'Xong'}));
        expect(spy.mock.calls[1][1]).toHaveLength(1);
        expect(spy.mock.calls[1][1][0].text).toBe('Thiếu đơn vị');
        expect(spy.mock.calls[1][1][0].id).toBe(spy.mock.calls[0][1][0].id);

        // delete from the list (on a phone it lives in the "Điểm & nhận xét" sheet)
        fireEvent.click(screen.getByRole('button', {name: /Điểm & nhận xét/}));
        fireEvent.click(screen.getByRole('button', {name: 'Xoá ghi chữ 1'}));
        expect(spy.mock.calls[2][1]).toEqual([]);
    });

    it('tapping a ✓ offers "đổi thành dấu sai" and delete', () => {
        const spy = vi.fn();
        render(<Harness initial={[{id: 'm1', type: 'check', x: 10, y: 10}]} spy={spy}/>);
        loadImage();
        fireEvent.click(screen.getByRole('button', {name: /^Dấu đúng 1$/, hidden: false}));
        fireEvent.click(screen.getByRole('button', {name: /Đổi thành dấu sai/}));
        expect(spy.mock.calls[0][1]).toEqual([{id: 'm1', type: 'cross', x: 10, y: 10}]);
    });

    it('close marks collapse into a numbered dot on a phone; tapping it lists them', () => {
        render(<Harness initial={[{id: 'a', type: 'check', x: 10, y: 10}, {id: 'b', type: 'cross', x: 12, y: 11}, {id: 'c', type: 'text', x: 11, y: 12, text: 'Thiếu đơn vị'}]}/>);
        loadImage();
        const dot = screen.getByRole('button', {name: '3 dấu ở vị trí này'});
        expect(dot).toHaveTextContent('3');
        fireEvent.click(dot);
        const sheet = screen.getByRole('dialog', {name: '3 dấu ở vị trí này'});
        expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
    });

    it('a photo that fails shows "Thử lại" (and the note that grading still works); retry reloads it', () => {
        render(<Harness/>);
        const img = document.querySelector('.mk-stage img') as HTMLImageElement;
        fireEvent.error(img);
        expect(screen.getByRole('alert')).toHaveTextContent('Không tải được ảnh');
        expect(screen.getByRole('alert')).toHaveTextContent('Điểm và nhận xét vẫn chấm được');
        expect(screen.getByRole('button', {name: 'Đặt dấu đúng (✓)'})).toBeDisabled();
        fireEvent.click(screen.getByRole('button', {name: 'Thử lại'}));
        expect((document.querySelector('.mk-stage img') as HTMLImageElement).src).toContain('retry=1');
        expect(screen.getByRole('status', {name: 'Đang tải ảnh'})).toBeInTheDocument();
    });

    it('next/previous photo shows that photo\'s own marks', async () => {
        render(<Harness initial={[{id: 'a', type: 'check', x: 10, y: 10}]}/>);
        loadImage();
        expect(screen.getByRole('button', {name: 'Dấu đúng 1'})).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Ảnh sau'}));
        expect(screen.getByText('Ảnh 2 / 2')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('button', {name: 'Dấu đúng 1'})).toBeNull());
    });
});

describe('ImageMarker — computer layout', () => {
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it('score form and mark list sit beside the photo; close marks are NOT merged', () => {
        vi.stubGlobal('matchMedia', (q: string) => ({matches: true, media: q, addEventListener() {}, removeEventListener() {}}));
        render(<ImageMarker ids={['p1']} onChange={() => {}} side={<label>Điểm câu <input/></label>}
                            marks={{p1: [{id: 'a', type: 'check', x: 10, y: 10}, {id: 'b', type: 'cross', x: 12, y: 11}]}}/>);
        loadImage();
        expect(screen.getByLabelText('Điểm câu')).toBeInTheDocument();
        const list = screen.getByRole('region', {name: 'Dấu trên ảnh'});
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
        expect(screen.queryByRole('button', {name: /dấu ở vị trí này/})).toBeNull();
        expect(screen.queryByRole('button', {name: /Điểm & nhận xét/})).toBeNull();
    });
});

describe('ImageMarker — student (read only)', () => {
    afterEach(cleanup);
    const marks = {p1: [{id: 'a', type: 'check' as const, x: 10, y: 10}, {id: 'b', type: 'text' as const, x: 60, y: 60, text: '<b>Sai dấu</b> ở dòng 3'}]};

    it('has no placing tools and no mark list; zoom / rotate stay', () => {
        render(<ImageMarker ids={['p1']} marks={marks}/>);
        loadImage();
        expect(screen.queryByRole('button', {name: /Đặt dấu/})).toBeNull();
        expect(screen.queryByRole('button', {name: 'Ghi chữ ngắn'})).toBeNull();
        expect(screen.queryByRole('region', {name: 'Dấu trên ảnh'})).toBeNull();
        expect(screen.getByRole('button', {name: 'Phóng to'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Xoay ảnh'})).toBeEnabled();
    });

    it('tapping a note shows the teacher\'s words as plain text (HTML is not rendered); tapping ✓ opens no editor', () => {
        const {container} = render(<ImageMarker ids={['p1']} marks={marks}/>);
        loadImage();
        fireEvent.click(screen.getByRole('button', {name: /^Dấu đúng 1$/}));
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: /Ghi chữ 2/}));
        expect(screen.getByText(/Giáo viên:/).parentElement).toHaveTextContent('“<b>Sai dấu</b> ở dòng 3”');
        expect(container.querySelector('.mk-notebar b b, .mk-chip b')).toBeNull();
    });
});
