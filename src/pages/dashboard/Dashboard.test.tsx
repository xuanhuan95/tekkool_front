import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {notify} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {mockApi} from '../manage/testutil';
import Dashboard from './Dashboard';
import {examCountText} from './SubjectList';

afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState({user: null}); });

const FOLDERS = [
    {id: 'S1', name: 'Toán', exam_count: 2, draft_count: 1},
    {id: 'S2', name: 'Ngữ văn', exam_count: 2, draft_count: 1},
    {id: 'S3', name: 'Hoá học', exam_count: 1, draft_count: 0, hidden: true},
    {id: 'S4', name: 'Lịch sử', exam_count: 0, draft_count: 0},
];
const EXAMS: Record<string, unknown[]> = {
    S1: [{id: 'T1', name: 'Toán — Đề 1', status: 'published', source: 'word', source_file: 'de1.docx', question_count: 22, points_total: 10, duration: 90,
          updated_at: '2026-11-10T03:00:00Z', submission_count: 40, has_submissions: true},
         {id: 'T2', name: 'Toán — Đề nháp', status: 'draft', source: 'web', question_count: 5, points_total: 2.5, duration: 0, updated_at: '2026-11-11T03:00:00Z', submission_count: 0}],
    S2: [{id: 'V2', name: 'Văn — Đề rút', status: 'draft', source: 'bank', bank_names: ['Ngân hàng Văn'], question_count: 12, points_total: 10, approx: true, duration: 90,
          updated_at: '2026-11-19T03:00:00Z', submission_count: 0},
         {id: 'V1', name: 'Văn — Đề cũ', status: 'published', question_count: 10, source: null, updated_at: null, has_submissions: false}],
    S3: [{id: 'H1', name: 'Hoá — Đề 1', status: 'published', source: 'word', updated_at: '2026-11-05T03:00:00Z', submission_count: 3, has_submissions: true}],
    S4: [],
};

function Where() { const l = useLocation(); return <p data-testid='where'>{l.pathname}</p>; }

function open(path: string, o: {desktop?: boolean; state?: unknown; posts?: Record<string, unknown>; folders?: unknown} = {}) {
    const desktop = o.desktop ?? true;
    window.matchMedia = ((q: string) => ({matches: q.includes('1024') ? desktop : false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn()})) as never;
    useAuthStore.setState({user: {group: 'teacher'}} as never);
    const api = mockApi({
        'folder/list': o.folders ?? FOLDERS,
        'exam/list': (p: string) => EXAMS[p.split('=')[1]] || [],
        'exam/to_grade': [],
    }, o.posts || {});
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={[{pathname: path, state: o.state}]}>
            <Where/>
            <Routes><Route path='/' element={<Dashboard/>}/><Route path='/subject/:subjectId' element={<Dashboard/>}/></Routes>
        </MemoryRouter>
    </QueryClientProvider>);
    return api;
}

describe('examCountText', () => {
    it.each([
        [{exam_count: 0, draft_count: 0}, 'Chưa có đề'],
        [{exam_count: 3, draft_count: 0}, '3 đề'],
        [{exam_count: 5, draft_count: 2}, '5 đề · 2 nháp'],
        [{}, null], // old BE: no field -> no line, never a wrong "Chưa có đề"
    ])('%j -> %s', (f, want) => expect(examCountText(f)).toBe(want));
});

describe('desktop: master–detail', () => {
    it('/ opens the subject holding the most recently updated exam, and the URL becomes /subject/:id', async () => {
        open('/');
        expect(await screen.findByRole('heading', {name: 'Ngữ văn'})).toBeTruthy();
        expect(screen.getByTestId('where').textContent).toBe('/subject/S2');
        const nav = screen.getByRole('navigation', {name: 'Môn'});
        expect(within(nav).getByRole('link', {name: /Ngữ văn/}).getAttribute('aria-current')).toBe('page');
        expect(within(nav).getByRole('link', {name: /Toán/}).textContent).toContain('2 đề · 1 nháp');
        expect(within(nav).getByRole('link', {name: /Hoá học/}).textContent).toContain('Đang ẩn');
    });

    it('rows say how the exam was made, its numbers, and the submission count', async () => {
        open('/subject/S2');
        await screen.findByRole('link', {name: 'Văn — Đề rút'});
        const rows = screen.getAllByRole('listitem').filter(li => li.className.includes('vt-th-exam'));
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toMatch(/Văn — Đề rút.*Nháp.*Rút từ ngân hàng/);
        expect(rows[0].textContent).toMatch(/ngân hàng Ngân hàng Văn · mỗi học sinh một đề khác/);
        expect(rows[0].textContent).toContain('~12 câu · 10 điểm · 90 phút');
        expect(rows[0].textContent).toContain('chưa có bài nộp');
        expect(rows[0].textContent).toMatch(/cập nhật (\d\d\/\d\d|hôm qua|hôm nay)/);
        // an old exam: no source label, no "cập nhật" (no date), still opens
        expect(rows[1].textContent).not.toMatch(/Nhập từ Word|Tự soạn|Rút từ ngân hàng|cập nhật/);
        expect(within(rows[0]).getByRole('link', {name: 'Văn — Đề rút'}).getAttribute('href')).toBe('/exam/V2');
    });

    it('main action on the row: Xuất bản only for a draft; it posts and refreshes', async () => {
        const api = open('/subject/S1', {posts: {'exam/publish': {}}});
        const draft = (await screen.findByRole('link', {name: 'Toán — Đề nháp'})).closest('li')!;
        expect(within(screen.getByRole('link', {name: 'Toán — Đề 1'}).closest('li')!).queryByRole('button', {name: 'Xuất bản'})).toBeNull();
        fireEvent.click(within(draft).getByRole('button', {name: 'Xuất bản'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('exam/publish/T2'));
    });

    it('filter chips count and filter', async () => {
        open('/subject/S1');
        await screen.findByRole('link', {name: 'Toán — Đề 1'});
        fireEvent.click(screen.getByRole('button', {name: /Nháp · 1/}));
        expect(screen.queryByRole('link', {name: 'Toán — Đề 1'})).toBeNull();
        expect(screen.getByRole('link', {name: 'Toán — Đề nháp'})).toBeTruthy();
    });

    it('⋯ menu: Xoá is locked with the reason once the exam has submissions; Chuyển về nháp only when published', async () => {
        const api = open('/subject/S1');
        const pub = (await screen.findByRole('link', {name: 'Toán — Đề 1'})).closest('li')!;
        fireEvent.click(within(pub).getByRole('button', {name: /Thao tác khác/}));
        const menu = screen.getByRole('menu', {name: 'Thao tác khác'});
        expect(menu.textContent).toContain('40 bài');
        expect(menu.textContent).toContain('Chuyển về nháp');
        const del = within(menu).getByRole('menuitem', {name: /Xoá đề/});
        expect(del.getAttribute('aria-disabled')).toBe('true');
        expect(del.textContent).toContain('Đề đã có bài nộp — chỉ chuyển về Nháp được');
        fireEvent.click(del);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('⋯ on a draft without submissions: no "Chuyển về nháp"; Xoá asks first with the safe button focused', async () => {
        const api = open('/subject/S1', {posts: {'exam/delete': {}}});
        const draft = (await screen.findByRole('link', {name: 'Toán — Đề nháp'})).closest('li')!;
        fireEvent.click(within(draft).getByRole('button', {name: /Thao tác khác/}));
        expect(screen.queryByRole('menuitem', {name: /Chuyển về nháp/})).toBeNull();
        fireEvent.click(screen.getByRole('menuitem', {name: /Xoá đề/}));
        const dlg = await screen.findByRole('dialog', {name: 'Xoá đề này?'});
        expect(document.activeElement).toBe(within(dlg).getByRole('button', {name: 'Giữ lại'}));
        expect(api.post).not.toHaveBeenCalled();
        fireEvent.click(within(dlg).getByRole('button', {name: 'Xoá đề'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('exam/delete/T2'));
    });

    it('Chuyển về nháp warns when the exam already has submissions', async () => {
        const api = open('/subject/S1', {posts: {'exam/unpublish': {}}});
        mockApi({'folder/list': FOLDERS, 'exam/list': (p: string) => EXAMS[p.split('=')[1]] || [], 'exam/to_grade': [{}, {}, {}]}, {'exam/unpublish': {}});
        const pub = (await screen.findByRole('link', {name: 'Toán — Đề 1'})).closest('li')!;
        fireEvent.click(within(pub).getByRole('button', {name: /Thao tác khác/}));
        fireEvent.click(screen.getByRole('menuitem', {name: /Chuyển về nháp/}));
        const dlg = await screen.findByRole('dialog', {name: /về nháp\?/});
        expect(dlg.textContent).toContain('3 bài nộp');
        expect(api.post).not.toHaveBeenCalled();
    });

    it('duplicate from the menu refreshes the counts of the subject column', async () => {
        let n = 2;
        const api = open('/subject/S1', {posts: {'exam/duplicate': () => { n = 3; return {}; }},
            folders: undefined});
        api.get.mockImplementation((async (p: string) => p === 'folder/list' ? FOLDERS.map(f => f.id === 'S1' ? {...f, exam_count: n} : f) : (EXAMS[p.split('=')[1]] || [])) as never);
        const row = (await screen.findByRole('link', {name: 'Toán — Đề nháp'})).closest('li')!;
        const toanLink = () => within(screen.getByRole('navigation', {name: 'Môn'})).getByRole('link', {name: /Toán/});
        expect(toanLink().textContent).toContain('2 đề · 1 nháp');
        fireEvent.click(within(row).getByRole('button', {name: /Thao tác khác/}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Nhân bản'}));
        await waitFor(() => expect(toanLink().textContent).toContain('3 đề · 1 nháp'));
    });

    it('move: the dialog lists the other visible subjects only', async () => {
        const api = open('/subject/S1', {posts: {'exam/move_to_folder': {}}});
        const row = (await screen.findByRole('link', {name: 'Toán — Đề nháp'})).closest('li')!;
        fireEvent.click(within(row).getByRole('button', {name: /Thao tác khác/}));
        fireEvent.click(screen.getByRole('menuitem', {name: /Chuyển sang môn khác/}));
        const dlg = await screen.findByRole('dialog', {name: 'Chuyển sang môn nào?'});
        expect(within(dlg).getAllByRole('button').map(b => b.textContent)).toEqual(['Ngữ văn', 'Lịch sử', 'Huỷ']);   // not Toán (here), not Hoá học (hidden)
        fireEvent.click(within(dlg).getByRole('button', {name: 'Lịch sử'}));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('exam/move_to_folder', {examId: 'T2', folderId: 'S4'}));
    });

    it('an empty subject offers the three ways to make an exam; a hidden one says so', async () => {
        open('/subject/S4');
        const ways = await screen.findByText('Môn Lịch sử chưa có đề nào');
        const card = ways.closest('div')!;
        expect(within(card).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(
            ['/create-exam?folder=S4', '/import-exam?folder=S4', '/create-from-bank?folder=S4']);
    });

    it('a hidden subject shows the notice', async () => {
        open('/subject/S3');
        expect((await screen.findByText('Môn đang ẩn — học sinh không thấy đề của môn này')).closest('[role=status]')!.textContent).toContain('Admin đã ẩn môn Hoá học');
    });

    it('search filters the rows by name and shows an empty state', async () => {
        open('/subject/S1');
        await screen.findByRole('link', {name: 'Toán — Đề 1'});
        fireEvent.change(screen.getByRole('textbox', {name: 'Tìm đề, tìm môn'}), {target: {value: 'nháp'}});
        expect(screen.queryByRole('link', {name: 'Toán — Đề 1'})).toBeNull();
        fireEvent.change(screen.getByRole('textbox', {name: 'Tìm đề, tìm môn'}), {target: {value: 'zzz'}});
        expect(screen.getByText('Không có đề nào khớp “zzz”')).toBeTruthy();
    });

    it('errors: list failure shows a retry state instead of a blank page', async () => {
        const api = open('/subject/S1');
        api.get.mockImplementation((async (p: string) => { if (p.startsWith('exam/list')) throw {code: 500, error: 'Lỗi máy chủ'}; return FOLDERS; }) as never);
        expect(await screen.findByText('Không tải được kho đề')).toBeTruthy();
    });
});

describe('after creating exams', () => {
    it('the new exam is first, marked "Mới tạo", and the toast offers "Xem đề" once (F5 keeps the mark but not the toast)', async () => {
        const toast = vi.spyOn(notify, 'success').mockImplementation(() => 'x');
        open('/subject/S2', {state: {created: ['V1'], createdName: 'Văn — Đề cũ'}});
        await screen.findByText('Mới tạo');
        const rows = screen.getAllByRole('listitem').filter(li => li.className.includes('vt-th-exam'));
        expect(rows[0].textContent).toMatch(/Văn — Đề cũ.*Mới tạo/);
        expect(rows[0].className).toContain('is-new');
        expect(screen.getAllByText('Mới tạo')).toHaveLength(1);
        await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
        expect(toast).toHaveBeenCalledWith('Đã tạo “Văn — Đề cũ” (Nháp)', undefined, {label: 'Xem đề', to: '/exam/V1'});
        await new Promise(r => setTimeout(r, 30));
        expect(toast).toHaveBeenCalledTimes(1);
    });

    it('already toasted (state kept by F5) → no second toast', async () => {
        const toast = vi.spyOn(notify, 'success').mockImplementation(() => 'x');
        open('/subject/S2', {state: {created: ['V1'], createdName: 'x', toasted: true}});
        await screen.findByText('Mới tạo');
        expect(toast).not.toHaveBeenCalled();
    });

    it('several at once: plain toast with the count, no button', async () => {
        const toast = vi.spyOn(notify, 'success').mockImplementation(() => 'x');
        open('/subject/S2', {state: {created: ['V1', 'V2']}});
        await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
        expect(toast.mock.calls[0][0]).toBe('Đã tạo 2 đề nháp trong Ngữ văn');
        expect(toast.mock.calls[0][2]).toBeUndefined();
    });
});

describe('phone', () => {
    it('/ is one card per subject (no exams under them); tapping goes to /subject/:id', async () => {
        open('/', {desktop: false});
        const link = await screen.findByRole('link', {name: /Ngữ văn/});
        expect(link.textContent).toContain('2 đề · 1 nháp');
        expect(screen.queryByRole('link', {name: 'Văn — Đề rút'})).toBeNull();
        expect(screen.queryByRole('heading', {level: 2})).toBeNull();
        expect(screen.getByTestId('where').textContent).toBe('/');   // no auto-pick on a phone
        fireEvent.click(link);
        expect(await screen.findByRole('heading', {name: 'Ngữ văn'})).toBeTruthy();
        expect(screen.getByRole('link', {name: '← Môn & đề'}).getAttribute('href')).toBe('/');
        expect(await screen.findByRole('link', {name: 'Văn — Đề rút'})).toBeTruthy();
    });

    it('⋯ opens a bottom sheet', async () => {
        open('/subject/S1', {desktop: false});
        const row = (await screen.findByRole('link', {name: 'Toán — Đề nháp'})).closest('li')!;
        fireEvent.click(within(row).getByRole('button', {name: /Thao tác khác/}));
        expect(screen.getByRole('menu', {name: 'Thao tác khác'}).className).toContain('vt-th-menu--sheet');
    });
});
