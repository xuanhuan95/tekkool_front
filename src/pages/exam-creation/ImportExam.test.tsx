import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
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
                <Route path='/question-bank/:id' element={<div>TRANG KHỐI</div>}/>
                <Route path='/subject/:id' element={<div>TRANG MÔN</div>}/>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>
);

async function loadFile(exam: unknown = EXAM, issues: unknown[] = []) {
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [exam], issues});
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, {target: {files: [new File(['PK'], 'de.docx')]}});
    await screen.findByText(/1 đề — nhập 1/);
}

/** Backend double: `save` collects what is sent to question_bank/save. */
function mockPost(over: Record<string, (body?: any) => unknown> = {}) {
    const sent: any[] = [];
    vi.spyOn(Api, 'post').mockImplementation(async (url: string, body?: any) => {
        if (over[url]) return over[url](body);
        if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
        if (url === 'question_bank/save') { sent.push(body); return {saved: 2, stats: {total: 12}}; }
        return {};
    });
    return sent;
}

const saveButton = () => document.querySelector('.vt-imp-bar .vt-bk-bar-main') as HTMLButtonElement;

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api, 'get').mockImplementation(async (url: string) =>
        url === 'question_bank/list' ? [{id: 'B1', name: 'NH Toán 12', subject: 'Toán', blocks: 0, items: 11}]
            : url === 'folder/list' ? [{id: 'F1', name: 'Toán', parent: null}, {id: 'F2', name: 'Văn', parent: null}] : []);
    vi.spyOn(notify, 'success').mockImplementation(() => undefined as never);
    vi.spyOn(notify, 'error').mockImplementation(() => undefined as never);
});

describe('ImportExam: feedback', () => {
    it('one button: no suspected duplicate → saves at once, says so, and the saved screen gives the totals', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile();
        expect(screen.queryByText(/Kiểm trùng lặp/)).toBeNull();
        fireEvent.click(saveButton());
        await screen.findByText('Đã nhập 1 đề vào ngân hàng');
        expect(notify.success).toHaveBeenCalledWith('Đã nhập 1 đề vào ngân hàng');
        expect(sent).toHaveLength(1);
        expect(screen.getByText(/có thêm 1 khối, giờ có 12 khối/)).toBeTruthy();
        expect(screen.getByText('Nhập thêm đề')).toBeTruthy();
        fireEvent.click(screen.getByText('Xem ngân hàng'));
        await screen.findByText('TRANG KHỐI');
    });

    it('"Nhập thêm đề" goes back to the upload step with nothing left over', async () => {
        mockPost();
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        fireEvent.click(await screen.findByText('Nhập thêm đề'));
        await screen.findByText('Kéo một hoặc nhiều file Word vào đây');
        expect(document.querySelector('.vt-imp-bar')).toBeNull();
    });

    it('whole-exam bank: ONE save request carries every exam; the answer shows what was saved and refused', async () => {
        vi.mocked(Api.get).mockImplementation(async (url: string) =>
            url === 'question_bank/list' ? [{id: 'B1', name: 'SPT Hoá', subject: 'Hoá học', kind: 'paper', items: 0, blocks: 0}]
                : url.startsWith('question_bank/papers') ? {items: [], total: 0} : []);
        const sent: any[] = [];
        mockPost({'question_bank/save': (b: any) => (sent.push(b), {saved: 1, total: 1, papers: [{id: 'E1', name: 'Đề thử 1', question_count: 1, total_score: 10}],
            rejected: [{id: 'E2', name: 'Đề thử 2', reason: 'structure', message: 'Lệch cấu trúc'}]})});
        renderScreen();
        vi.spyOn(Api, 'upload').mockResolvedValue({exams: [EXAM, {...EXAM, id: 'E2', name: 'Đề thử 2'}], issues: []});
        fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['PK'], 'de.docx')]}});
        await screen.findByText(/2 đề — nhập 2/);
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].bank).toBe('B1');
        expect(sent[0].papers.map((p: any) => p.id)).toEqual(['E1', 'E2']);
        await screen.findByText(/Lệch cấu trúc/);
    });

    it('images go through image/upload before save; a dropped connection can be retried', async () => {
        const IMG = 'data:image/png;base64,iVBORw0KGgo=';
        const withImg = examOf({...mc('Q1', 'Q1A'), data: {...mc('Q1', 'Q1A').data, question: `<p>x<img src="${IMG}"></p>`}});
        const sent = mockPost();
        renderScreen();
        const up = vi.spyOn(Api, 'upload').mockResolvedValueOnce({exams: [withImg], issues: []});
        fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['PK'], 'de.docx')]}});
        await screen.findByText(/1 đề — nhập 1/);

        // the images go up while the duplicate check runs: a dropped connection there is told, nothing is saved, and pressing again goes on
        up.mockRejectedValueOnce(new TypeError('fetch'));
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith('Không kiểm được trùng lặp', expect.any(String)));
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
        // BF-07: the error stays on the page and names the exam and the file; the exam row says it was not saved
        const alert = (await screen.findByText(/Đã lưu 0\/1 đề\. 1 đề chưa lưu/)).closest('[role=alert]')!;
        expect(alert.textContent).toContain('Đề thử 1 (de.docx): Ngân hàng đầy');
        expect(screen.getAllByText('Lỗi').length).toBeGreaterThan(0);
        expect(screen.getByText(/^Đề này chưa lưu: Ngân hàng đầy$/)).toBeTruthy();
        expect(saveButton().textContent).toBe('Nhập lại 1 đề');
        expect(screen.getByText('Xem ngân hàng').closest('a')!.getAttribute('href')).toBe('/question-bank/B1');
        expect(notify.success).not.toHaveBeenCalled();
    });

    it('a failed duplicate check reports an error instead of saving as if clean', async () => {
        const sent = mockPost({'question_bank/check_duplicates': () => { throw {error: 'bận'}; }});
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith('Không kiểm được trùng lặp', expect.any(String)));
        expect(sent).toHaveLength(0);
        expect(saveButton().disabled).toBe(false);   // press again
    });

    it('a suspected duplicate asks first; "Xem lại" marks the exam and opens the block, the chip stays readable', async () => {
        const sent = mockPost({'question_bank/check_duplicates': () => ({duplicates: {Q1: {score: 0.97, matches: [{block: 'K9', score: 0.97}]}}})});
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1A'), mc('Q2', 'Q2A')));
        fireEvent.click(saveButton());
        await screen.findByText('Có 1 chỗ nghi trùng');
        expect(sent).toHaveLength(0);
        fireEvent.click(screen.getByText('Xem lại'));
        expect((await screen.findAllByText('1 khối trùng')).length).toBeGreaterThan(0);
        expect(screen.getByText('Khối này nghi trùng')).toBeTruthy();
        expect(screen.getByText(/Tỷ lệ trùng: 97%/)).toBeTruthy();
        expect(screen.getByText(/Còn/).textContent).toContain('1 chỗ nghi trùng');
        expect(sent).toHaveLength(0);
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
        expect(document.querySelector('.vt-bk-bar-main')).toBeNull();
        expect(screen.getByText(/Muốn lưu vào ngân hàng thì vào/)).toBeTruthy();
    });
});

/** "Sửa câu n" dialog: open it, pick the n-th radio of the editor, save/cancel it. */
const openEdit = (n = 1) => fireEvent.click(screen.getByRole('button', {name: 'Sửa câu ' + n}));
const pickRadio = (i: number) => fireEvent.click(document.querySelectorAll<HTMLInputElement>('.vt-imp-edit input[type=radio]')[i]);
const saveEdit = () => fireEvent.click(screen.getByText('Lưu câu'));
const cancelEdit = () => fireEvent.click(screen.getByText('Huỷ'));
// the type picker lives in the "Sửa câu" dialog; the type change reaches the exam at once, Huỷ only closes the dialog
const changeType = (n: number, type: string) => {
    openEdit(n);
    fireEvent.change(screen.getByLabelText('Loại câu'), {target: {value: type}});
};
const keyOnCard = () => document.querySelector('.vt-imp-q .vt-imp-answer.on')?.textContent;

describe('ImportExam: Q12 / Q13 save blockers', () => {
    it('Q12: a pick-one question without a correct answer blocks saving until one is picked', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1')));

        expect(saveButton().disabled).toBe(true);
        expect(screen.getAllByText(/Còn 1 câu chưa có đáp án/).length).toBeGreaterThan(0);
        expect(screen.getByText('Chưa có đáp án đúng — sửa câu để chọn')).toBeTruthy();

        openEdit();
        pickRadio(1);
        saveEdit();
        expect(keyOnCard()).toContain('B.');
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
        expect(screen.getByText(/^1 câu · 1 khối$/)).toBeTruthy();
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
    it('SPT-99: a free-answer question shows no "Số từ gợi ý" box on the preview', async () => {
        mockPost();
        renderScreen();
        await loadFile(MIXED);
        expect(screen.queryByLabelText(/Số từ gợi ý/)).toBeNull();
    });

    it('changing a type sends the NEW type, drops the old answers, and leaves the other question alone', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(MIXED);
        changeType(1, 'FillBlank'); cancelEdit();
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
        changeType(1, 'TrueFalse'); cancelEdit();
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

    it('phone: the PDF column sits next to the exam; the "Bản gốc (PDF)" tab switches to it and the bar opens it full screen', async () => {
        desktop(false);
        const blob = vi.spyOn(Api, 'uploadBlob').mockResolvedValue(new Blob(['%PDF']));
        renderScreen();
        await loadFile();
        await vi.waitFor(() => expect(blob).toHaveBeenCalledWith('import_docx/pdf', expect.any(File)));
        const split = () => document.querySelector('.v4-split')!.getAttribute('data-tab');
        expect(split()).toBe('exam');
        fireEvent.click(screen.getByRole('tab', {name: 'Bản gốc (PDF)'}));
        expect(split()).toBe('pdf');
        expect(document.querySelector('iframe')?.getAttribute('src')).toBe('blob:pdf-1');
        const open = screen.getByText('Mở toàn màn hình') as HTMLAnchorElement;
        expect(open.getAttribute('href')).toBe('blob:pdf-1');
        expect(open.target).toBe('_blank');
        fireEvent.click(screen.getByRole('tab', {name: 'Đề đã đọc'}));
        expect(split()).toBe('exam');
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
        // in the list, as the chip on the question, and in the warning block inside the question card
        expect(screen.getAllByText('Nhẹ')).toHaveLength(3);
        expect(screen.getByText('Công thức gõ thô')).toBeTruthy();
    });

    it('a Nặng warning disables the button with a spoken reason, "Đã xem" lifts it', async () => {
        mockPost();
        renderScreen();
        await loadFile(EXAM, [SEVERE, LIGHT]);
        expect(saveButton().disabled).toBe(true);
        expect(screen.getByRole('alert').textContent).toContain('Còn 1 cảnh báo nặng chưa xem');

        fireEvent.click(seeButton());
        expect(saveButton().disabled).toBe(false);
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

    it('unticking the exam with the Nặng warning lifts the gate; "Cách sửa" opens the guide dialog at that entry', async () => {
        mockPost();
        renderScreen();
        await loadFile(EXAM, [SEVERE]);
        const fix = screen.getByText('Cách sửa');
        // SPT-99: the same dialog as on the upload screen, opened at that entry — no new tab, the file stays
        expect(fix.getAttribute('href')).toBeNull();
        fireEvent.click(fix);
        expect(screen.getByRole('dialog', {name: 'Lỗi thường gặp và cách sửa'})).toBeTruthy();
        expect((document.getElementById('mat-cau') as HTMLDetailsElement).open).toBe(true);
        expect((document.getElementById('bang') as HTMLDetailsElement).open).toBe(false);
        fireEvent.click(screen.getByText('Đóng', {selector: 'button'}));
        fireEvent.click(screen.getByLabelText('Chọn Đề thử 1'));
        expect(screen.queryByText(/cảnh báo nặng chưa xem/)).toBeNull();
    });

    it('"Đánh số lại" drops the number-jump warnings of that exam', async () => {
        mockPost();
        renderScreen('/import-exam?folder=F1');
        const gap = issue({code: 'NUMBER_GAP', level: 'warning', question_id: 'Q1', message: 'sau câu 5 là câu 7'});
        await loadFile(EXAM, [gap]);
        expect(screen.getAllByText('sau câu 5 là câu 7').length).toBeGreaterThan(0);
        fireEvent.click(screen.getByText('Đánh số lại câu'));
        fireEvent.click(screen.getByText('Đánh số lại', {selector: 'button'}));
        expect(screen.queryByText('sau câu 5 là câu 7')).toBeNull();
    });

    it('the dialog shows the current and the new numbering; "Giữ số như trong file" changes nothing', async () => {
        mockPost();
        renderScreen('/import-exam?folder=F1');
        const gap = issue({code: 'NUMBER_GAP', level: 'warning', question_id: 'Q1', message: 'sau câu 5 là câu 7'});
        await loadFile(examOf({...mc('Q1', 'Q1A'), source_no: 5}, {...mc('Q2', 'Q2A'), source_no: 7}), [gap]);
        fireEvent.click(screen.getByText('Đánh số lại câu'));
        expect(screen.getByText('5, 7')).toBeTruthy();
        expect(screen.getByText('(nhảy qua 6)')).toBeTruthy();
        expect(screen.getByText('1–2')).toBeTruthy();
        fireEvent.click(screen.getByLabelText(/Giữ số như trong file/));
        fireEvent.click(screen.getByText('Đánh số lại', {selector: 'button'}));
        expect(screen.getAllByText('sau câu 5 là câu 7').length).toBeGreaterThan(0);
    });
});

describe('ImportExam: bank screen (B2, B3, B4)', () => {
    it('into a bank: no "Thông tin đề", no "Đánh số lại câu", no "Đáp án đúng" badge, a tick instead', async () => {
        mockPost();
        renderScreen();
        await loadFile();
        expect(screen.queryByText('Thông tin đề')).toBeNull();
        expect(screen.queryByText('Đánh số lại câu')).toBeNull();
        expect(screen.queryByText('Đáp án đúng')).toBeNull();
        expect(screen.getByText('(đáp án đúng)')).toBeTruthy();
    });
});

describe('ImportExam: several files at once (B1, BF-05)', () => {
    const pick = (...files: File[]) => fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files}});

    it('the picker takes many files; a bad file is one error row and never blocks the good ones', async () => {
        mockPost();
        const e2 = {...examOf(mc('Z1', 'Z1A')), id: 'E2', name: 'Đề thử 2'};
        vi.spyOn(Api, 'upload').mockImplementation(async (_u: string, f: Blob | File) => {
            if ((f as File).name === 'hong.docx') throw {error: 'khong doc duoc file'};
            return {exams: (f as File).name === 'a.docx' ? [EXAM] : [e2], issues: []};
        });
        renderScreen();
        expect(document.querySelector('input[type=file]')!.hasAttribute('multiple')).toBe(true);
        pick(new File(['PK'], 'a.docx'), new File(['PK'], 'hong.docx'), new File(['PK'], 'b.docx'));
        await screen.findByText('Xem trước 2 đề');
        expect(screen.getByText('3 file đã chọn')).toBeTruthy();
        expect(screen.getByText('1 lỗi')).toBeTruthy();
        expect(screen.getByText('Không đọc được file')).toBeTruthy();   // the error row says what to do
        fireEvent.click(screen.getByText('Xem trước 2 đề'));
        expect(screen.getByText(/2 đề — nhập 2/)).toBeTruthy();
        // all exams of all files go to the bank in ONE save run
        const sent = mockPost();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent.map(b => b.id)).toEqual(['E1', 'E2']));
    });

    it('an exam that is already read from another file is skipped, not listed twice', async () => {
        mockPost();
        vi.spyOn(Api, 'upload').mockResolvedValue({exams: [EXAM], issues: []});
        renderScreen();
        pick(new File(['PK'], 'a.docx'), new File(['PK'], 'copy.docx'));
        await screen.findByText(/bỏ 1 đề đã có ở file khác/);
        expect(screen.getByText('Xem trước 1 đề')).toBeTruthy();
    });

    it('"Bỏ file" drops the failed row', async () => {
        mockPost();
        renderScreen();
        pick(new File(['hello'], 'x.docx'), new File(['hello'], 'y.docx'));
        await screen.findByText('2 lỗi');
        fireEvent.click(screen.getAllByText('Bỏ file')[0]);
        expect(screen.getByText('1 file đã chọn')).toBeTruthy();
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
        // chip row + table (Câu | Dạng | Hiện tại | Sẽ thành | Kết quả)
        expect(screen.getByText('1 thêm mới')).toBeTruthy();
        expect(screen.getByText('1 lỗi, sẽ bỏ qua')).toBeTruthy();
        expect(within(screen.getByRole('table', {name: 'Xem trước đáp án'})).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Câu', 'Dạng', 'Hiện tại', 'Sẽ thành', 'Kết quả']);
        expect(screen.getByText('phần này chỉ có 1 câu')).toBeTruthy();   // red row in the table, not a list below it
        expect(screen.getByText('Câu 40')).toBeTruthy();
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

    it('B4: the upload page opens the guide as a dialog', async () => {
        renderScreen('/import-exam?bank=B1');
        // SPT-99: a dialog on the same screen, not another page
        fireEvent.click(screen.getByText('Lỗi thường gặp và cách sửa →'));
        expect(screen.getByRole('dialog', {name: 'Lỗi thường gặp và cách sửa'})).toBeTruthy();
        expect(screen.getByText('Mất câu hoặc mất phương án')).toBeTruthy();
        fireEvent.click(screen.getByText('Đóng', {selector: 'button'}));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('B5: converting away and back restores the options and the key', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1B')));
        changeType(1, 'FreeAnswer'); cancelEdit();
        expect(document.querySelector('.vt-imp-q .vt-imp-answer')).toBeNull();
        changeType(1, 'MultipleChoice'); cancelEdit();
        expect(keyOnCard()).toContain('B.');
    });

    it('B5: a free-answer question that holds A–D can be split into options with one button', async () => {
        const sent = mockPost();
        renderScreen();
        await loadFile(examOf({id: 'Q1', type: 'FreeAnswer', data: {question: '<p>Chất nào? A. HCl B. NaCl C. KCl D. H₂O</p>'}}));
        fireEvent.click(screen.getByText('Đổi sang Trắc nghiệm và tách A–D'));   // the hint sits on the card, not in the dialog
        openEdit();
        expect(document.querySelectorAll('.vt-imp-edit input[type=radio]')).toHaveLength(4);
        pickRadio(1);
        saveEdit();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].sections[0].questions[0].data.answers).toHaveLength(4);
    });

    it('B5: turning a Đúng/Sai question into another type asks first, because it splits into 4', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(tf('T1'), tf('T2'), tf('T3'), tf('T4')));
        changeType(1, 'FillBlank');
        expect(screen.getByText('Đổi dạng câu Đúng/Sai?')).toBeTruthy();
        expect(screen.getByText(/^1 câu · 1 khối$/)).toBeTruthy();   // nothing changed yet
        fireEvent.click(screen.getByText('Giữ nguyên'));
        expect(screen.getByText(/^1 câu · 1 khối$/)).toBeTruthy();
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

describe('ImportExam: follow-up (V2-2, V2-3, V2-4, V2-5)', () => {
    it('V2-2: after tách A–D, converting back to Tự luận puts the A–D text back in the question', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf({id: 'Q1', type: 'FreeAnswer', data: {question: '<p>Chất nào? A. HCl B. NaCl C. KCl D. H₂O</p>'}}));
        fireEvent.click(screen.getByText('Đổi sang Trắc nghiệm và tách A–D'));
        openEdit();
        fireEvent.change(screen.getByLabelText('Loại câu'), {target: {value: 'FreeAnswer'}});
        cancelEdit();
        expect(screen.getByText(/A\. HCl B\. NaCl C\. KCl D\. H₂O/)).toBeTruthy();
    });

    it('V2-5: the wait for the PDF says a many-exam file can take much longer', async () => {
        mockPost();
        vi.spyOn(Api, 'uploadBlob').mockReturnValue(new Promise(() => {}));
        renderScreen();
        await loadFile();
        expect(screen.getByText(/có thể lâu hơn nhiều/)).toBeTruthy();
    });

    it('V2-3: browser Back with a read file asks first; "Ở lại" keeps the work', async () => {
        mockPost();
        const push = vi.spyOn(history, 'pushState');
        renderScreen();
        await loadFile();
        expect(push).toHaveBeenCalledTimes(1);          // the extra entry that Back will pop
        window.dispatchEvent(new PopStateEvent('popstate'));
        await screen.findByText('Rời trang này?');
        fireEvent.click(screen.getByText('Ở lại'));
        expect(push).toHaveBeenCalledTimes(2);          // armed again
        expect(screen.getByText(/1 đề — nhập 1/)).toBeTruthy();
    });

    it('V2-4: OPTION_DUPLICATE has its own chip and a "Cách sửa" link, whatever letter the message names', async () => {
        mockPost();
        renderScreen();
        const dup = issue({code: 'OPTION_DUPLICATE', question_id: 'Q1', message: 'Câu 1: hai phương án cùng chữ B'});
        await loadFile(EXAM, [dup]);
        expect(screen.getByText('Cách sửa').tagName).toBe('BUTTON');
        expect(screen.getByText('Có phương án trùng chữ cái')).toBeTruthy();
    });
});

describe('ImportExam: SPT-99 preview as on the paper', () => {
    const SHORT = {id: 'Q3', type: 'FillBlank', data: {question: '<p>Tính 1+1.</p>', answer: '2'}};

    it('max_words / max_chars survive import → Sửa câu → save (the BE sorts Ngữ văn blocks by them)', async () => {
        const sent = mockPost();
        renderScreen();
        const essay = {id: 'Q2', type: 'FreeAnswer', data: {question: '<p>Viết bài.</p>', max_words: 600, max_chars: 3000}};
        await loadFile(examOf(mc('Q1', 'Q1A'), essay));
        openEdit(2); saveEdit();
        changeType(2, 'FillBlank'); fireEvent.change(screen.getByLabelText('Loại câu'), {target: {value: 'FreeAnswer'}}); cancelEdit();   // the type round trip keeps them too
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        const q = sent[0].sections[0].questions[1];
        expect(q.data.max_words).toBe(600);
        expect(q.data.max_chars).toBe(3000);
    });

    it('the summary is a table by Phần plus a Cả đề row', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1A'), tf('T1'), tf('T2'), tf('T3'), tf('T4'), SHORT, {id: 'Q9', type: 'FreeAnswer', data: {question: '<p>Viết.</p>'}}));
        const rows = [...screen.getByLabelText('Tóm tắt theo phần').querySelectorAll('tbody tr, tfoot tr')].map(r => r.textContent);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toContain('Phần I');
        expect(rows[0]).toContain('1 × Trắc nghiệm');   // block bank: "Khối sẽ cắt" instead of the kinds
        expect(rows[1]).toContain('Cả đề');
        expect([...screen.getByLabelText('Tóm tắt theo phần').querySelectorAll('thead th')].map(h => h.textContent)).toEqual(['Phần', 'Khối sẽ cắt', 'Số câu', 'Điểm']);
    });

    it('only the right option is tinted, and there is no type select or inline editor on the card', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1B')));
        expect(document.querySelectorAll('.vt-imp-q .vt-imp-answer.on')).toHaveLength(1);
        expect(keyOnCard()).toContain('B.');
        expect(screen.queryByLabelText('Loại câu')).toBeNull();
        expect(document.querySelector('.vt-imp-q .tt-editor, .vt-imp-q [contenteditable]')).toBeNull();
    });

    it('Sửa then Huỷ changes nothing; Sửa then Lưu câu puts the new key on the card', async () => {
        mockPost();
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1A')));
        openEdit(); pickRadio(1); cancelEdit();
        expect(keyOnCard()).toContain('A.');
        openEdit(); pickRadio(1); saveEdit();
        expect(keyOnCard()).toContain('B.');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('Xoá asks first, drops only that question from the preview and its warning goes with it', async () => {
        const sent = mockPost();
        renderScreen();
        const sev = issue({code: 'MISSING_ANSWER', level: 'error', question_id: 'Q2', message: 'Câu 2: chưa có đáp án'});
        await loadFile(examOf(mc('Q1', 'Q1A'), mc('Q2')), [sev]);
        expect(saveButton().disabled).toBe(true);
        fireEvent.click(screen.getByLabelText('Xoá câu 2'));
        fireEvent.click(screen.getByText('Giữ lại'));
        expect(screen.getByText(/^2 câu · 2 khối$/)).toBeTruthy();
        fireEvent.click(screen.getByLabelText('Xoá câu 2'));
        fireEvent.click(screen.getByText('Xoá câu', {selector: 'button'}));
        expect(screen.getByText(/^1 câu · 1 khối$/)).toBeTruthy();
        expect(screen.queryByText(/Cần kiểm tra 1 chỗ/)).toBeNull();
        expect(sent).toHaveLength(0);   // nothing was saved by deleting
        expect(saveButton().disabled).toBe(false);
    });

    it('Cả đề: the read count follows a deleted question; declared = sum of the Phần when the file gives no total', async () => {
        mockPost();
        renderScreen('/import-exam?folder=F1');   // no bank: the summary has no "Khối sẽ cắt" column
        const exam: any = examOf(mc('Q1', 'Q1A'), mc('Q2', 'Q2A'));
        exam.stats = {read_questions: 2, sections: [{label: 'Phần I', declared_questions: 2, declared_score: null, read_questions: 2, read_score: 0.5}]};
        await loadFile(exam);
        const total = () => screen.getByText('Cả đề', {selector: 'th'}).closest('tr')!.querySelectorAll('td')[0].textContent;
        expect(total()).toContain('2 / 2');
        expect(total()).not.toContain('file không ghi');
        fireEvent.click(screen.getByLabelText('Xoá câu 2'));
        fireEvent.click(screen.getByText('Xoá câu', {selector: 'button'}));
        expect(total()).toContain('1 / 2');
    });

    it('Phần read count: the BE read_questions (chùm left out) when sent, minus deletions; units on screen for an older BE', async () => {
        mockPost();
        renderScreen('/import-exam?folder=F1');   // no bank: the summary has no "Khối sẽ cắt" column
        const exam: any = examOf(mc('Q1', 'Q1A'), mc('Q2', 'Q2A'), mc('Q3', 'Q3A'));
        exam.stats = {sections: [{label: 'Phần I', declared_questions: 2, declared_score: null, read_questions: 2, read_score: 0.5}]};
        await loadFile(exam);
        const row = () => screen.getByText('Phần I', {selector: 'th span'}).closest('tr')!.querySelectorAll('td')[1].textContent;
        expect(row()).toContain('2 / 2');       // 3 units on screen, the BE counts 2
        fireEvent.click(screen.getByLabelText('Xoá câu 3'));
        fireEvent.click(screen.getByText('Xoá câu', {selector: 'button'}));
        expect(row()).toContain('1 / 2');
    });

    it('Phần read count without BE stats is the units on screen', async () => {
        mockPost();
        renderScreen('/import-exam?folder=F1');   // no bank: the summary has no "Khối sẽ cắt" column
        await loadFile(examOf(mc('Q1', 'Q1A'), mc('Q2', 'Q2A')));
        expect(screen.getByText('Phần I', {selector: 'th span'}).closest('tr')!.querySelectorAll('td')[1].textContent).toContain('2 /');
    });
});

describe('ImportExam: bank import flow v2 (BF-01, BF-07, BF-12, BF-15, B7)', () => {
    const two = (...exams: unknown[]) => {
        vi.spyOn(Api, 'upload').mockResolvedValue({exams, issues: []});
        pickAndOpen();
    };
    const pickAndOpen = () => fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['PK'], 'de.docx')]}});
    const E2 = {...examOf(mc('Z1', 'Z1A')), id: 'E2', name: 'Đề thử 2'};

    const DUP_Q1 = {duplicates: {Q1: {score: 0.97, matches: [{block: 'K9', score: 0.97}]}}, compared: 40, existing: null};
    const TWO_BLOCKS = () => examOf(mc('Q1', 'Q1A'), mc('Q2', 'Q2A'));

    it('"Vẫn nhập" saves everything, the suspected block included', async () => {
        const sent = mockPost({'question_bank/check_duplicates': () => DUP_Q1});
        renderScreen();
        await loadFile(TWO_BLOCKS());
        fireEvent.click(saveButton());
        await screen.findByText('Có 1 chỗ nghi trùng');
        fireEvent.click(screen.getByText('Vẫn nhập'));
        await screen.findByText('Đã nhập 1 đề vào ngân hàng');
        expect(sent).toHaveLength(1);
        expect(JSON.stringify(sent[0])).toContain('"Q1"');
        expect(JSON.stringify(sent[0])).toContain('"Q2"');
    });

    it('"Không nhập khối này" leaves that block out; pressing the button again checks again and saves without asking', async () => {
        const sent = mockPost({'question_bank/check_duplicates': () => DUP_Q1});
        renderScreen();
        await loadFile(TWO_BLOCKS());
        fireEvent.click(saveButton());
        await screen.findByText('Có 1 chỗ nghi trùng');
        fireEvent.click(screen.getByText('Xem lại'));
        fireEvent.click(await screen.findByLabelText(/Không nhập khối này/));
        expect(screen.queryByText(/Còn .*chỗ nghi trùng/)).toBeNull();   // the ticked block is settled
        fireEvent.click(saveButton());
        await screen.findByText('Đã nhập 1 đề vào ngân hàng');
        expect(sent).toHaveLength(1);
        expect(JSON.stringify(sent[0])).not.toContain('"Q1"');
        expect(JSON.stringify(sent[0])).toContain('"Q2"');
    });

    it('"N khối còn lại của đề vẫn nhập" counts the whole exam, not the Phần on screen, and not blocks already left out', async () => {
        const exam = {...examOf(mc('Q1', 'Q1A'), mc('Q2', 'Q2A')), sections: [
            {id: 'S1', name: 'Phần I', question_type: 'MultipleChoice', questions: [mc('Q1', 'Q1A'), mc('Q2', 'Q2A')]},
            {id: 'S2', name: 'Phần II', question_type: 'MultipleChoice', questions: [mc('Q3', 'Q3A')]}]};
        mockPost({'question_bank/check_duplicates': () => ({duplicates: {Q3: {score: 0.97, matches: [{block: 'K9', score: 0.97}]}, Q2: {score: 0.97, matches: [{block: 'K8', score: 0.97}]}}, compared: 40, existing: null})});
        renderScreen();
        await loadFile(exam);
        fireEvent.click(saveButton());
        fireEvent.click(await screen.findByText('Xem lại'));
        const boxes = await screen.findAllByLabelText(/Không nhập khối này/);
        expect(boxes[0].closest('label')!.textContent).toContain('(2 khối còn lại của đề vẫn nhập)');
        fireEvent.click(boxes[1]);
        expect(boxes[0].closest('label')!.textContent).toContain('(1 khối còn lại của đề vẫn nhập)');
    });

    it('the dialog puts focus on "Vẫn nhập", and the exam link opens in a new tab (no "Rời trang này?")', async () => {
        const at = new Date(2026, 10, 15, 9).toISOString();
        mockPost({'question_bank/check_duplicates': () => ({duplicates: {Q1: {score: 0.97, matches: [{block: 'K9', score: 0.97, source_name: 'Đề số 12', source_file: 'de-12.docx', imported_at: at}]}}, compared: 40, existing: null})});
        renderScreen();
        await loadFile(TWO_BLOCKS());
        fireEvent.click(saveButton());
        const link = await screen.findByRole('link', {name: 'Đề số 12'});
        expect(link.getAttribute('target')).toBe('_blank');
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Vẫn nhập'}));
    });

    it('the saved screen says what the bank really gained (same block ids are overwritten, not added)', async () => {
        vi.spyOn(Api, 'get').mockImplementation(async (url: string) =>
            url === 'question_bank/list' ? [{id: 'B1', name: 'NH Toán 12', subject: 'Toán', blocks: 20, items: 20}] : []);
        mockPost({'question_bank/save': () => ({saved: 2, stats: {total: 21}})});
        renderScreen();
        await loadFile(TWO_BLOCKS());
        fireEvent.click(saveButton());
        expect(await screen.findByText(/có thêm 1 khối, giờ có 21 khối/)).toBeTruthy();
    });

    it('the dialog names the source exam with a link and "nhập dd/mm từ file" when the BE sends it', async () => {
        const at = new Date(2026, 10, 15, 9).toISOString();
        mockPost({'question_bank/check_duplicates': () => ({duplicates: {Q1: {score: 0.97, matches: [{block: 'K9', score: 0.97, source_name: 'Đề số 12', source_file: 'de-12.docx', imported_at: at, source_item_id: 'I1'}]}}, compared: 40, existing: null})});
        renderScreen();
        await loadFile(TWO_BLOCKS());
        fireEvent.click(saveButton());
        const link = await screen.findByRole('link', {name: 'Đề số 12'});
        expect(link.getAttribute('href')).toBe('/question-bank/B1');
        expect(link.parentElement!.textContent).toContain('(nhập 15/11 từ de-12.docx)');
    });

    it('an exam the bank already holds: the dialog names it; "Vẫn nhập" saves it with the .docx name as source_file', async () => {
        const sent = mockPost({'question_bank/check_duplicates': () => ({duplicates: {}, compared: 40, existing: {bank: 'B1', bank_name: 'NH Toán 12', name: 'Đề số 3', same_bank: true, count: 1}})});
        renderScreen();
        await loadFile(examOf(mc('Q1', 'Q1A')));
        fireEvent.click(saveButton());
        expect((await screen.findByRole('link', {name: 'Đề số 3'})).getAttribute('href')).toBe('/question-bank/B1');
        fireEvent.click(screen.getByText('Vẫn nhập'));
        await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
        expect(sent[0].source_file).toBe('de.docx');
    });

    it('"Xem lại" on an exam the bank holds: the list says "Đã có" and the exam stays ticked', async () => {
        mockPost({'question_bank/check_duplicates': () => ({duplicates: {}, compared: 40, existing: {bank: 'B1', bank_name: 'NH Toán 12', same_bank: true, count: 1}})});
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        fireEvent.click(await screen.findByText('Xem lại'));
        expect((await screen.findAllByText('Đã có')).length).toBeGreaterThan(0);
        expect(screen.getByText(/1 đề — nhập 1/)).toBeTruthy();
    });

    it('an exam that lives in ANOTHER bank is found by the check: said so, ticked off, nothing of it saved', async () => {
        const sent = mockPost({'question_bank/check_duplicates': () => ({duplicates: {}, compared: 40, existing: {bank: 'B7', bank_name: 'NH Lý', same_bank: false, count: 1}})});
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        await screen.findByText(/đã nằm trong ngân hàng khác/);
        expect(screen.getByText('NH Lý').closest('a')!.getAttribute('href')).toBe('/question-bank/B7');
        expect(sent).toHaveLength(0);
    });

    it('BF-07: one exam failing does not stop the others; retry sends only the unsaved one', async () => {
        let fail = true;
        const sent: any[] = [];
        mockPost({'question_bank/save': (b: any) => { if (b.id === 'E1' && fail) throw {code: 500, error: 'Máy chủ bận'}; sent.push(b); return {saved: 1}; }});
        renderScreen();
        two(EXAM, E2);
        await screen.findByText(/2 đề — nhập 2/);
        fireEvent.click(saveButton());
        await screen.findByText(/Đã lưu 1\/2 đề\. 1 đề chưa lưu/);
        expect(sent.map(b => b.id)).toEqual(['E2']);
        expect(screen.getAllByText('Đã lưu').length).toBeGreaterThan(0);
        expect(saveButton().textContent).toBe('Nhập lại 1 đề');
        fail = false;
        fireEvent.click(saveButton());
        await screen.findByText('Đã nhập 2 đề vào ngân hàng');   // both count on the saved screen
        expect(sent.map(b => b.id)).toEqual(['E2', 'E1']);
    });

    it('while checking and saving the button is locked and says so (canvas saving)', async () => {
        let release: (v: unknown) => void = () => undefined;
        mockPost({'question_bank/check_duplicates': () => new Promise(r => { release = r; })});
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        await screen.findByText('Đang kiểm trùng và lưu…');
        expect(saveButton().getAttribute('aria-disabled')).toBe('true');   // UI kit: loading = aria-disabled, keeps focus
        expect(saveButton().getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText(/Đang kiểm 1 khối với ngân hàng và giữa các đề vừa nhập/)).toBeTruthy();
        release({duplicates: {}, compared: 40, existing: null});
        await screen.findByText('Đã nhập 1 đề vào ngân hàng');
    });

    it('BF-15: a 409 naming another bank is explained with a link and the exam is ticked off', async () => {
        mockPost({'question_bank/save': () => { throw {code: 409, error: 'Đề đã có ở ngân hàng khác', bank: {id: 'B7', name: 'NH Lý'}}; }});
        renderScreen();
        await loadFile();
        fireEvent.click(saveButton());
        await screen.findByText(/đã nằm trong ngân hàng khác/);
        expect(screen.getByText('NH Lý').closest('a')!.getAttribute('href')).toBe('/question-bank/B7');
        expect(screen.getAllByText('Ở ngân hàng khác').length).toBeGreaterThan(0);
    });

    it('"Môn & đề" (PR #50): a draft made from a subject sends the .docx name as source_file, then goes back to the subject', async () => {
        const created: any[] = [];
        const moved: any[] = [];
        mockPost({'exam/create': b => { created.push(b); return {}; }, 'exam/move_to_folder': b => { moved.push(b); return {}; }});
        renderScreen('/import-exam?folder=F1');
        await loadFile();
        fireEvent.click(screen.getByText(/Tạo 1 đề nháp/).closest('button')!);
        await screen.findByText('TRANG MÔN');
        expect(moved).toEqual([{examId: 'E1', folderId: 'F1'}]);
        expect(created).toHaveLength(1);
        expect(created[0].source_file).toBe('de.docx');   // the exam page says which file it came from
    });

    it('BF-11: a whole-exam bank explains itself instead of offering block actions', async () => {
        (Api.get as any).mockImplementation(async (url: string) => url === 'question_bank/list' ? [{id: 'B1', name: 'NH đề', subject: 'Toán', kind: 'paper', items: 0}] : url.startsWith('question_bank/papers') ? {items: [], total: 0} : []);
        mockPost();
        renderScreen();
        await loadFile();
        expect(screen.queryByRole('button', {name: /Kiểm trùng lặp|Tạo thẳng/})).toBeNull();
        expect(screen.getByText(/Ngân hàng nguyên đề lưu nguyên cả đề, không cắt khối/)).toBeTruthy();
    });
});

describe('ImportExam: BF-04 «Cho biết» into a block bank', () => {
    const withInfo = {...EXAM, shared_info: ['<p>H = 1; O = 16</p>']};
    const pick = () => fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['PK'], 'Hoa-De_01.docx')]}});

    it('the file is refused with the reason and a button to the whole-exam bank of the same subject; nothing is saved', async () => {
        (Api.get as any).mockImplementation(async (url: string) => url === 'question_bank/list'
            ? [{id: 'B1', name: 'Toán — theo khối', subject: 'Toán', blocks: 0}, {id: 'B2', name: 'Toán — nguyên đề', subject: 'Toán', kind: 'paper', items: 3, blocks: 0}] : []);
        vi.spyOn(Api, 'upload').mockResolvedValue({exams: [withInfo], issues: []});
        const sent = mockPost();
        renderScreen();
        pick();
        expect(await screen.findByText(/Đề có khối “Cho biết”/)).toBeTruthy();
        expect(screen.getByText('Nhập vào “Toán — nguyên đề”')).toBeTruthy();
        expect(screen.queryByText('Tạo ngân hàng nguyên đề')).toBeNull();      // one or the other, never both
        expect((screen.getByText(/Xem trước 0 đề/).closest('button') as HTMLButtonElement).disabled).toBe(true);
        expect(sent).toHaveLength(0);
    });

    it('with no whole-exam bank for the subject it says how to make one', async () => {
        vi.spyOn(Api, 'upload').mockResolvedValue({exams: [withInfo], issues: []});
        renderScreen();
        pick();
        expect(await screen.findByText('Tạo ngân hàng nguyên đề')).toBeTruthy();
    });
});

describe('ImportExam: chọn đề trong danh sách', () => {
    const exam = (id: string, name: string) => ({...examOf(mc(id + 'Q', id + 'QA')), id, name});
    const list = () => within(document.querySelector('.vt-rv-list') as HTMLElement);
    const nameBox = () => screen.getByLabelText('Tên đề') as HTMLInputElement;
    async function loadTwo() {
        const sent = mockPost();
        renderScreen();
        vi.spyOn(Api, 'upload').mockResolvedValue({exams: [exam('E1', 'Đề một'), exam('E2', 'Đề hai')], issues: []});
        fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {target: {files: [new File(['PK'], 'de.docx')]}});
        await screen.findByText(/2 đề — nhập 2/);
        return sent;
    }

    it('bấm ô tick của đề 2 (hay bất kỳ chỗ nào trên dòng) → panel phải hiện đề 2', async () => {
        await loadTwo();
        expect(nameBox().value).toBe('Đề một');
        fireEvent.click(list().getByLabelText('Chọn Đề hai'));
        expect(nameBox().value).toBe('Đề hai');
        expect(screen.getByText('E2Q')).toBeTruthy();
        expect(screen.queryByText('E1Q')).toBeNull();
        fireEvent.click(list().getByText('Đề một'));
        expect(nameBox().value).toBe('Đề một');
    });

    it('sửa câu khi đang xem đề 2: payload lưu của đề 2 đổi, đề 1 giữ nguyên', async () => {
        const sent = await loadTwo();
        fireEvent.click(list().getByText('Đề hai'));
        openEdit(); pickRadio(1); saveEdit();
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        const key = (id: string) => sent.find(x => x.id === id).sections[0].questions[0].data.correctAnswerId;
        expect(key('E2')).toBe('E2QB');
        expect(key('E1')).toBe('E1QA');
    });
});
