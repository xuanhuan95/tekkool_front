import type {ReactNode} from 'react';
import {render} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

/** Render one screen at `path` with a fresh react-query cache (no retries) and a spy route table. */
export function renderAt(path: string, routes: Array<[string, ReactNode]>) {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    return render(<QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>{routes.map(([p, el]) => <Route key={p} path={p} element={el}/>)}</Routes>
        </MemoryRouter>
    </QueryClientProvider>);
}

/** Api.get mock answering by URL prefix; unknown URLs reject with 404 like BE. */
export function routeApi(table: Record<string, unknown>) {
    return (url: string) => {
        const key = Object.keys(table).sort((a, b) => b.length - a.length).find(k => url.startsWith(k));
        if (key === undefined) return Promise.reject({code: 404, error: 'not found ' + url});
        const v = table[key];
        return v instanceof Error || (v && typeof v === 'object' && 'code' in (v as object) && (v as {code: number}).code >= 400)
            ? Promise.reject(v) : Promise.resolve(v);
    };
}
