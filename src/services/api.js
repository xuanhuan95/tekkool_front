import {API_URL} from "../settings";

class BaseApi {
  _call(url, method, data) {
    let token = window.token;
    let apiUrl = API_URL + url;

    if (token) {
      let symbol = apiUrl.includes('?') ? '&' : '?';
      apiUrl += symbol + 'token=' + token;
    }

    return new Promise((resolve, reject) => {
      fetch(apiUrl, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },

        method: method,
        body: JSON.stringify(data)
      })
        // BE lỗi nặng (500) trả trang HTML, không phải JSON. res.json() ném
        // SyntaxError không có .code -> mọi chỗ bắt `e.code === 402` trượt,
        // học sinh hết lượt thấy "Unexpected token '<'" thay vì popup mua gói.
        // Đọc text trước rồi mới parse: hỏng thì dựng lỗi MANG code = HTTP status.
        .then(res => res.text().then(body => {
          let json;
          try {
            json = JSON.parse(body);
          } catch (e) {
            return reject({code: res.status,
                           error: 'Máy chủ lỗi (' + res.status + ')'});
          }
          // Thiếu `return` ở đây là reject xong vẫn chạy tiếp resolve.
          if (json.code && json.code !== 200) return reject(json);
          // BE có chỗ abort() -> body JSON nhưng không kèm `code`; status mới
          // là nguồn sự thật.
          if (!res.ok) return reject({code: res.status, ...json});
          return resolve(json);
        }))
        .catch(e => reject(e));
    });
  }

  // ponytail: _call luôn JSON.stringify + set Content-Type: application/json,
  // không gửi file được. Upload phải để browser tự đặt Content-Type kèm
  // boundary của multipart -> KHÔNG set headers thủ công ở đây.
  upload = (url, file) => {
    let apiUrl = API_URL + url;
    if (window.token) apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'token=' + window.token;

    let body = new FormData();
    body.append('file', file);

    return fetch(apiUrl, {method: 'POST', body})
      .then(res => res.json())
      .then(json => {
        if (json.code && json.code !== 200) throw json;
        return json;
      });
  };

  post = (url, data) => this._call(url, 'POST', data);
  put = (url, data) => this._call(url, 'PUT', data);
  get = url => this._call(url, 'GET');
  delete = url => this._call(url, 'DELETE');
}

const Api = new BaseApi();

// Token phien nam o DUY NHAT mot cho: window.token (api.js doc) + localStorage
// (giu qua lan mo trang). BE xoay token moi lan dang nhap va xoa phien khi
// dang xuat, nen moi cho nhan token moi deu phai goi ham nay — quen mot cho
// la request tiep theo mang token da bi xoa, BE tra 400.
export function setToken(token) {
  window.token = token || '';
  if (token) window.localStorage.setItem('sessionToken', token);
  else window.localStorage.removeItem('sessionToken');
}

export default Api;
