import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {Refreshable} from '../../components/ui';
import Api from '../../services/api';
import {useSubjectExams} from '../../queries/student';

vi.mock('../../services/api', () => ({default: {get: vi.fn()}}));

function Probe() {
    const [id, setId] = useState('a');
    const q = useSubjectExams(id);
    return <>
        <button onClick={() => setId('b')}>môn b</button>
        <Refreshable data-testid='me'><b>thẻ Bạn</b></Refreshable>
        <Refreshable data-testid='panel'>{q.data ? q.data.map(e => <p key={e.id}>{e.name}</p>) : 'trống'}</Refreshable>
    </>;
}

beforeEach(() => vi.useFakeTimers({shouldAdvanceTime: true}));
afterEach(() => vi.useRealTimers());

describe('HS Đề thi: đổi chip môn (SPT-139, Apollo L1)', () => {
    it('giữ danh sách cũ và bật aria-busy trong lúc tải môn mới, không bị trống', async () => {
        let release: (v: unknown) => void = () => {};
        vi.mocked(Api.get).mockImplementation((url: string) =>
            url.startsWith('folder/children') ? Promise.resolve([])
            : url.endsWith('=a') ? Promise.resolve([{id: '1', name: 'Đề môn A'}])
            : new Promise(r => { release = r; }));
        const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={qc}><Probe/></QueryClientProvider>);
        await screen.findByText('Đề môn A');

        await act(async () => { screen.getByText('môn b').click(); });
        act(() => { vi.advanceTimersByTime(10); });   // để react-query báo trạng thái trước
        act(() => { vi.advanceTimersByTime(400); });
        expect(screen.getByText('Đề môn A')).toBeInTheDocument();          // danh sách cũ còn
        expect(screen.getByTestId('panel')).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByTestId('panel')).toHaveClass('is-refreshing');
        expect(screen.getByTestId('me')).toHaveAttribute('aria-busy', 'true');   // thẻ "Bạn" cũng mờ như bảng

        await act(async () => { release([{id: '2', name: 'Đề môn B'}]); });
        expect(await screen.findByText('Đề môn B')).toBeInTheDocument();
        expect(screen.getByTestId('panel')).toHaveAttribute('aria-busy', 'false');
    });
});
