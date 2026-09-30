/**
 * Chốt logic "in ngữ liệu MỘT lần ở câu đầu nhóm" — dùng ở 4 màn (làm bài,
 * xem trước, in đề, soạn đề) nên sai là hỏng cả 4.
 * Chạy: node src/components/Passage.test.js
 */

// Bản thuần của điều kiện trong Passage.jsx — test được không cần DOM.
function shows(question, prev) {
    let {passage, passageId} = question.data || {};
    if (!passage) return false;
    if (prev && prev.data && prev.data.passageId === passageId) return false;
    return true;
}

const q = (passage, passageId) => ({data: passage ? {passage, passageId} : {}});

// Nhóm 1: câu 1-3 chung ngữ liệu A. Nhóm 2: câu 4-5 chung ngữ liệu B.
const A = q('<p>Văn bản 1</p>', 'G1');
const B = q('<p>Văn bản 2</p>', 'G2');
const plain = q(null, null);

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error(msg); n++; };

ok(shows(A, undefined), 'câu đầu section phải in ngữ liệu');
ok(!shows(A, A), 'câu 2 cùng nhóm KHÔNG được in lại');
ok(shows(B, A), 'sang nhóm mới phải in ngữ liệu mới');
ok(!shows(B, B), 'câu 5 cùng nhóm 2 không in lại');
ok(!shows(plain, A), 'câu không có ngữ liệu thì không in gì');
ok(shows(A, plain), 'nhóm bắt đầu sau một câu lẻ vẫn phải in');

// Câu tự luận sau nhóm đọc hiểu: không ngữ liệu, không được kế thừa của nhóm trước.
ok(!shows(plain, B), 'tự luận không được ăn ngữ liệu của nhóm trước');

// data rỗng hoàn toàn (câu mới tạo trong màn soạn đề)
ok(!shows({data: {}}, A), 'câu data rỗng không crash, không in');
ok(!shows({}, A), 'question không có data không crash');

console.log('OK: ' + n + ' ca — ngữ liệu in đúng một lần mỗi nhóm');
