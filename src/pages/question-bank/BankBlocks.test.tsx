import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import BankBlocks, {deleteQuestion} from './BankBlocks';
import {mockApi} from '../manage/testutil';

afterEach(() => vi.restoreAllMocks());

const choice = {id: 'q1', type: 'MultipleChoice', data: {question: '<p>1 + 1 = ?</p>', correctAnswerId: 'a2',
    answers: [{id: 'a1', value: '1'}, {id: 'a2', value: '2'}], explanation: '<p>Cộng.</p>'}};
const single = {id: 'S1', block_type: 'TracNghiem', block_type_name: 'Trắc nghiệm chọn đáp án', question_type: 'MultipleChoice', count: 1, passage: null, questions: [choice]};
const group = {id: 'S2', block_type: 'DocHieu', block_type_name: 'Đọc hiểu', question_type: 'MultipleChoice', count: 5, passage: '<p>Văn bản dài</p>',
    questions: [choice, {...choice, id: 'q2'}]};
const page = (blocks: unknown[], total = blocks.length) => ({total, page: 1, per_page: 20, blocks});

const renderScreen = () => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={['/question-bank/B1']}>
            <Routes><Route path='/question-bank/:bankId' element={<BankBlocks/>}/></Routes>
        </MemoryRouter>
    </QueryClientProvider>);

describe('BankBlocks (SPT-73)', () => {
    it('confirm wording: single question vs passage + N questions vs true/false', () => {
        expect(deleteQuestion(single as any)).toBe('Xoá câu này?');
        expect(deleteQuestion(group as any)).toBe('Xoá văn bản này và 5 câu đi kèm?');
        expect(deleteQuestion({...group, block_type: 'DungSai', count: 4} as any)).toBe('Xoá câu đúng/sai này (4 ý)?');
    });

    it('shows the key marked, the passage and no source-exam info; query carries bank/page/per_page', async () => {
        const api = mockApi({'question_bank/list': [{id: 'B1', name: 'NH Toán', subject: 'Toán', blocks: 2}], 'question_bank/blocks': page([single, group])});
        renderScreen();
        await screen.findAllByText('Đáp án đúng');
        expect(screen.getByText('Văn bản dài')).toBeTruthy();
        expect(screen.getAllByText('Đáp án đúng').length).toBe(3);
        expect(api.get).toHaveBeenCalledWith('question_bank/blocks?bank=B1&page=1&per_page=20');
    });

    it('type filter goes back to page 1 and sends block_type', async () => {
        const api = mockApi({'question_bank/list': [], 'question_bank/blocks': page([single])});
        renderScreen();
        await screen.findAllByText('Đáp án đúng');
        fireEvent.change(screen.getByLabelText('Dạng khối'), {target: {value: 'DocHieu'}});
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('question_bank/blocks?bank=B1&page=1&per_page=20&block_type=DocHieu'));
    });

    it('delete: asks with the count, posts the id, and a 404 counts as already deleted', async () => {
        const api = mockApi({'question_bank/list': [], 'question_bank/blocks': page([group])},
            {'question_bank/delete_block': () => { throw {code: 404, error: 'Khối không còn trong ngân hàng'}; }});
        renderScreen();
        await screen.findByText('Văn bản dài');
        fireEvent.click(screen.getByRole('button', {name: 'Xoá khối Đọc hiểu'}));
        await screen.findByText('Xoá văn bản này và 5 câu đi kèm?');
        fireEvent.click(screen.getByRole('button', {name: 'Xoá'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('question_bank/delete_block', {id: 'S2'}));
        // dialog closes + list reloaded (second blocks call)
        await waitFor(() => expect(screen.queryByText('Xoá văn bản này và 5 câu đi kèm?')).toBeNull());
        expect(api.get.mock.calls.filter(c => String(c[0]).startsWith('question_bank/blocks')).length).toBeGreaterThan(1);
    });

    it('error state shows the real reason', async () => {
        mockApi({'question_bank/list': [], 'question_bank/blocks': () => new Error('Bạn không có quyền')});
        renderScreen();
        expect(await screen.findByText('Bạn không có quyền')).toBeTruthy();
    });
});
