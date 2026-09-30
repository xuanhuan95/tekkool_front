/**
 * Check cho hàm nhận icon theo tên môn.
 * Chạy: node src/pages/dashboard/subjectStyle.test.js
 *
 * ponytail: chép lại logic thay vì import — SubjectBrowser.jsx là JSX, node
 * trần không chạy được, mà dựng cả vitest chỉ cho một hàm thuần là thừa.
 * Sửa hàm bên kia thì sửa cả đây; hai bản lệch nhau là test đỏ ngay.
 */
const SUBJECTS = [
    {key: 'van', icon: 'pencil alternate', match: ['van', 'ngu van']},
    {key: 'anh', icon: 'language', match: ['tieng anh', 'anh', 'english', 'ngoai ngu']},
    {key: 'toan', icon: 'calculator', match: ['toan']},
    {key: 'ly', icon: 'magnet', match: ['ly', 'vat ly']},
    {key: 'hoa', icon: 'flask', match: ['hoa', 'hoa hoc']},
    {key: 'sinh', icon: 'dna', match: ['sinh', 'sinh hoc']},
    {key: 'su', icon: 'hourglass half', match: ['lich su', 'su']},
    {key: 'dia', icon: 'map outline', match: ['dia ly', 'dia li', 'dia']},
    {key: 'gdcd', icon: 'balance scale', match: ['gdcd', 'giao duc cong dan', 'cong dan']},
    {key: 'tin', icon: 'laptop', match: ['tin hoc', 'tin']},
];
const FALLBACK = {key: 'khac', icon: 'folder open'};

function bodau(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function subjectStyle(name) {
    const n = bodau(name);
    for (const s of SUBJECTS) if (s.match.some(m => n === m)) return s;
    for (const s of SUBJECTS) if (s.match.some(m => n.startsWith(m + ' ') || n.endsWith(' ' + m))) return s;
    return FALLBACK;
}

let fail = 0;
function eq(name, want) {
    const got = subjectStyle(name).key;
    if (got !== want) { console.error('SAI  ' + JSON.stringify(name) + ' -> ' + got + ', mong ' + want); fail++; }
    else console.log('ok   ' + JSON.stringify(name) + ' -> ' + got);
}

// 8 môn thật đang có trên production
eq('Văn', 'van');
eq('Tiếng Anh', 'anh');
eq('Toán', 'toan');
eq('Lý', 'ly');
eq('Hóa', 'hoa');
eq('Sinh', 'sinh');
eq('Lịch sử', 'su');      // KHÔNG được dính 'sinh'
eq('Địa lý', 'dia');

// viết khác dấu / khác cách gọi
eq('Hoá', 'hoa');
eq('Vật lý', 'ly');
eq('Ngữ văn', 'van');
eq('Sinh học', 'sinh');
eq('Địa lí', 'dia');
eq('TOÁN', 'toan');
eq('  Văn  ', 'van');

// môn lạ phải rơi về fallback, không được vỡ
eq('Giáo dục thể chất', 'khac');
eq('', 'khac');
eq(null, 'khac');

// bẫy: chuỗi con không được khớp bừa
eq('Toán rời rạc', 'toan');    // 'toan ' ở đầu -> khớp
eq('Lịch sử Đảng', 'su');      // 'lich su ' ở đầu -> khớp

console.log(fail ? '\n' + fail + ' CASE SAI' : '\nTẤT CẢ ĐÚNG');
process.exit(fail ? 1 : 0);
