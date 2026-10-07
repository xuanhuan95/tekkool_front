import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import Api, {setToken} from './api';

// Every app request goes through _call. Two bugs that really happened are pinned here:
// (1) BE 500 returns HTML -> JSON.parse throws a SyntaxError with no .code, every
//     `e.code === 402` catch misses, an out-of-turns student sees "Unexpected token '<'".
// (2) reject without `return` -> resolve runs on, the Promise has already settled so
//     it is silent and the error vanishes.

function mockFetch(body: string, status = 200) {
    const f = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(JSON.parse(body)),
    });
    globalThis.fetch = f as unknown as typeof fetch;
    return f;
}

beforeEach(() => {
    setToken('');
    window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('_call: error resolution', () => {
    it('BE returns HTML on 500 -> error MUST carry code = 500, not a SyntaxError', async () => {
        mockFetch('<html><body>Internal Server Error</body></html>', 500);
        await expect(Api.get('exam/1')).rejects.toMatchObject({code: 500});
    });

    it('out of turns: code 402 must arrive intact so FE opens the buy-a-package popup', async () => {
        mockFetch(JSON.stringify({code: 402, error: 'Hết lượt'}), 402);
        await expect(Api.get('exam/during_test')).rejects.toMatchObject({code: 402});
    });

    it('BE abort(): JSON body but NO code -> use the HTTP status', async () => {
        mockFetch(JSON.stringify({error: 'Forbidden'}), 403);
        await expect(Api.get('exam/1')).rejects.toMatchObject({code: 403, error: 'Forbidden'});
    });

    it('200 with an error code in the body must still reject', async () => {
        mockFetch(JSON.stringify({code: 400, error: 'Thiếu token'}), 200);
        await expect(Api.get('x')).rejects.toMatchObject({code: 400});
    });

    it('success resolves with the body', async () => {
        mockFetch(JSON.stringify({code: 200, id: 'E1'}));
        await expect(Api.get('exam/E1')).resolves.toMatchObject({id: 'E1'});
    });

    it('empty body on 204 -> must not silently resolve undefined', async () => {
        mockFetch('', 204);
        await expect(Api.get('x')).rejects.toMatchObject({code: 204});
    });
});

describe('_call: token', () => {
    it('with a token, append ?token= to the URL — BE token_required reads the query string', async () => {
        setToken('TK1');
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.get('exam/list');
        expect(f.mock.calls[0][0]).toContain('?token=TK1');
    });

    it('URL that already has ? is joined with & rather than a second ?', async () => {
        setToken('TK1');
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.get('exam/list?page=2');
        expect(f.mock.calls[0][0]).toContain('?page=2&token=TK1');
        expect((f.mock.calls[0][0] as string).match(/\?/g)).toHaveLength(1);
    });

    it('without a token, append nothing', async () => {
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.get('session/init');
        expect(f.mock.calls[0][0]).not.toContain('token=');
    });
});

describe('setToken', () => {
    it('stores both window.token and localStorage — lose one and F5 logs you out', () => {
        setToken('ABC');
        expect(window.token).toBe('ABC');
        expect(window.localStorage.getItem('sessionToken')).toBe('ABC');
    });

    it('logout must clear BOTH, the old token is revoked by BE, resending gives 400', () => {
        setToken('ABC');
        setToken('');
        expect(window.token).toBe('');
        expect(window.localStorage.getItem('sessionToken')).toBeNull();
    });
});

describe('methods', () => {
    it('post sends a JSON body with the right method', async () => {
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.post('exam/save', {name: 'Đề 1'});
        const opts = f.mock.calls[0][1] as RequestInit;
        expect(opts.method).toBe('POST');
        expect(JSON.parse(opts.body as string)).toEqual({name: 'Đề 1'});
    });

    it('delete uses the DELETE method', async () => {
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.delete('exam/E1');
        expect((f.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
    });
});
