import {beforeEach, describe, expect, it, vi} from 'vitest';
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

async function loadFile(exam: unknown = EXAM) {
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [exam], warnings: []});
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, {target: {files: [new File(['x'], 'de.docx')]}});
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
        expect(screen.getByText(/Tỷ lệ trùng: 97.00%/)).toBeTruthy();
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
