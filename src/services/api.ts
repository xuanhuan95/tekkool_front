import {API_URL} from "../settings";

/** API errors always carry `code` — FE catches by code (402 = out of turns, 403 = no permission). */
export type ApiError = {
    code: number;
    error?: string;
    [key: string]: unknown;
};

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

declare global {
    interface Window {
        token?: string;
    }
}

class BaseApi {
    _call<T = any>(url: string, method: Method, data?: unknown): Promise<T> {
        const token = window.token;
        let apiUrl = API_URL + url;

        if (token) {
            const symbol = apiUrl.includes('?') ? '&' : '?';
            apiUrl += symbol + 'token=' + token;
        }

        return new Promise<T>((resolve, reject) => {
            fetch(apiUrl, {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },

                method: method,
                body: JSON.stringify(data)
            })
                // On a severe failure (500) BE returns an HTML page, not JSON. res.json()
                // throws a SyntaxError with no .code -> every `e.code === 402` catch
                // misses, and an out-of-turns student sees "Unexpected token '<'"
                // instead of the buy-a-package popup.
                // Read text first, then parse: if that fails, build an error CARRYING code = HTTP status.
                .then(res => res.text().then(body => {
                    let json: any;
                    try {
                        json = JSON.parse(body);
                    } catch (e) {
                        return reject({code: res.status,
                                       error: 'Máy chủ lỗi (' + res.status + ')'} as ApiError);
                    }
                    // Without `return` here, reject is followed by resolve running anyway.
                    if (json.code && json.code !== 200) return reject(json as ApiError);
                    // BE has abort() paths -> JSON body without `code`; the status is
                    // the source of truth.
                    if (!res.ok) return reject({code: res.status, ...json} as ApiError);
                    return resolve(json as T);
                }))
                .catch(e => reject(e));
        });
    }

    // ponytail: _call always does JSON.stringify + sets Content-Type: application/json,
    // so it cannot send files. Upload must let the browser set Content-Type with
    // the multipart boundary -> do NOT set headers manually here.
    private send(url: string, file: File | Blob): Promise<Response> {
        let apiUrl = API_URL + url;
        if (window.token) apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'token=' + window.token;

        const body = new FormData();
        body.append('file', file);
        return fetch(apiUrl, {method: 'POST', body});
    }

    // a proxy 413/502 may answer with HTML: keep the status as `code`, like _call
    private parse(res: Response): Promise<any> {
        return res.text().then(body => {
            let json: any;
            try { json = JSON.parse(body); } catch (e) {
                throw {code: res.status, error: 'Máy chủ lỗi (' + res.status + ')'} as ApiError;
            }
            if (json.code && json.code !== 200) throw json as ApiError;
            if (!res.ok) throw {code: res.status, ...json} as ApiError;
            return json;
        });
    }

    upload = <T = any>(url: string, file: File | Blob): Promise<T> =>
        this.send(url, file).then(res => this.parse(res) as Promise<T>);

    /** Same request, but the answer is a file (import_docx/pdf): a JSON error body is still turned into an ApiError. */
    uploadBlob = (url: string, file: File | Blob): Promise<Blob> =>
        this.send(url, file).then(res => res.ok ? res.blob() : this.parse(res).then(() => {
            throw {code: res.status, error: 'Máy chủ lỗi (' + res.status + ')'} as ApiError;
        }));

    post = <T = any>(url: string, data?: unknown) => this._call<T>(url, 'POST', data);
    put = <T = any>(url: string, data?: unknown) => this._call<T>(url, 'PUT', data);
    get = <T = any>(url: string) => this._call<T>(url, 'GET');
    delete = <T = any>(url: string) => this._call<T>(url, 'DELETE');
}

const Api = new BaseApi();

// The session token lives in ONE place only: window.token (read by api.ts) + localStorage
// (kept across page loads). BE rotates the token on every login and deletes the session on
// logout, so everywhere that receives a new token must call this function — forget one
// place and the next request carries a deleted token, BE returns 400.
export function setToken(token?: string | null): void {
    window.token = token || '';
    if (token) window.localStorage.setItem('sessionToken', token);
    else window.localStorage.removeItem('sessionToken');
}

export default Api;
