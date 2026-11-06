import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Dashboard, {SubjectCard, examCountText} from './Dashboard';
import {mockApi, renderAt} from '../manage/testutil';
import {useAuthStore} from '../../stores/authStore';

describe('examCountText', () => {
    it.each([
        [{exam_count: 0, draft_count: 0}, 'Chưa có đề'],
        [{exam_count: 3, draft_count: 0}, '3 đề'],
        [{exam_count: 5, draft_count: 2}, '5 đề · 2 nháp'],
        [{exam_count: 2}, '2 đề'],
        [{}, null], // old BE: no field -> no line, never a wrong "Chưa có đề"
    ])('%j -> %s', (f, want) => expect(examCountText(f)).toBe(want));
});

describe('SubjectCard', () => {
    it('shows the count line, empty style for 0, nothing when the field is missing', () => {
        window.matchMedia = (() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})) as any;
        const {container} = renderAt(<>
            <SubjectCard subject={{id: 'a', name: 'Toán', exam_count: 5, draft_count: 2}} active={false}/>
            <SubjectCard subject={{id: 'b', name: 'Lí', exam_count: 0, draft_count: 0}} active={false}/>
            <SubjectCard subject={{id: 'c', name: 'Văn'}} active={false}/>
        </>);
        const metas = [...container.querySelectorAll('.vt-th-subject-meta')];
        expect(metas.map(m => m.textContent)).toEqual(['5 đề · 2 nháp', 'Chưa có đề']);
        expect(metas[1].className).toContain('vt-th-subject-meta--empty');
    });
});

describe('Môn & đề: counts refresh after an action', () => {
    afterEach(() => useAuthStore.setState({user: null}));
    it('duplicate -> folder/list is refetched and the card shows the new number', async () => {
        useAuthStore.setState({user: {group: 'teacher'}} as any);
        window.matchMedia = (() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})) as any;
        let n = 1;
        const {post} = mockApi(
            {
                'folder/list': () => [{id: 's1', name: 'Toán', exam_count: n, draft_count: n}],
                'exam/list': [{id: 'e1', name: 'Đề 1', status: 'draft'}],
            },
            {'exam/duplicate': () => { n = 2; return {}; }});
        render(
            <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
                <MemoryRouter initialEntries={['/subject/s1']}>
                    <Routes><Route path='/subject/:subjectId' element={<Dashboard/>}/></Routes>
                </MemoryRouter>
            </QueryClientProvider>);
        await screen.findByText('1 đề · 1 nháp');
        fireEvent.click(await screen.findByRole('button', {name: 'Nhân bản'}));
        await waitFor(() => expect(post).toHaveBeenCalled());
        await screen.findByText('2 đề · 2 nháp');
    });
});
