import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';

import AppStatus from './AppStatus';
import {fetchMaintenance, fetchServerVersion, isNewVersion, reloadOnceOnPreloadError} from '../lib/appStatus';

const reply = (body: unknown, ok = true) => ({ok, json: async () => body}) as Response;
const fake = (map: Record<string, Response | Error>) => vi.fn(async (url: string) => {
    const r = map[url];
    if (r instanceof Error) throw r;
    return r ?? reply(null, false);
}) as unknown as typeof fetch;

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('fetchMaintenance', () => {
    it('404 → không bảo trì', async () => expect(await fetchMaintenance(fake({}))).toBeNull());
    it('lỗi mạng → không bảo trì', async () =>
        expect(await fetchMaintenance(fake({'/maintenance.json': new Error('offline')}))).toBeNull());
    it('200 nhưng là trang HTML (không parse được JSON) → không bảo trì', async () => {
        const html = {ok: true, json: async () => { throw new SyntaxError('<!doctype'); }} as unknown as Response;
        expect(await fetchMaintenance(fake({'/maintenance.json': html}))).toBeNull();
    });
    it('có file + lời nhắn → bật, kèm lời nhắn', async () =>
        expect(await fetchMaintenance(fake({'/maintenance.json': reply({message: ' Xong lúc 22:00 '})})))
            .toEqual({message: 'Xong lúc 22:00'}));
    it('có file không lời nhắn → bật, message null', async () =>
        expect(await fetchMaintenance(fake({'/maintenance.json': reply({})}))).toEqual({message: null}));
    it('enabled=false → tắt', async () =>
        expect(await fetchMaintenance(fake({'/maintenance.json': reply({enabled: false, message: 'x'})}))).toBeNull());
});

describe('so phiên bản', () => {
    it('đọc version từ server', async () =>
        expect(await fetchServerVersion(fake({'/version.json': reply({version: 'abc'})}))).toBe('abc'));
    it('khác mã → mới; cùng mã hoặc không đọc được → không', () => {
        expect(isNewVersion('abc', 'old')).toBe(true);
        expect(isNewVersion('abc', 'abc')).toBe(false);
        expect(isNewVersion(null, 'abc')).toBe(false);
    });
});

describe('reloadOnceOnPreloadError', () => {
    it('chỉ tải lại một lần mỗi phiên tab', () => {
        const reload = vi.fn();
        const win = Object.create(window, {location: {value: {reload}}}) as Window;
        const off = reloadOnceOnPreloadError(win);
        const fire = () => win.dispatchEvent(new Event('vite:preloadError', {cancelable: true}));
        fire(); fire(); fire();
        expect(reload).toHaveBeenCalledTimes(1);
        off();
    });
});

describe('<AppStatus>', () => {
    const mount = (path: string) => render(<MemoryRouter initialEntries={[path]}>
        <AppStatus><p>nội dung app</p></AppStatus></MemoryRouter>);

    it('bảo trì bật: hiện màn bảo trì + lời nhắn, ẩn app', async () => {
        vi.stubGlobal('fetch', fake({'/maintenance.json': reply({message: 'Xong lúc 22:00'})}));
        mount('/exams');
        expect(await screen.findByText('Hệ thống đang bảo trì')).toBeInTheDocument();
        expect(screen.getByText('Xong lúc 22:00')).toBeInTheDocument();
        expect(screen.queryByText('nội dung app')).toBeNull();
        expect(screen.queryByText(/đã được trả lại/)).toBeNull();
    });

    it('đang ở phòng thi: thêm dòng lượt đã được trả', async () => {
        vi.stubGlobal('fetch', fake({'/maintenance.json': reply({})}));
        mount('/do-exam/abc');
        expect(await screen.findByText(/đã được trả lại/)).toBeInTheDocument();
    });

    it('không bảo trì: hiện app, không dải', async () => {
        vi.stubGlobal('fetch', fake({}));
        mount('/');
        expect(screen.getByText('nội dung app')).toBeInTheDocument();
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(screen.queryByText('Đã có phiên bản mới')).toBeNull();
    });

    it('phiên bản khác: hiện dải ở màn thường, không hiện trong phòng thi', async () => {
        const f = fake({'/version.json': reply({version: 'server-newer'})});
        vi.stubGlobal('fetch', f);
        const a = mount('/');
        expect(await screen.findByText('Đã có phiên bản mới')).toBeInTheDocument();
        a.unmount();
        mount('/do-exam/abc');
        await waitFor(() => expect(f).toHaveBeenCalled());
        await new Promise(r => setTimeout(r, 20));
        expect(screen.queryByText('Đã có phiên bản mới')).toBeNull();
    });
});
