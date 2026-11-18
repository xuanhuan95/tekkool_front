import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import Loading from './Loading';
import {Refreshable} from './Refreshing';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Loading (SPT-139)', () => {
    it('shows nothing before 300ms, then the pencil and "Đang tải…"', () => {
        render(<Loading/>);
        const box = screen.getByRole('status');
        expect(box).toHaveAttribute('aria-live', 'polite');
        act(() => { vi.advanceTimersByTime(299); });
        expect(screen.queryByText('Đang tải…')).toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        expect(screen.getByText('Đang tải…')).toBeInTheDocument();
        expect(box.querySelector('.ld-art')).toHaveAttribute('aria-hidden', 'true');
    });

    it('changes the sentence after 8 seconds', () => {
        render(<Loading/>);
        act(() => { vi.advanceTimersByTime(7999); });
        expect(screen.getByText('Đang tải…')).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(1); });
        expect(screen.getByText('Mạng hơi chậm, chờ thêm chút nhé…')).toBeInTheDocument();
        expect(screen.queryByText('Đang tải…')).toBeNull();
    });

    it('boot variant adds the logo after the delay', () => {
        const {container} = render(<Loading variant='boot'/>);
        expect(container.querySelector('.vt-logo')).toBeNull();
        act(() => { vi.advanceTimersByTime(300); });
        expect(container.querySelector('.ld-boot .vt-logo')).toHaveTextContent('viettestpro');
    });
});

function Probe({silent}: {silent?: boolean}) {
    const q = useQuery({queryKey: ['x'], meta: {silent}, queryFn: () => new Promise<string>(r => setTimeout(() => r('ok'), 1000))});
    return <Refreshable><p>{q.data ?? '...'}</p></Refreshable>;
}

describe('Refreshable', () => {
    function setup(silent?: boolean) {
        const qc = new QueryClient();
        qc.setQueryData(['x'], 'old');
        qc.invalidateQueries({queryKey: ['x']});
        return render(<QueryClientProvider client={qc}><Probe silent={silent}/></QueryClientProvider>);
    }

    it('keeps old data, fades it and sets aria-busy only after 300ms of refetch', () => {
        const {container} = setup();
        const area = container.firstElementChild as HTMLElement;
        act(() => { vi.advanceTimersByTime(10); });
        expect(area).toHaveAttribute('aria-busy', 'false');   // refetching, but under 300ms: no change
        act(() => { vi.advanceTimersByTime(300); });
        expect(area).toHaveAttribute('aria-busy', 'true');
        expect(area).toHaveClass('is-refreshing');
        expect(screen.getByText('old')).toBeInTheDocument();
    });

    it('ignores silent (polling) queries', () => {
        const {container} = setup(true);
        act(() => { vi.advanceTimersByTime(500); });
        expect(container.firstElementChild).toHaveAttribute('aria-busy', 'false');
    });
});
