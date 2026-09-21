// Bản sao logic measure()/trimToFit() trong src/components/Editor.jsx — đổi một
// bên thì đổi cả hai. Chạy: node tekkool_front/check_editor_limit.mjs
const WORD = 'word';

function measure(text, unit) {
    if (unit !== WORD) return text.normalize('NFC').length;
    const t = text.normalize('NFC').trim();
    return t === '' ? 0 : t.split(/\s+/).length;
}

function trimToFit(head, pasted, max, unit) {
    let lo = 0, hi = pasted.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (measure(head + pasted.slice(0, mid), unit) <= max) lo = mid; else hi = mid - 1;
    }
    let cut = pasted.slice(0, lo);
    if (unit === WORD && lo < pasted.length) {
        cut = cut.replace(/\s*\S*$/, '');
    }
    return cut;
}

const eq = (a, b, m) => {
    if (a !== b) throw new Error('FAIL ' + m + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b));
};

// --- đếm ký tự ---
eq(measure('', 'char'), 0, 'char: rong');
eq(measure('Tôi đi học', 'char'), 10, 'char: tieng Viet NFC');
eq(measure('Tôi đi học'.normalize('NFD'), 'char'), 10, 'char: NFD phai bang NFC');
eq(measure('Nguyễn Thị Huệ'.normalize('NFD'), 'char'), 14, 'char: ten rieng NFD');
eq(measure('a  b', 'char'), 4, 'char: space lien tiep tinh het');
eq(measure('a ', 'char'), 2, 'char: space cuoi tinh — khong trim');

// --- đếm từ (ví dụ do người dùng đưa) ---
eq(measure('I am a student', WORD), 4, 'word: vi du Tieng Anh');
eq(measure('Học sinh', WORD), 2, 'word: vi du Ngu van 2 chu');
eq(measure('Trường Trung học phổ thông', WORD), 5, 'word: vi du Ngu van 5 chu');
eq(measure('', WORD), 0, 'word: rong');
eq(measure('   ', WORD), 0, 'word: toan space');
eq(measure('  a  b  ', WORD), 2, 'word: space thua khong tinh them');
eq(measure('a\nb', WORD), 2, 'word: xuong dong cung la ranh gioi tu');
eq(measure('Học sinh'.normalize('NFD'), WORD), 2, 'word: NFD phai bang NFC');
eq(measure('Tôi', WORD), 1, 'word: 1 tu');
eq(measure('Tôi ', WORD), 1, 'word: space cuoi chua thanh tu moi');

// --- cắt khi paste ---
// Giữ space cuối là đúng: "I am a student " vẫn là 4 từ, và học sinh gõ tiếp
// được. Cắt space đi mới sai — sẽ dính vào từ kế tiếp nếu dán lần nữa.
eq(trimToFit('', 'I am a student today', 4, WORD), 'I am a student', 'paste word: cat dung 4 tu');
eq(measure(trimToFit('', 'I am a student today', 4, WORD), WORD), 4, 'paste word: ket qua cat van dung 4 tu');
// Không để space cuối: còn space thì gõ tiếp 1 chữ là sang từ mới -> bị chặn oan.
eq(/\s$/.test(trimToFit('', 'I am a student today', 4, WORD)), false, 'paste word: khong con space cuoi');
eq(trimToFit('Tôi ', 'đi học bài', 2, WORD), 'đi', 'paste word: da co 1 tu, chi them 1');
eq(trimToFit('', 'abcdefgh', 5, 'char'), 'abcde', 'paste char: cat 5 ky tu');
eq(trimToFit('abc', 'defgh', 5, 'char'), 'de', 'paste char: tru phan da co');
eq(trimToFit('', 'student', 0, WORD), '', 'paste word: het cho');
eq(trimToFit('', 'I am a student', 10, WORD), 'I am a student', 'paste word: du cho, giu nguyen');
// Không cắt giữa chữ: "stu" không được phép lọt ra.
// Chặt nhị phân dừng ngay sau space nên 'student' không lọt vào -> không cần cắt.
eq(trimToFit('', 'I am a student', 3, WORD), 'I am a', 'paste word: dung truoc tu thu 4');
eq(measure(trimToFit('', 'I am a student', 3, WORD), WORD), 3, 'paste word: cat xong dung han muc');
// Trường hợp nhánh cắt-giữa-chữ thực sự chạy: dán vào giữa 1 từ đang viết dở.
// head='sta' + 'dent xyz' -> 'sta' nối liền thành 1 từ, phải lùi hết cụm đó.
eq(trimToFit('I am a sta', 'dent xyz', 4, WORD), 'dent', 'paste word: noi vao tu dang viet do');
eq(measure('I am a sta' + trimToFit('I am a sta', 'dent xyz', 4, WORD), WORD), 4, 'paste word: tong dung han muc');

console.log('OK: measure + trimToFit — 28 case');
