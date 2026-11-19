import {afterEach, beforeEach, expect, it, vi} from 'vitest';
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
    {title: 'Phần II', lead: '', numbering: 'restart', score: 2, items: [{title: '', block_type: 'essay', count: 1}]},
]}]}];

function mock(stock: Record<string, number> = {reading: 3, essay: 1}) {
    vi.spyOn(Api, 'get').mockImplementation(async (url: string) => {
        if (url.startsWith('question_bank/templates')) return TEMPLATES;
        if (url.startsWith('question_bank/stats')) return {per_type: stock};
        if (url === 'folder/list') return [];
        return BANKS;
    });
    return vi.spyOn(Api, 'post').mockImplementation(async () => ({id: 'E1'}));
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

const SAMPLE = /Giống Văn 2027/;
const sheetName = () => screen.getByRole('textbox', {name: 'Tên đề'});
const createBtn = () => screen.getByRole('button', {name: 'Tạo đề'}) as HTMLButtonElement;
const body = (post: ReturnType<typeof mock>) => post.mock.calls.find(c => c[0] === 'exam/create_from_bank')![1] as
    {layout: {parts: {numbering: string; score?: number; items: {count: number}[]}[]}[]; name: string; duration: number; folder?: string};
/** Choose the sample: the sheet is there at once. */
async function pickSample() {
    fireEvent.click(await screen.findByLabelText(SAMPLE));
    await screen.findByRole('textbox', {name: 'Tên đề'});
}
/** Type into a text of the sheet the way the browser does: new text, then the cursor leaves. */
const typeInto = (el: HTMLElement, text: string) => { el.textContent = text; fireEvent.blur(el); };

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
afterEach(() => { Object.defineProperty(window, 'matchMedia', {value: undefined, configurable: true, writable: true}); });

it('suggests 90 minutes for Toán and Ngữ văn, 60 for the rest', () => {
    expect(suggestedMinutes('Ngữ văn')).toBe(90);
    expect(suggestedMinutes('Toán')).toBe(90);
    expect(suggestedMinutes('Hoá học')).toBe(60);
});

it('choosing a sample puts the sheet on the page at once with its name, numbers and one click to create', async () => {
    const post = mock();
    renderPage();
    expect(screen.queryByRole('button', {name: 'Tạo đề'})).toBeNull();   // nothing chosen yet: no sheet, no button
    expect(await screen.findByText('11 câu · 8 điểm')).toBeTruthy();
    await pickSample();
    expect(sheetName().textContent).toBe('Đề luyện Ngữ văn — theo Văn 2027');
    expect(screen.getByRole('textbox', {name: 'Lời dẫn Phần I'}).textContent).toBe('Trả lời từ câu 1 đến câu 10');
    expect([...document.querySelectorAll('.v3-ph-range')].map(e => e.textContent)).toEqual(['Câu 1–10', 'Câu 1']);
    expect(createBtn().disabled).toBe(false);

    fireEvent.click(createBtn());
    await screen.findByText('TRANG NGÂN HÀNG');
    const sent = body(post);
    expect(sent).toMatchObject({name: 'Đề luyện Ngữ văn — theo Văn 2027', duration: 90});
    expect(sent.layout[0].parts.map(p => p.numbering)).toEqual(['continue', 'restart']);
    expect(sent.layout[0].parts[0].score).toBe(6);
});

it('+1 đoạn in the frame box: question count, lead and points per question change at once', async () => {
    mock();
    renderPage();
    await pickSample();
    fireEvent.click(screen.getAllByRole('button', {name: 'Sửa đoạn đọc hiểu'})[0]);
    const box = within(screen.getByRole('dialog', {name: 'Sửa đoạn đọc hiểu'}));
    fireEvent.click(box.getByLabelText('Thêm 1 đoạn đọc hiểu'));

    expect(screen.getByRole('textbox', {name: 'Lời dẫn Phần I'}).textContent).toBe('Trả lời từ câu 1 đến câu 15');
    expect(box.getByText(/mỗi câu/).textContent).toContain('0,4 điểm');
    expect(box.getByText(/mỗi câu/).textContent).toContain('15 câu');
    expect(box.getByRole('status').textContent).toContain('đến câu 15');
    expect(document.querySelector('.v3-ph-range')?.textContent).toBe('Câu 1–15');
    fireEvent.click(box.getByText('Xong'));
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('Esc closes the box, and so does a click outside', async () => {
    mock();
    renderPage();
    await pickSample();
    fireEvent.click(screen.getAllByRole('button', {name: 'Sửa đoạn đọc hiểu'})[0]);
    expect(screen.getByRole('dialog', {name: 'Sửa đoạn đọc hiểu'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Điểm Phần II/));
    expect(screen.getByRole('dialog', {name: 'Sửa Phần II'})).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('the part box: points per question, "đánh số lại" only after the first Phần, delete a Phần', async () => {
    const post = mock();
    renderPage();
    await pickSample();
    fireEvent.click(screen.getByLabelText(/Điểm Phần I:/));
    expect(screen.queryByLabelText(/Đánh số câu lại/)).toBeNull();
    fireEvent.mouseDown(document.body);

    fireEvent.click(screen.getByLabelText(/Điểm Phần II/));
    const box = within(screen.getByRole('dialog', {name: 'Sửa Phần II'}));
    expect(box.getByText(/Phần có 1 câu → câu này 2 điểm/)).toBeTruthy();
    fireEvent.click(box.getByLabelText(/Đánh số câu lại từ Câu 1/));
    expect(box.getByText(/nối tiếp Phần I \(thành Câu 11\)/)).toBeTruthy();
    fireEvent.click(box.getByText('Xoá Phần II'));
    fireEvent.click(createBtn());
    await screen.findByText('TRANG NGÂN HÀNG');
    expect(body(post).layout[0].parts).toHaveLength(1);
});

it('editing a text of the sheet changes the exam sent; a number chip is kept as a token', async () => {
    const post = mock();
    renderPage();
    await pickSample();
    typeInto(sheetName(), 'Đề thử');
    const lead = screen.getByRole('textbox', {name: 'Lời dẫn Phần I'});
    expect(lead.querySelectorAll('.v3-n')).toHaveLength(2);
    typeInto(screen.getByRole('textbox', {name: 'Thời gian làm bài (phút)'}), '45');
    fireEvent.click(createBtn());
    await screen.findByText('TRANG NGÂN HÀNG');
    expect(body(post)).toMatchObject({name: 'Đề thử', duration: 45});
});

it('an empty name is thrown away (the exam keeps its name)', async () => {
    mock();
    renderPage();
    await pickSample();
    typeInto(sheetName(), '   ');
    await waitFor(() => expect(sheetName().textContent).toBe('Đề luyện Ngữ văn — theo Văn 2027'));
});

it('a bank with too few blocks says so at the frame, locks "Tạo đề", and "Bớt 1 đoạn" clears it', async () => {
    mock({reading: 1, essay: 1});
    renderPage();
    await pickSample();
    expect(await screen.findByText(/Ngân hàng chỉ có 1 đoạn đọc hiểu, đề này cần 2/)).toBeTruthy();
    expect(screen.getAllByText(/Thiếu 1 đoạn đọc hiểu/).length).toBeGreaterThan(0);
    expect(createBtn().disabled).toBe(true);
    expect(screen.getByRole('link', {name: 'Nhập thêm đề vào ngân hàng'}).getAttribute('href')).toBe('/import-exam?bank=b1');
    fireEvent.click(screen.getByText('Bớt 1 đoạn'));
    await waitFor(() => expect(createBtn().disabled).toBe(false));
    expect(screen.queryByText(/Ngân hàng chỉ có/)).toBeNull();
});

it('blank sheet: asks what Phần I holds, locks "Tạo đề" until something is added', async () => {
    const post = mock();
    renderPage();
    fireEvent.click(await screen.findByLabelText(/Không dùng đề mẫu/));
    await screen.findByText('Phần I gồm gì? Bấm để thêm:');
    expect(sheetName().textContent).toBe('Đề luyện Ngữ văn');
    expect(screen.getByText(/Đề chưa có câu nào/)).toBeTruthy();
    expect(createBtn().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', {name: /Câu viết bài văn/}));
    await waitFor(() => expect(createBtn().disabled).toBe(false));
    fireEvent.click(createBtn());
    await screen.findByText('TRANG NGÂN HÀNG');
    expect(body(post).layout[0].parts[0].items).toHaveLength(1);
});

it('changing the sample after edits asks "Bỏ các chỗ đã sửa?"; keeping stays, confirming switches', async () => {
    mock();
    renderPage();
    await pickSample();
    typeInto(sheetName(), 'Đề của tôi');
    fireEvent.change(screen.getByLabelText('Làm đề giống'), {target: {value: 'none'}});
    fireEvent.click(await screen.findByText('Giữ lại'));
    expect(sheetName().textContent).toBe('Đề của tôi');
    fireEvent.change(screen.getByLabelText('Làm đề giống'), {target: {value: 'none'}});
    fireEvent.click(await screen.findByText('Bỏ và đổi'));
    await waitFor(() => expect(sheetName().textContent).toBe('Đề luyện Ngữ văn'));
});

it('changing the sample without edits needs no question', async () => {
    mock();
    renderPage();
    await pickSample();
    fireEvent.change(screen.getByLabelText('Làm đề giống'), {target: {value: 'none'}});
    await waitFor(() => expect(sheetName().textContent).toBe('Đề luyện Ngữ văn'));
    expect(screen.queryByText('Bỏ các chỗ đã sửa?')).toBeNull();
});

it('F5 keeps the draft: coming back offers to continue it, and "Tiếp tục soạn" brings the edits back', async () => {
    mock();
    const first = renderPage();
    await pickSample();
    expect(localStorage.getItem('spt-cfb-draft:b1:')).toBeNull();   // nothing edited, nothing saved
    typeInto(sheetName(), 'Dở dang');
    await waitFor(() => expect(localStorage.getItem('spt-cfb-draft:b1:')).toContain('Dở dang'), {timeout: 2000});
    first.unmount();

    renderPage();
    expect(await screen.findByText('Tiếp tục khung đang soạn dở?')).toBeTruthy();
    fireEvent.click(screen.getByText('Tiếp tục soạn'));
    await waitFor(() => expect(sheetName().textContent).toBe('Dở dang'));
});

it('"Bỏ, làm lại từ đầu" drops the draft', async () => {
    mock();
    localStorage.setItem('spt-cfb-draft:b1:', JSON.stringify({layout: [{title: '', parts: [{title: 'P', lead: '', numbering: 'continue', items: [{title: '', block_type: 'reading', count: 1}]}]}], name: 'Cũ', template: 'none', savedAt: Date.now()}));
    renderPage();
    fireEvent.click(await screen.findByText('Bỏ, làm lại từ đầu'));
    expect(localStorage.getItem('spt-cfb-draft:b1:')).toBeNull();
});

it('Esc on the "continue draft?" dialog closes it and KEEPS the draft', async () => {
    mock();
    localStorage.setItem('spt-cfb-draft:b1:', JSON.stringify({layout: [{title: '', parts: [{title: 'P', lead: '', numbering: 'continue', items: [{title: '', block_type: 'reading', count: 1}]}]}], name: 'Giữ lại', template: 'none', savedAt: Date.now()}));
    renderPage();
    await screen.findByText('Tiếp tục khung đang soạn dở?');
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByText('Tiếp tục khung đang soạn dở?')).toBeNull());
    expect(localStorage.getItem('spt-cfb-draft:b1:')).toContain('Giữ lại');
});

it('with ?folder it saves into that folder and lands on the subject with the new exam named', async () => {
    const post = mock();
    renderPage('/create-from-bank?bank=b1&folder=F1');
    await pickSample();
    fireEvent.click(createBtn());
    await screen.findByText('TRANG MÔN');
    expect(body(post)).toMatchObject({folder: 'F1'});
});

it('after saving it lands on Môn & đề of the folder the BE put the exam in (BV2-08)', async () => {
    const post = mock();
    post.mockImplementation(async () => ({id: 'E9', folder: 'F7'}));
    renderPage();
    await pickSample();
    fireEvent.click(createBtn());
    await screen.findByText('TRANG MÔN');
});

it('a failed save shows the reason and keeps the sheet', async () => {
    const post = mock();
    post.mockImplementation(async () => { throw {error: 'Máy chủ bận'}; });
    renderPage();
    await pickSample();
    fireEvent.click(createBtn());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(sheetName()).toBeTruthy();
});

it('whole-exam bank: no sheet, name + minutes, saves without layout', async () => {
    const post = mock();
    renderPage('/create-from-bank?bank=p1');
    expect(await screen.findByText(/Kho có/)).toBeTruthy();
    expect(document.querySelector('.v3-paper')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tên đề'), {target: {value: 'Tuần 1'}});
    fireEvent.click(screen.getByText('Lưu đề'));
    await screen.findByText('TRANG NGÂN HÀNG');
    expect(post.mock.calls.find(c => c[0] === 'exam/create_from_bank')![1]).toMatchObject({banks: ['p1'], name: 'Tuần 1', layout: undefined});
});

it('a bank list that fails to load offers a retry', async () => {
    vi.spyOn(Api, 'get').mockRejectedValue({error: 'x'});
    renderPage();
    expect(await screen.findByText('Không tải được danh sách ngân hàng')).toBeTruthy();
});

it('desktop: the head holds "Tạo đề" with the hint, locked until a sample is chosen; the empty panel shows the 3 steps', async () => {
    Object.defineProperty(window, 'matchMedia', {configurable: true, writable: true,
        value: (q: string) => ({matches: true, media: q, addEventListener() {}, removeEventListener() {}})});
    mock();
    renderPage();
    expect(await screen.findByText('Chọn một đề mẫu ở bên trái')).toBeTruthy();
    expect(createBtn().disabled).toBe(true);
    expect(screen.getByText('Chọn một đề mẫu để xem đề.')).toBeTruthy();
    expect(screen.getByText('3. Bấm Tạo đề')).toBeTruthy();
    fireEvent.click(await screen.findByLabelText(SAMPLE));
    await screen.findByRole('textbox', {name: 'Tên đề'});
    expect(createBtn().disabled).toBe(false);
    expect(screen.getByText(/Học sinh chỉ thấy khi bạn xuất bản/)).toBeTruthy();
    expect(screen.getByText(/Ngân hàng đủ để mỗi học sinh làm khoảng/).textContent).toContain('1 đề');
    // the reason a blank sheet cannot be saved shows beside the button (phone has no such line, as drawn)
    fireEvent.click(await screen.findByLabelText(/Không dùng đề mẫu/));
    expect(await screen.findByText('Thêm ít nhất một đoạn hoặc câu để tạo đề.')).toBeTruthy();
});
