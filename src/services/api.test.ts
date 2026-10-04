import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import Api, {setToken} from './api';

// Mọi request của app đi qua _call. Hai lỗi đã xảy ra thật được chốt ở đây:
// (1) BE 500 trả HTML -> JSON.parse ném SyntaxError không có .code, chỗ nào
//     bắt `e.code === 402` đều trượt, học sinh hết lượt thấy "Unexpected token '<'".
// (2) reject xong thiếu `return` -> chạy tiếp resolve, Promise đã settle nên
//     im lặng, lỗi biến mất.

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

describe('_call: phân giải lỗi', () => {
    it('BE trả HTML khi 500 -> lỗi PHẢI mang code = 500, không phải SyntaxError', async () => {
        mockFetch('<html><body>Internal Server Error</body></html>', 500);
        await expect(Api.get('exam/1')).rejects.toMatchObject({code: 500});
    });

    it('hết lượt: code 402 phải tới nơi nguyên vẹn để FE mở popup mua gói', async () => {
        mockFetch(JSON.stringify({code: 402, error: 'Hết lượt'}), 402);
        await expect(Api.get('exam/during_test')).rejects.toMatchObject({code: 402});
    });

    it('abort() của BE: body JSON nhưng KHÔNG có code -> lấy HTTP status', async () => {
        mockFetch(JSON.stringify({error: 'Forbidden'}), 403);
        await expect(Api.get('exam/1')).rejects.toMatchObject({code: 403, error: 'Forbidden'});
    });

    it('200 kèm code lỗi trong body vẫn phải reject', async () => {
        mockFetch(JSON.stringify({code: 400, error: 'Thiếu token'}), 200);
        await expect(Api.get('x')).rejects.toMatchObject({code: 400});
    });

    it('thành công thì resolve đúng body', async () => {
        mockFetch(JSON.stringify({code: 200, id: 'E1'}));
        await expect(Api.get('exam/E1')).resolves.toMatchObject({id: 'E1'});
    });

    it('body rỗng khi 204 -> không được resolve undefined một cách im lặng', async () => {
        mockFetch('', 204);
        await expect(Api.get('x')).rejects.toMatchObject({code: 204});
    });
});

describe('_call: token', () => {
    it('có token thì gắn ?token= vào URL — token_required của BE đọc query string', async () => {
        setToken('TK1');
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.get('exam/list');
        expect(f.mock.calls[0][0]).toContain('?token=TK1');
    });

    it('URL đã có ? thì nối bằng & chứ không phải ? thứ hai', async () => {
        setToken('TK1');
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.get('exam/list?page=2');
        expect(f.mock.calls[0][0]).toContain('?page=2&token=TK1');
        expect((f.mock.calls[0][0] as string).match(/\?/g)).toHaveLength(1);
    });

    it('không có token thì không gắn gì', async () => {
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.get('session/init');
        expect(f.mock.calls[0][0]).not.toContain('token=');
    });
});

describe('setToken', () => {
    it('lưu cả window.token lẫn localStorage — mất một chỗ là F5 bị đăng xuất', () => {
        setToken('ABC');
        expect(window.token).toBe('ABC');
        expect(window.localStorage.getItem('sessionToken')).toBe('ABC');
    });

    it('đăng xuất phải xoá CẢ HAI, token cũ bị BE huỷ, gửi lại là 400', () => {
        setToken('ABC');
        setToken('');
        expect(window.token).toBe('');
        expect(window.localStorage.getItem('sessionToken')).toBeNull();
    });
});

describe('phương thức', () => {
    it('post gửi body JSON đúng method', async () => {
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.post('exam/save', {name: 'Đề 1'});
        const opts = f.mock.calls[0][1] as RequestInit;
        expect(opts.method).toBe('POST');
        expect(JSON.parse(opts.body as string)).toEqual({name: 'Đề 1'});
    });

    it('delete dùng method DELETE', async () => {
        const f = mockFetch(JSON.stringify({code: 200}));
        await Api.delete('exam/E1');
        expect((f.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
    });
});
