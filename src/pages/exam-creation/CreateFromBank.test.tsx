import {beforeEach, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Api from '../../services/api';
import CreateFromBank, {suggestedMinutes} from './CreateFromBank';

const BANKS = [
    {id: 'b1', name: 'Văn A', subject: 'Ngữ văn', blocks: 6},
    {id: 'p1', name: 'SPT Hoá', subject: 'Hoá học', kind: 'paper', items: 6, blocks: 0},
];
// Sample exam "Văn 2027": Phần I = 2 Đọc hiểu (lead has numbers), Phần II restarts at câu 1.
const TEMPLATES = [{id: 't1', name: 'Văn 2027', block_count: 3, layout: [{title: 'A.', parts: [
    {title: 'Phần I', lead: 'Trả lời từ câu {from} đến câu {to}', numbering: 'continue', score: 6, items: [{title: '', block_type: 'reading', count: 2}]},
    {title: 'Phần II', lead: '', numbering: 'restart', items: [{title: '', block_type: 'essay', count: 1}]},
]}]}];

function mock(stock: Record<string, number> = {reading: 3, essay: 1}) {
    vi.spyOn(Api, 'get').mockImplementation(async (url: string) => {
        if (url.startsWith('question_bank/templates')) return TEMPLATES;
        if (url.startsWith('question_bank/stats')) return {per_type: stock};
        if (url === 'folder/list') return [];
        return BANKS;
    });
    return vi.spyOn(Api, 'post').mockImplementation(async (url: string) =>
        url === 'question_bank/capacity' ? {capacity: 1, per_type: stock, slots: {}, bottleneck: null} : {id: 'E1'});
}

const renderPage = (path = '/create-from-bank?bank=b1') => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path='/create-from-bank' element={<CreateFromBank/>}/>
                <Route path='/question-bank' element={<div>TRANG NGÂN HÀNG</div>}/>
                <Route path='/subject/:id' element={<div>TRANG MÔN</div>}/>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>
);

/** Pick the sample exam and go to step 2. */
async function copyTemplate() {
    fireEvent.click(await screen.findByLabelText(/Văn 2027/));
    fireEvent.click(screen.getByText(/Tiếp: chép khung từ Văn 2027/));
    await screen.findAllByLabelText('Tên phần');
}

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('suggests 90 minutes for Toán and Ngữ văn, 60 for the rest', () => {
    expect(suggestedMinutes('Ngữ văn')).toBe(90);
    expect(suggestedMinutes('Toán')).toBe(90);
    expect(suggestedMinutes('Hoá học')).toBe(60);
});

it('copies the sample frame, computes the numbers itself and saves the frame as layout', async () => {
    const post = mock();
    renderPage();
    await copyTemplate();

    expect(screen.getByText('→ câu 1–10')).toBeTruthy();
    expect(screen.getByText('→ câu 1–1')).toBeTruthy();          // Phần II restarts

    // One more Đọc hiểu in Phần I: the lead's "đến câu" moves from 10 to 15.
    const lead = within(screen.getAllByRole('group', {name: 'Lời dẫn'})[0]);
    expect(lead.getAllByText(/^\d+$/).map(e => e.textContent)).toEqual(['1', '10']);
    fireEvent.click(screen.getAllByText('+ Thêm tiểu mục')[0]);
    fireEvent.change(screen.getAllByLabelText('Dạng khối')[1], {target: {value: 'reading'}});
    await waitFor(() => expect(lead.getAllByText(/^\d+$/).map(e => e.textContent)).toEqual(['1', '15']));
    fireEvent.click(screen.getAllByLabelText('Thao tác với tiểu mục 2')[0]);   // ⋯ menu → Xoá, back to the sample
    fireEvent.click(screen.getByRole('menuitem', {name: 'Xoá'}));

    fireEvent.change(screen.getByPlaceholderText(/Đề luyện thi/), {target: {value: ' Đề thử '}});
    fireEvent.click(screen.getByText('Xem trước'));
    fireEvent.click(await screen.findByText('Lưu đề'));

    await screen.findByText('TRANG NGÂN HÀNG');
    const body = post.mock.calls.find(c => c[0] === 'exam/create_from_bank')![1] as {layout: {parts: {numbering: string; score?: number}[]}[]};
    expect(body).toMatchObject({banks: ['b1'], name: 'Đề thử', duration: 90});
    expect(body.layout[0].parts.map(p => p.numbering)).toEqual(['continue', 'restart']);
    expect(body.layout[0].parts[0].score).toBe(6);
});

it('a frame asking for more blocks than the bank has says so at the tiểu mục and locks "Xem trước"', async () => {
    mock({reading: 1, essay: 1});
    renderPage();
    await copyTemplate();
    fireEvent.change(screen.getByPlaceholderText(/Đề luyện thi/), {target: {value: 'Đề'}});
    expect(await screen.findByText(/Ngân hàng chỉ có 1 khối/)).toBeTruthy();
    expect((screen.getByText('Xem trước') as HTMLButtonElement).disabled).toBe(true);
});

it('an empty frame says why it cannot go on', async () => {
    mock();
    renderPage();
    fireEvent.click(await screen.findByText(/Tiếp: chép khung từ khung trống/));
    await screen.findAllByLabelText('Tên phần');
    expect(screen.getByText('Chưa đặt tên đề và chưa chọn dạng khối.')).toBeTruthy();
    expect((screen.getByText('Xem trước') as HTMLButtonElement).disabled).toBe(true);
});

it('F5 keeps the draft: coming back offers to continue it, "Bắt đầu lại" drops it', async () => {
    mock();
    const first = renderPage();
    await copyTemplate();
    fireEvent.change(screen.getByPlaceholderText(/Đề luyện thi/), {target: {value: 'Dở dang'}});
    await waitFor(() => expect(localStorage.getItem('spt-cfb-draft:b1:')).toContain('Dở dang'), {timeout: 2000});
    first.unmount();

    renderPage();
    fireEvent.click(await screen.findByText(/Tiếp: chép khung từ khung trống/));
    expect(await screen.findByText('Tiếp tục khung đang soạn dở?')).toBeTruthy();
    fireEvent.click(screen.getByText('Tiếp tục'));
    expect((await screen.findByPlaceholderText(/Đề luyện thi/) as HTMLInputElement).value).toBe('Dở dang');
});

it('with ?folder it saves into that folder and goes back to the subject', async () => {
    const post = mock();
    renderPage('/create-from-bank?bank=b1&folder=F1');
    await copyTemplate();
    fireEvent.change(screen.getByPlaceholderText(/Đề luyện thi/), {target: {value: 'Đề X'}});
    fireEvent.click(screen.getByText('Xem trước'));
    fireEvent.click(await screen.findByText('Lưu đề'));
    await screen.findByText('TRANG MÔN');
    expect(post.mock.calls.find(c => c[0] === 'exam/create_from_bank')![1]).toMatchObject({folder: 'F1'});
});

it('whole-exam bank: no frame and no steps, name + minutes, saves without layout', async () => {
    const post = mock();
    renderPage('/create-from-bank?bank=p1');
    expect(await screen.findByText(/Kho có/)).toBeTruthy();
    expect(screen.queryByLabelText('Các bước')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tên đề'), {target: {value: 'Tuần 1'}});
    fireEvent.click(screen.getByText('Lưu đề'));
    await screen.findByText('TRANG NGÂN HÀNG');
    expect(post.mock.calls.find(c => c[0] === 'exam/create_from_bank')![1])
        .toMatchObject({banks: ['p1'], name: 'Tuần 1', layout: undefined});
});

it('Esc on the "continue draft?" dialog closes it and KEEPS the draft', async () => {
    mock();
    localStorage.setItem('spt-cfb-draft:b1:', JSON.stringify({layout: [{title: '', parts: [{title: 'P', lead: '', numbering: 'continue', items: [{title: '', block_type: 'reading', count: 1}]}]}], name: 'Giữ lại', template: '', savedAt: Date.now()}));
    renderPage();
    fireEvent.click(await screen.findByText(/Tiếp: chép khung từ khung trống/));
    await screen.findByText('Tiếp tục khung đang soạn dở?');
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByText('Tiếp tục khung đang soạn dở?')).toBeNull());
    expect(localStorage.getItem('spt-cfb-draft:b1:')).toContain('Giữ lại');
});
