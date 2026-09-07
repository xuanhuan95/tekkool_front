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
        .then(res => res.json())
        .then(json => {
          if (json.code && json.code !== 200) reject(json);
          resolve(json);
        })
        .catch(e => reject(e));
    });
  }

  post = (url, data) => this._call(url, 'POST', data);
  put = (url, data) => this._call(url, 'PUT', data);
  get = url => this._call(url, 'GET');
  delete = url => this._call(url, 'DELETE');
}

const Api = new BaseApi();
export default Api;
