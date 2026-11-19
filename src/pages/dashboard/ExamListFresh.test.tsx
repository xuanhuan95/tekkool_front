import {afterEach, expect, it, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Dashboard from './Dashboard';
import {mockApi} from '../manage/testutil';
import {useAuthStore} from '../../stores/authStore';

afterEach(() => vi.restoreAllMocks());

function open(state?: unknown) {
    window.matchMedia = ((q: string) => ({matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn()})) as never;
    useAuthStore.setState({user: {group: 'teacher'}} as never);
    mockApi({
        'folder/list': [{id: 'S1', name: 'Ngữ văn'}],
        'exam/list': [{id: 'E1', name: 'Đề cũ', status: 'published'}, {id: 'E2', name: 'Nháp cũ', status: 'draft'}, {id: 'E3', name: 'Đề mới', status: 'draft'}],
    });
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[{pathname: '/subject/S1', state}]}>
            <Routes><Route path='/subject/:subjectId' element={<Dashboard/>}/></Routes>
        </MemoryRouter>
    </QueryClientProvider>);
}

it('after "Tạo thẳng đề nháp" the subject opens on Nháp, new exams first and marked "Mới tạo"', async () => {
    open({created: ['E3']});
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0].textContent).toMatch(/Đề mới.*Mới tạo/);
    expect(rows).toHaveLength(2);                          // Nháp filter: the published one is hidden
    expect(screen.getAllByText('Mới tạo')).toHaveLength(1);
});

it('shows the "Đã tạo N đề nháp" banner only when exams were just created', async () => {
    open({created: ['E3']});
    const banner = (await screen.findByText('Đã tạo 1 đề nháp trong Ngữ văn')).closest('[role=status]')!;
    expect(banner.textContent).toMatch(/Xuất bản từng đề/);
});

it('after "Tạo đề" from a bank the strip names the exam and offers Làm thử / Xuất bản', async () => {
    open({created: ['E3'], createdName: 'Đề luyện — theo Đề số 3'});
    const strip = (await screen.findByText('Đã tạo “Đề luyện — theo Đề số 3” (Nháp)')).closest('[role=status]') as HTMLElement;
    expect(strip.textContent).toMatch(/Bấm “Làm thử” để xem một lần rút/);
    expect(within(strip).getByRole('link', {name: 'Làm thử'}).getAttribute('href')).toBe('/do-exam/E3?lam_lai=1');
    expect(within(strip).getByRole('button', {name: 'Xuất bản'})).toBeTruthy();
});

it('no banner when opening the subject normally', async () => {
    open();
    await screen.findByRole('table');
    expect(screen.queryByText(/Đã tạo \d+ đề nháp/)).toBeNull();
});

it('opening the subject normally shows all exams with no "Mới tạo"', async () => {
    open();
    await screen.findByRole('table');
    expect(screen.queryByText('Mới tạo')).toBeNull();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
});
