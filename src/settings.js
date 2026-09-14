// export const API_URL = 'http://0.0.0.0:5000/api/';
// ponytail: fallback là domain production, nên build không set env vẫn ra
// đúng bản cũ. Local/docker set VITE_API_URL để trỏ về BE của mình.
// Lưu ý: api.js nối chuỗi thô nên BẮT BUỘC giữ dấu / ở cuối.
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.tekkool.com/api/';
