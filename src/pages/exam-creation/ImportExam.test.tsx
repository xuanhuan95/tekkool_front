import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {notify} from '../../components/ui';
import Api from '../../services/api';
import ImportExam from './ImportExam';

// This screen is the only door for getting exams into the system. Guarded here:
// the save blockers (Q12/Q13), failures that must be said out loud (duplicate check, save),
// and the seam "on-screen edit → payload sent to the backend", where a wrong `type` or
// `max_words` lands a block in the wrong bank slot without anyone noticing.

const mc = (id: string, key?: string) => ({
    id, type: 'MultipleChoice',
    data: {question: `<p>${id}</p>`, answers: [{id: id + 'A', value: '2'}, {id: id + 'B', value: '3'}], correctAnswerId: key},
});
const tf = (id: string, pid = 'P') => ({
    id, type: 'TrueFalse',
    data: {question: `<p>ý ${id}</p>`, passage: '<p>Đề dẫn</p>', passageId: pid, answer: true},
});
const examOf = (...questions: any[]) => ({
    id: 'E1', name: 'Đề thử 1', duration: 45, source: ['Câu 1. Nội dung'],
    sections: [{id: 'S1', name: 'Phần I', question_type: questions[0].type, questions}],
});
const EXAM = examOf(mc('Q1', 'Q1A'));
const MIXED = examOf(mc('Q1', 'Q1A'), {id: 'Q2', type: 'FreeAnswer', data: {question: '<p>Viết đoạn văn.</p>'}});

const renderScreen = (path = '/import-exam?bank=B1') => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path='/import-exam' element={<ImportExam/>}/>
                <Route path='/question-bank' element={<div>TRANG NGÂN HÀNG</div>}/>
                <Route path='/subject/:id' element={<div>TRANG MÔN</div>}/>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>
);

async function loadFile(exam: unknown = EXAM, issues: unknown[] = []) {
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [exam], issues});
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, {target: {files: [new File(['PK'], 'de.docx')]}});
    await screen.findByText(/Đọc được 1 đề/);
}

/** Backend double: `save` collects what is sent to question_bank/save. */
function mockPost(over: Record<string, (body?: any) => unknown> = {}) {
    const sent: any[] = [];
    vi.spyOn(Api, 'post').mockImplementation(async (url: string, body?: any) => {
        if (over[url]) return over[url](body);
        if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
        if (url === 'question_bank/save') { sent.push(body); return {saved: 2}; }
        return {};
    });
    return sent;
}

const saveButton = () => screen.getByText(/Lưu 1 đề vào ngân hàng/).closest('button')!;

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api, 'get').mockImplementation(async (url: string) =>
        url === 'question_bank/list' ? [{id: 'B1', name: 'NH Toán 12', subject: 'Toán', blocks: 0}] : []);
    vi.spyOn(notify, 'success').mockImplementation(() => undefined as never);
    vi.spyOn(notify, 'error').mockImplementation(() => undefined as never);
});

describe('ImportExam: feedback', () => {
    it('says how many blocks went in after saving to the bank', async () => {
        mockPost();
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith(expect.stringContaining('Đã thêm 2 khối')));
    });

    it('images go through image/upload before save; a dropped connection can be retried', async () => {
        const IMG = 'data:image/png;base64,iVBORw0KGgo=';
        const withImg = examOf({...mc('Q1', 'Q1A'), data: {...mc('Q1', 'Q1A').data, question: `<p>x<img src="${IMG}"></p>`}});
        const sent = mockPost();
        renderScreen();
        const up = vi.spyOn(Api, 'upload').mockResolvedValueOnce({exams: [withImg], issues: []});
        fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['PK'], 'de.docx')]}});
        await screen.findByText(/Đọc được 1 đề/);

        up.mockRejectedValueOnce(new TypeError('fetch'));
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith('Lưu thất bại: Đề thử 1', expect.stringContaining('kết nối')));
        expect(sent).toHaveLength(0);

        up.mockResolvedValueOnce({path: 'image/view/abc'});
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(JSON.stringify(sent[0])).toContain('src=\\"/api/image/view/abc\\"');
        expect(JSON.stringify(sent[0])).not.toContain('data:image');
    });

    it('a failed save names the exam that stopped it', async () => {
        mockPost({'question_bank/save': () => { throw {error: 'Ngân hàng đầy'}; }});
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith('Lưu thất bại: Đề thử 1', 'Ngân hàng đầy'));
        expect(notify.success).not.toHaveBeenCalled();
    });

    it('a failed duplicate check reports an error instead of staying silent as if clean', async () => {
        mockPost({'question_bank/check_trung': () => { throw {error: 'bận'}; }});
        renderScreen();
        await loadFile();
        fireEvent.click(screen.getByText(/Kiểm tra trùng lặp/));
        await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Không đo được trùng lặp')));
    });

    it('a duplicate shows on the exam row', async () => {
        mockPost({'question_bank/check_trung': () => ({trung: {Q1: {score: 0.97, khop: [{khoi: 'K9', score: 0.97}]}}})});
        renderScreen();
        await loadFile();
        fireEvent.click(screen.getByText(/Kiểm tra trùng lặp/));
        await screen.findByText('1 câu trùng');
        // the chip on the question itself stays readable and never blocks saving
        expect(screen.getByText(/Tỷ lệ trùng: 97%/)).toBeTruthy();
        expect(saveButton().disabled).toBe(false);
    });

    it('a file that is not .docx is refused before uploading', async () => {
        const upload = vi.spyOn(Api, 'upload');
        renderScreen();
        const input = document.querySelector('input[type=file]') as HTMLInputElement;
        fireEvent.change(input, {target: {files: [new File(['x'], 'de.pdf')]}});
        await screen.findByText(/Chỉ nhận file .docx/);
        expect(upload).not.toHaveBeenCalled();
    });
});

describe('ImportExam: saving in the wrong place', () => {
    it('without ?bank= there is no save-to-bank button, only the pointer to the bank screen', async () => {
        mockPost();
        renderScreen('/import-exam');
        await loadFile();
        expect(screen.queryByText(/vào ngân hàng$/)).toBeNull();
        expect(screen.getByText(/Muốn lưu vào ngân hàng thì vào/)).toBeTruthy();
    });
});

describe('ImportExam: Q12 / Q13 save blockers', () => {
    it('Q12: a pick-one question without a correct answer blocks saving until one is picked', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1')));

        expect(saveButton().disabled).toBe(true);
        expect(screen.getAllByText(/Còn 1 câu chưa có đáp án/).length).toBeGreaterThan(0);
        expect(screen.getByText('Chưa có đáp án đúng — chọn một phương án')).toBeTruthy();

        fireEvent.click(screen.getByLabelText('Đáp án đúng của câu 1: B'));
        expect(saveButton().disabled).toBe(false);
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].sections[0].questions[0].data.correctAnswerId).toBe('Q1B');
    });

    it('Q13: a Đúng/Sai question with 3 ý blocks saving and says why', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(tf('T1'), tf('T2'), tf('T3')));
        expect(saveButton().disabled).toBe(true);
        expect(screen.getAllByText(/Còn 1 câu Đúng\/Sai chưa đủ 4 ý/).length).toBeGreaterThan(0);
        expect(screen.getByText(/3 ý — cần đủ 4 ý để chấm theo SPT/)).toBeTruthy();
    });

    it('Q13: four ý sharing a passage are ONE question and save fine', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(tf('T1'), tf('T2'), tf('T3'), tf('T4')));
        expect(saveButton().disabled).toBe(false);
        expect(screen.getByText('1 câu')).toBeTruthy();
    });

    it('unticking the only broken exam lifts the block', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1')));
        fireEvent.click(screen.getByLabelText('Chọn Đề thử 1'));
        // nothing chosen → still disabled, but because there is nothing to save
        expect(screen.queryByText(/Còn 1 câu chưa có đáp án —/)).toBeNull();
    });
});

describe('ImportExam: payload decides which slot a question goes into', () => {
    const typeSelect = (n: number) => screen.getAllByLabelText('Loại câu')[n];

    it('the word limit typed on screen reaches the BE as a NUMBER', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(MIXED);
        fireEvent.change(screen.getByLabelText(/Số từ gợi ý/), {target: {value: '200'}});
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        // The BE compares max_words with 50/400 to pick TraLoiNgan/VietDoan/VietBai: a string breaks that.
        expect(sent[0].sections[0].questions[1].data.max_words).toBe(200);
    });

    it('a word limit of 0 removes the field', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(MIXED);
        const box = screen.getByLabelText(/Số từ gợi ý/);
        fireEvent.change(box, {target: {value: '200'}});
        fireEvent.change(box, {target: {value: '0'}});
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect('max_words' in sent[0].sections[0].questions[1].data).toBe(false);
    });

    it('changing a type sends the NEW type, drops the old answers, and leaves the other question alone', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(MIXED);
        fireEvent.change(typeSelect(0), {target: {value: 'FillBlank'}});
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        const [q1, q2] = sent[0].sections[0].questions;
        expect(q1.type).toBe('FillBlank');
        expect(q1.data.answers).toBeUndefined();
        expect(q2.type).toBe('FreeAnswer');
    });

    it('a lone Đúng/Sai made by a type change blocks saving (Q13)', async () => {
        mockPost();
        renderScreen();
        await loadFile(MIXED);
        fireEvent.change(typeSelect(0), {target: {value: 'TrueFalse'}});
        expect(saveButton().disabled).toBe(true);
        expect(screen.getAllByText(/Còn 1 câu Đúng\/Sai chưa đủ 4 ý/).length).toBeGreaterThan(0);
    });

    it('both questions of a shared passage keep their passageId', async () => {
        const sent = mockPost();
        renderScreen();
        const withPassage = (i: number) => ({
            ...mc('Q' + i, `Q${i}A`),
            data: {...mc('Q' + i, `Q${i}A`).data, passage: '<p>Quê hương</p>', passageId: 'P1'},
        });
        await loadFile(examOf(withPassage(1), withPassage(2)));
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].sections[0].questions.map((q: any) => q.data.passageId)).toEqual(['P1', 'P1']);
    });

    it('shows the solution (explanation) of a question and sends it back untouched', async () => {
        const sent = mockPost();
        renderScreen();
        const q = mc('Q1', 'Q1A');
        await loadFile(examOf({...q, data: {...q.data, explanation: '<p>Vì 1+1=2</p>', max_score: 0.25}}));
        expect(screen.getByText('Vì 1+1=2')).toBeTruthy();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].sections[0].questions[0].data).toMatchObject({explanation: '<p>Vì 1+1=2</p>', max_score: 0.25});
    });
});

describe('ImportExam: bản gốc PDF (SPT-70)', () => {
    const desktop = (on: boolean) => vi.stubGlobal('matchMedia', (q: string) =>
        ({matches: on, media: q, addEventListener: () => {}, removeEventListener: () => {}}));
    beforeEach(() => {
        mockPost();
        URL.createObjectURL = vi.fn(() => 'blob:pdf-1');
        URL.revokeObjectURL = vi.fn();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('desktop: asks for the PDF next to the parse and shows it in an iframe; revoked on unmount', async () => {
        desktop(true);
        vi.spyOn(Api, 'uploadBlob').mockResolvedValue(new Blob(['%PDF']));
        const {unmount} = renderScreen();
        await loadFile();
        await vi.waitFor(() => expect(document.querySelector('iframe')?.getAttribute('src')).toBe('blob:pdf-1'));
        expect(Api.uploadBlob).toHaveBeenCalledWith('import_docx/pdf', expect.any(File));
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
    });

    it('PDF fails (503): says there is no source, import still works', async () => {
        desktop(true);
        vi.spyOn(Api, 'uploadBlob').mockRejectedValue({code: 503, error: 'x'});
        renderScreen();
        await loadFile();
        await screen.findByText('Không có bản gốc cho file này');
        expect(saveButton().disabled).toBe(false);
    });

    it('phone: also asks for the PDF, but shows it only on the "Bản gốc" tab', async () => {
        desktop(false);
        const blob = vi.spyOn(Api, 'uploadBlob').mockResolvedValue(new Blob(['%PDF']));
        renderScreen();
        await loadFile();
        await vi.waitFor(() => expect(blob).toHaveBeenCalledWith('import_docx/pdf', expect.any(File)));
        expect(document.querySelector('iframe')).toBeNull();
        fireEvent.click(screen.getByRole('tab', {name: 'Bản gốc'}));
        expect(document.querySelector('iframe')?.getAttribute('src')).toBe('blob:pdf-1');
        expect(screen.getByText('Mở bản gốc toàn màn hình')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', {name: 'Đã đọc'}));
        expect(document.querySelector('iframe')).toBeNull();
    });
});

// ── Nhập đề v2 (SPT-93): coded warnings, the save gate, paste answers ─────────────────
const issue = (over: Record<string, unknown>) => ({
    code: 'COUNT_MISMATCH', level: 'error', exam_id: 'E1', section_index: null, question_id: null, question_no: null,
    message: 'Đề ghi 2 câu, hệ thống đọc được 1 câu', ...over,
});
const SEVERE = issue({});
const LIGHT = issue({code: 'RAW_LATEX', level: 'warning', question_id: 'Q1', question_no: 1, message: 'Câu 1: có công thức gõ thô'});
const seeButton = () => screen.getByText('Đã xem, cho phép lưu');

describe('ImportExam: Nặng warnings gate saving (both paths)', () => {
    it('a Nhẹ warning is shown with its level in words and never blocks', async () => {
        mockPost();
        renderScreen();
        await loadFile(EXAM, [LIGHT]);
        expect(saveButton().disabled).toBe(false);
        // once in the list, once as the chip on the question itself
        expect(screen.getAllByText('Nhẹ')).toHaveLength(2);
        expect(screen.getByText('Công thức gõ thô')).toBeTruthy();
    });

    it('a Nặng warning disables both buttons with a spoken reason, "Đã xem" lifts it', async () => {
        mockPost();
        renderScreen();
        await loadFile(EXAM, [SEVERE, LIGHT]);
        const draft = screen.getByText(/Tạo thẳng 1 đề/).closest('button')!;
        expect(saveButton().disabled).toBe(true);
        expect(draft.disabled).toBe(true);
        expect(screen.getByRole('alert').textContent).toContain('Còn 1 cảnh báo nặng chưa xem');

        fireEvent.click(seeButton());
        expect(saveButton().disabled).toBe(false);
        expect(draft.disabled).toBe(false);
        expect(screen.getByText(/Đã xem 1 cảnh báo nặng. 1 cảnh báo nhẹ không chặn/)).toBeTruthy();
    });

    it('draft-only screen (no bank): the gate applies there too', async () => {
        mockPost();
        renderScreen('/import-exam?folder=F1');
        await loadFile(EXAM, [SEVERE]);
        const create = screen.getByText(/Tạo 1 đề nháp/).closest('button')!;
        expect(create.disabled).toBe(true);
        fireEvent.click(seeButton());
        expect(create.disabled).toBe(false);
    });

    it('each Nặng warning needs its own confirmation', async () => {
        mockPost();
        renderScreen();
        await loadFile(EXAM, [SEVERE, issue({code: 'EMPTY_SECTION', message: 'Phần IV: không đọc được câu nào'})]);
        fireEvent.click(screen.getAllByText('Đã xem, cho phép lưu')[0]);
        expect(saveButton().disabled).toBe(true);
        fireEvent.click(seeButton());
        expect(saveButton().disabled).toBe(false);
    });

    it('unticking the exam with the Nặng warning lifts the gate; "Cách sửa" opens the guide anchor in a new tab', async () => {
        mockPost();
        renderScreen();
        await loadFile(EXAM, [SEVERE]);
        const fix = screen.getByText('Cách sửa').closest('a')!;
        // B4: the bank (or folder) travels with the link
        expect(fix.getAttribute('href')).toBe('/import-exam/loi-thuong-gap?bank=B1#mat-cau');
        expect(fix.getAttribute('target')).toBe('_blank');
        fireEvent.click(screen.getByLabelText('Chọn Đề thử 1'));
        expect(screen.queryByText(/cảnh báo nặng chưa xem/)).toBeNull();
    });

    it('"Đánh số lại" drops the number-jump warnings of that exam', async () => {
        mockPost();
        renderScreen();
        const gap = issue({code: 'NUMBER_GAP', level: 'warning', question_id: 'Q1', message: 'sau câu 5 là câu 7'});
        await loadFile(EXAM, [gap]);
        expect(screen.getByText('sau câu 5 là câu 7')).toBeTruthy();
        fireEvent.click(screen.getByText('Đánh số lại câu'));
        fireEvent.click(screen.getByText('Đánh số lại', {selector: 'button'}));
        expect(screen.queryByText('sau câu 5 là câu 7')).toBeNull();
    });
});

describe('ImportExam: Dán đáp án nhanh', () => {
    it('previews per question, applies only on confirm, and the applied key reaches the BE', async () => {
        const sent = mockPost({
            'import_docx/answers': () => ({answers: {Q1: {correctAnswerId: 'Q1B'}}, applied: 1,
                issues: [{code: 'PASTE_OUT_OF_RANGE', level: 'warning', message: 'Câu 40: phần này chỉ có 1 câu'}]}),
        });
        renderScreen();
        await loadFile(examOf(mc('Q1')));

        fireEvent.click(screen.getByText('Dán đáp án nhanh'));
        fireEvent.change(screen.getByLabelText('Chuỗi đáp án'), {target: {value: '1B 40B'}});
        fireEvent.click(screen.getByText('Xem trước'));
        await screen.findByText('Áp dụng 1 đáp án');
        expect(screen.getByText('Thêm mới')).toBeTruthy();
        expect(screen.getByText('Câu 40: phần này chỉ có 1 câu')).toBeTruthy();
        // preview only: nothing written yet
        expect(saveButton().disabled).toBe(true);

        fireEvent.click(screen.getByText('Áp dụng 1 đáp án'));
        expect(saveButton().disabled).toBe(false);
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].sections[0].questions[0].data.correctAnswerId).toBe('Q1B');
    });

    it('sends the question frame without images, in paper order', async () => {
        const calls: any[] = [];
        mockPost({'import_docx/answers': body => { calls.push(body); return {answers: {}, applied: 0, issues: []}; }});
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1A'), tf('T1')));
        fireEvent.click(screen.getByText('Dán đáp án nhanh'));
        fireEvent.change(screen.getByLabelText('Chuỗi đáp án'), {target: {value: '1A'}});
        fireEvent.click(screen.getByText('Xem trước'));
        await vi.waitFor(() => expect(calls).toHaveLength(1));
        expect(calls[0].text).toBe('1A');
        expect(calls[0].questions).toEqual([
            {id: 'Q1', type: 'MultipleChoice', answer_ids: ['Q1A', 'Q1B']},
            {id: 'T1', type: 'TrueFalse', answer_ids: [], group: 'P'},
        ]);
    });
});

describe('ImportExam: QC round (B1, B4, B5, B12)', () => {
    it('B1: a Đúng/Sai ý with no Đúng/Sai blocks the bank path with a spoken reason, then Dán đáp án lifts it', async () => {
        mockPost();
        renderScreen();
        const unset = (id: string) => ({id, type: 'TrueFalse', data: {question: '<p>ý</p>', passage: '<p>d</p>', passageId: 'P'}});
        await loadFile(examOf(unset('T1'), tf('T2'), tf('T3'), tf('T4')));
        expect(saveButton().disabled).toBe(true);
        expect(screen.getAllByText(/Còn 1 câu Đúng\/Sai chưa đặt Đúng\/Sai cho từng ý/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Chưa đặt Đúng\/Sai cho ý a/)).toBeTruthy();
    });

    it('B4: the upload page and the error link keep ?bank=', async () => {
        renderScreen('/import-exam?bank=B1');
        const link = screen.getByText('Lỗi thường gặp và cách sửa →').closest('a')!;
        expect(link.getAttribute('href')).toBe('/import-exam/loi-thuong-gap?bank=B1');
    });

    it('B5: converting away and back restores the options and the key', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1B')));
        const sel = () => screen.getAllByLabelText('Loại câu')[0];
        fireEvent.change(sel(), {target: {value: 'FreeAnswer'}});
        expect(screen.queryByLabelText(/Đáp án đúng của câu 1/)).toBeNull();
        fireEvent.change(sel(), {target: {value: 'MultipleChoice'}});
        expect((screen.getByLabelText('Đáp án đúng của câu 1: B') as HTMLInputElement).checked).toBe(true);
    });

    it('B5: a free-answer question that holds A–D can be split into options with one button', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(examOf({id: 'Q1', type: 'FreeAnswer', data: {question: '<p>Chất nào? A. HCl B. NaCl C. KCl D. H₂O</p>'}}));
        fireEvent.click(screen.getByText('Đổi sang Trắc nghiệm và tách A–D'));
        expect(screen.getByLabelText('Đáp án đúng của câu 1: D')).toBeTruthy();
        fireEvent.click(screen.getByLabelText('Đáp án đúng của câu 1: B'));
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].sections[0].questions[0].data.answers).toHaveLength(4);
    });

    it('B5: turning a Đúng/Sai question into another type asks first, because it splits into 4', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(tf('T1'), tf('T2'), tf('T3'), tf('T4')));
        fireEvent.change(screen.getAllByLabelText('Loại câu')[0], {target: {value: 'FillBlank'}});
        expect(screen.getByText('Đổi dạng câu Đúng/Sai?')).toBeTruthy();
        expect(screen.getByText('1 câu')).toBeTruthy();   // nothing changed yet
        fireEvent.click(screen.getByText('Giữ nguyên'));
        expect(screen.getByText('1 câu')).toBeTruthy();
    });

    it('B12: reading can be cancelled, and a non-zip file never reaches the BE', async () => {
        const pdf = vi.spyOn(Api, 'uploadBlob');
        const up = vi.spyOn(Api, 'upload');
        renderScreen();
        fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['hello'], 'x.docx')]}});
        await screen.findByText('Không đọc được file');
        expect(up).not.toHaveBeenCalled();
        expect(pdf).not.toHaveBeenCalled();
    });
});
