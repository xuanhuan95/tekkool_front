import {beforeEach, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import Api from '../../services/api';
import CreateFromBank from './CreateFromBank';

const BANKS = [
    {id: 'b1', name: 'Văn A', subject: 'Ngữ văn', blocks: 6},
    {id: 'b2', name: 'Toán A', subject: 'Toán', blocks: 4},
];

function mock(capacity = 3, per_type: Record<string, number> = {DocHieu: 3, VietDoan: 2, VietBai: 1}) {
    vi.spyOn(Api, 'get').mockResolvedValue(BANKS);
    return vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
        if (url === 'question_bank/capacity') return {capacity, per_type, slots: {}, bottleneck: null};
        return {id: 'E1'};
    });
}

const renderPage = () => render(
    <MemoryRouter initialEntries={['/create-from-bank?bank=b1']}>
        <Routes>
            <Route path='/create-from-bank' element={<CreateFromBank/>}/>
            <Route path='/' element={<div>TRANG CHỦ</div>}/>
        </Routes>
    </MemoryRouter>
);

const addSlot = (name: string) => fireEvent.click(screen.getByLabelText('Thêm ' + name));

beforeEach(() => vi.restoreAllMocks());

it('saves parts and titles in order; an empty slot gets the suggested title by position', async () => {
    const post = mock();
    renderPage();
    await screen.findByText('có 2 khối');

    addSlot('Đọc hiểu (ngữ liệu + 5 câu)');
    addSlot('Viết đoạn văn');
    addSlot('Viết bài văn');
    fireEvent.change(screen.getByLabelText('Tiêu đề phần 2'), {target: {value: 'Viết đoạn nghị luận'}});
    // Move Viết bài above Viết đoạn: a named part keeps its name, an empty one is renumbered.
    fireEvent.click(screen.getAllByLabelText('Lên')[2]);
    fireEvent.change(screen.getByPlaceholderText(/Đề luyện thi/), {target: {value: ' Đề thử '}});
    fireEvent.click(screen.getByText('Lưu đề'));

    await screen.findByText('TRANG CHỦ');
    const call = post.mock.calls.find(c => c[0] === 'exam/create_from_bank');
    expect(call && call[1]).toEqual({
        banks: ['b1'], name: 'Đề thử', duration: 90, folder: undefined,
        cau_truc: [
            {loai: 'DocHieu', tieu_de: 'Phần I. Đọc hiểu (ngữ liệu + 5 câu)'},
            {loai: 'VietBai', tieu_de: 'Phần II. Viết bài văn'},
            {loai: 'VietDoan', tieu_de: 'Viết đoạn nghị luận'},
        ],
    });
});

it('dropping a block type onto a card inserts it before that card', async () => {
    mock();
    renderPage();
    await screen.findByText('có 2 khối');
    addSlot('Đọc hiểu (ngữ liệu + 5 câu)');

    const source = screen.getByLabelText('Thêm Viết bài văn').closest('[draggable]')!;
    fireEvent.dragStart(source);
    const target = screen.getByLabelText('Tiêu đề phần 1').closest('li')!;
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    expect(screen.getByLabelText('Tiêu đề phần 1')).toHaveProperty('placeholder', 'Phần I. Viết bài văn');
    expect(screen.getByLabelText('Tiêu đề phần 2')).toHaveProperty('placeholder', 'Phần II. Đọc hiểu (ngữ liệu + 5 câu)');
});

it('when stock is short it says what is missing and disables the Save button', async () => {
    mock(0, {VietBai: 1});
    renderPage();
    await screen.findByText('có 1 khối');
    addSlot('Viết bài văn');
    addSlot('Viết bài văn');

    await screen.findByText(/Thiếu khối: Viết bài văn \(cần 2, có 1\)/);
    await waitFor(() => expect(screen.getByText('Lưu đề').closest('button')).toHaveProperty('disabled', true));
});
