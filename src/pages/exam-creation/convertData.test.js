/**
 * Chốt luật đổi loại câu hỏi ở màn import.
 * Chạy: node src/pages/exam-creation/convertData.test.js
 *
 * Bản sao thuần của convertData trong ImportExam.jsx (giữ đồng bộ tay —
 * file kia là JSX, node chạy trực tiếp không được).
 */
function convertData(data, to) {
    let {question, passage, passageId, max_words} = data;
    let next = {question};
    if (passage) { next.passage = passage; next.passageId = passageId; }

    if (to === 'MultipleChoice' || to === 'ErrorIdentify') {
        next.answers = data.answers || [];
        if (data.correctAnswerId) next.correctAnswerId = data.correctAnswerId;
    } else if (to === 'FreeAnswer') {
        if (max_words) next.max_words = max_words;
    }
    return next;
}

let n = 0;
const ok = (c, m) => { if (!c) throw new Error(m); n++; };

const MC = {
    question: '<p>Bài thơ nói về mùa nào?</p>',
    answers: [{id: 'a1', value: 'Xuân'}, {id: 'a2', value: 'Hạ'}],
    correctAnswerId: 'a1',
    passage: '<p>Mùa xuân về.</p>',
    passageId: 'E1_0_G1',
};

// Ngữ liệu dùng chung KHÔNG được mất khi đổi loại — mất là cả nhóm hỏng.
for (const to of ['FreeAnswer', 'TrueFalse', 'FillBlank', 'ErrorIdentify']) {
    const r = convertData(MC, to);
    ok(r.passage === MC.passage, 'đổi sang ' + to + ' làm mất ngữ liệu');
    ok(r.passageId === MC.passageId, 'đổi sang ' + to + ' làm mất passageId');
    ok(r.question === MC.question, 'đổi sang ' + to + ' làm mất thân câu');
}

// Trắc nghiệm -> tự luận: bỏ phương án, không để rác lại trong DB.
const tl = convertData(MC, 'FreeAnswer');
ok(tl.answers === undefined, 'tự luận không được giữ answers');
ok(tl.correctAnswerId === undefined, 'tự luận không được giữ correctAnswerId');

// LỖI THẬT SỰ NGUY HIỂM: data.answer nghĩa khác nhau từng loại.
// TrueFalse.jsx đọc boolean, FillBlank.jsx đọc chuỗi HTML.
const tf = convertData({question: 'x', answer: '<p>chuỗi của FillBlank</p>'}, 'TrueFalse');
ok(tf.answer === undefined, 'TrueFalse không được ăn phải answer kiểu chuỗi');
const fb = convertData({question: 'x', answer: true}, 'FillBlank');
ok(fb.answer === undefined, 'FillBlank không được ăn phải answer kiểu boolean');

// TrueFalse.jsx coi undefined là CHƯA CHỌN (bỏ checked cả hai radio).
// Đặt sẵn true/false = gán bừa đáp án đúng, chấm máy ra điểm sai.
ok(!('answer' in tf), 'TrueFalse phải để trống đáp án cho giáo viên chọn');

// Giới hạn từ chỉ có nghĩa với tự luận.
const wl = {question: 'Viết bài văn', max_words: 600};
ok(convertData(wl, 'FreeAnswer').max_words === 600, 'tự luận phải giữ giới hạn từ');
ok(convertData(wl, 'MultipleChoice').max_words === undefined,
   'trắc nghiệm không được giữ giới hạn từ');

// Tự luận -> trắc nghiệm: phải có mảng answers để Answers() map được, không crash.
const mc = convertData({question: 'Viết đoạn văn'}, 'MultipleChoice');
ok(Array.isArray(mc.answers) && mc.answers.length === 0, 'answers phải là mảng rỗng, không undefined');
ok(mc.correctAnswerId === undefined, 'chưa có phương án thì không được có đáp án đúng');

// ErrorIdentify dùng chung UI phương án với trắc nghiệm.
ok(convertData(MC, 'ErrorIdentify').answers.length === 2, 'ErrorIdentify phải giữ phương án');

// Câu không có ngữ liệu: không được đẻ ra passageId rỗng.
const plain = convertData({question: 'x'}, 'FreeAnswer');
ok(!('passage' in plain) && !('passageId' in plain), 'không được thêm passage rỗng');

console.log('OK: ' + n + ' ca — đổi loại giữ đúng dữ liệu dùng chung, bỏ đúng dữ liệu riêng');
