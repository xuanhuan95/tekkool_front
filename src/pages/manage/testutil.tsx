import type {ReactNode} from 'react';
import {vi} from 'vitest';
import {render} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import Api from '../../services/api';

/** Render under router + a fresh react-query client (no retries). */
export function renderAt(ui: ReactNode, path = '/') {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <MemoryRouter initialEntries={[path]}>
                <Routes><Route path='*' element={ui}/></Routes>
            </MemoryRouter>
        </QueryClientProvider>);
}

type Handler = unknown | ((path: string, body?: unknown) => unknown);

/** Mock Api.get / Api.post by path prefix (longest prefix wins). A returned Error is thrown as {error}. */
export function mockApi(gets: Record<string, Handler> = {}, posts: Record<string, Handler> = {}) {
    const make = (routes: Record<string, Handler>) => async (path: string, body?: unknown) => {
        const key = Object.keys(routes).sort((a, b) => b.length - a.length).find(k => path.startsWith(k));
        if (key === undefined) throw {code: 404, error: 'no mock for ' + path};
        const v = routes[key];
        const out = typeof v === 'function' ? (v as (p: string, b?: unknown) => unknown)(path, body) : v;
        if (out instanceof Error) throw {code: 400, error: out.message};
        return out as any;
    };
    return {
        get: vi.spyOn(Api, 'get').mockImplementation(make(gets)),
        post: vi.spyOn(Api, 'post').mockImplementation(make(posts)),
    };
}
