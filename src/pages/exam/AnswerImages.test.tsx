import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import Api from '../../services/api';
import AnswerImages, {AnswerImageThumbs, answerImageUrl} from './AnswerImages';

const file = (size = 1000, type = 'image/jpeg') => new File([new Uint8Array(size)], 'bai.jpg', {type});
const pick = (input: Element, f: File) => fireEvent.change(input, {target: {files: [f]}});
// jsdom has no matchMedia → phone layout (Chụp ảnh + Chọn từ thư viện)
const inputs = (c: HTMLElement) => c.querySelectorAll('input[type=file]');

describe('AnswerImages (HS-LamBai-TuLuan, SPT-83)', () => {
    beforeEach(() => { vi.restoreAllMocks(); window.token = 'tok'; });

    it('shows n/3 and thumbnails that carry the session token (private images)', () => {
        render(<AnswerImages questionId='q1' initial={['a', 'b']} disabled={false}/>);
        expect(screen.getByText('2/3')).toBeInTheDocument();
        expect(screen.getByAltText('Ảnh bài làm 1').getAttribute('src')).toBe(answerImageUrl('a'));
        expect(answerImageUrl('a')).toMatch(/answer_image\/view\/a\?token=tok$/);
    });

    it('uploads ONE image per call to answer_image/upload/<question>, then shows the list the server returns', async () => {
        const up = vi.spyOn(Api, 'upload').mockResolvedValue({id: 'c', images: ['a', 'c']});
        const {container} = render(<AnswerImages questionId='q1' initial={['a']} disabled={false}/>);
        pick(inputs(container)[1], file());
        await waitFor(() => expect(screen.getByText('2/3')).toBeInTheDocument());
        expect(up).toHaveBeenCalledWith('answer_image/upload/q1', expect.any(File));
    });

    it('3/3: both buttons are locked', () => {
        render(<AnswerImages questionId='q1' initial={['a', 'b', 'c']} disabled={false}/>);
        expect(screen.getByRole('button', {name: /Chụp ảnh/})).toBeDisabled();
        expect(screen.getByRole('button', {name: /Chọn từ thư viện/})).toBeDisabled();
    });

    it('over 2 MB is refused before any request; a server 413 shows the Vietnamese message from `error`', async () => {
        const up = vi.spyOn(Api, 'upload').mockRejectedValue({code: 413, error: 'Ảnh quá lớn (tối đa 2 MB)'});
        const {container} = render(<AnswerImages questionId='q1' initial={[]} disabled={false}/>);
        pick(inputs(container)[1], file(3 * 1024 * 1024));
        expect(await screen.findByText('Ảnh vượt 2 MB, chưa tải lên được.')).toBeInTheDocument();
        expect(up).not.toHaveBeenCalled();
        pick(inputs(container)[1], file());
        expect(await screen.findByText('Ảnh quá lớn (tối đa 2 MB)')).toBeInTheDocument();
    });

    it('× removes through answer_image/remove; read-only (time up) has no buttons and no ×', async () => {
        const post = vi.spyOn(Api, 'post').mockResolvedValue({images: ['b']});
        const {rerender} = render(<AnswerImages questionId='q1' initial={['a', 'b']} disabled={false}/>);
        fireEvent.click(screen.getByRole('button', {name: 'Xoá ảnh 1'}));
        await waitFor(() => expect(screen.getByText('1/3')).toBeInTheDocument());
        expect(post).toHaveBeenCalledWith('answer_image/remove/q1', {id: 'a'});
        rerender(<AnswerImages questionId='q1' initial={['b']} disabled/>);
        expect(screen.queryByRole('button', {name: /Xoá ảnh/})).toBeNull();
        expect(screen.queryByRole('button', {name: /Chụp ảnh/})).toBeNull();
    });

    it('review (SPT-84): teacher notes are listed per photo as plain text; opening a photo gives the viewer without edit tools', () => {
        const marks = [{id: 'n1', image_id: 'b', type: 'text' as const, x: 5, y: 5, text: 'Thiếu <i>đơn vị</i>'},
                       {id: 'c1', image_id: 'a', type: 'check' as const, x: 5, y: 5}];
        render(<AnswerImageThumbs ids={['a', 'b']} marks={marks}/>);
        expect(screen.getByText('Ghi chú của giáo viên trên ảnh')).toBeInTheDocument();
        const line = screen.getByText('Ảnh 2').closest('li')!;
        expect(line).toHaveTextContent('Ảnh 2 · Thiếu <i>đơn vị</i>');
        expect(line.querySelector('i')).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'Xem ảnh 2'}));
        expect(screen.getByRole('button', {name: 'Xoay ảnh'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Đặt dấu/})).toBeNull();
        expect(screen.getByText('Ảnh 2 / 2')).toBeInTheDocument();
    });
});
