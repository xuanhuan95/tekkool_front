import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import Api from '../../services/api';
import ImportExam from './ImportExam';

// Màn này là cửa duy nhất đưa đề vào hệ thống. Hai chỗ từng nói dối giáo viên:
// dòng hint khoe "Đã thêm N khối" sau lần lưu sau đó không động vào ngân hàng,
// và nút "Kiểm tra trùng lặp" hỏng mà im lặng — bấm xong không chip nào hiện,
// trông y hệt "ngân hàng sạch trùng".

const DE = {
    id: 'E1',
    name: 'Đề thử 1',
    duration: 45,
    source: ['Câu 1. Nội dung'],
    sections: [{
        id: 'S1',
        name: 'Phần I',
        question_type: 'MultipleChoice',
        questions: [{
            id: 'Q1',
            type: 'MultipleChoice',
            data: {
                question: '<p>1+1=?</p>',
                answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}],
                correctAnswerId: 'A1',
            },
        }],
    }],
};

const ve = (duong = '/import-exam?bank=B1') => render(
    <MemoryRouter initialEntries={[duong]}>
        <Routes>
            <Route path='/import-exam' element={<ImportExam/>}/>
            {/* save(false) đẩy về '/' — không khai báo thì test nào chạm
                vào "Tạo thẳng đề" sẽ nổ ở chỗ không liên quan. */}
            <Route path='/' element={<div>TRANG CHỦ</div>}/>
        </Routes>
    </MemoryRouter>
);

/** Bắt chước giáo viên chọn file .docx: BE trả về bản xem trước. */
async function napFile() {
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [DE], warnings: []});
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['x'], 'de.docx');
    fireEvent.change(input, {target: {files: [file]}});
    await screen.findByText(/Đọc được 1 đề/);
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api, 'get').mockImplementation(async (url: string) => {
        if (url === 'question_bank/list') return [{id: 'B1', name: 'NH Toán 12'}];
        return [];
    });
});

describe('ImportExam: dòng hint sau khi lưu', () => {
    it('lần lưu sau thất bại thì không được giữ lại hint "đã thêm N khối"', async () => {
        let lanDau = true;
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/save') {
                if (lanDau) { lanDau = false; return {saved: 12}; }
                throw {message: 'Ngân hàng đầy'};
            }
            return {};
        });
        ve();
        await napFile();

        fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/));
        await screen.findByText('Đã thêm 12 khối vào ngân hàng.');

        // Lần hai hỏng giữa chừng: KHÔNG khối nào được thêm. Hint cũ còn nguyên
        // là giáo viên đọc xong tưởng lần này cũng vào 12 khối rồi đóng tab.
        fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/));
        await screen.findByText('Ngân hàng đầy');
        expect(screen.queryByText('Đã thêm 12 khối vào ngân hàng.')).toBeNull();
    });
});

describe('ImportExam: đo trùng', () => {
    it('đo trùng hỏng phải báo lỗi, không im lặng như thể sạch trùng', async () => {
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/check_trung') throw {error: 'Ngân hàng đang bận'};
            return {};
        });
        ve();
        await napFile();

        fireEvent.click(screen.getByText(/Kiểm tra trùng lặp/));
        await screen.findByText('Ngân hàng đang bận');
    });

    it('có câu trùng thì hiện tỷ lệ trên đúng câu đó', async () => {
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/check_trung')
                return {trung: {Q1: {score: 0.97, khop: [{khoi: 'K9', score: 0.97}]}}};
            return {};
        });
        ve();
        await napFile();

        fireEvent.click(screen.getByText(/Kiểm tra trùng lặp/));
        await screen.findByText('1 câu trùng');
    });
});

describe('ImportExam: chặn lưu sai chỗ', () => {
    it('không có ?bank= thì khoá nút lưu vào ngân hàng', async () => {
        vi.spyOn(Api, 'post').mockResolvedValue({});
        ve('/import-exam');
        await napFile();

        const nut = screen.getByText(/Lưu 1 đề vào ngân hàng/).closest('button')!;
        // Khối không có ngân hàng thì rơi vào rổ chung không tên không môn,
        // không màn nào rút ra được.
        expect(nut.disabled).toBe(true);
        expect(screen.getByText(/Muốn lưu vào ngân hàng thì vào/)).toBeTruthy();
    });
});

// ──────────────────────────────────────────────────────────────────────
// Lát nối: thao tác trên màn hình → payload gửi lên question_bank/save
// ──────────────────────────────────────────────────────────────────────
//
// `convertData` được test riêng, `split_blocks` có self-check bên BE. Khúc
// giữa thì không ai giữ: thứ quyết định câu vào ngăn nào trong ngân hàng là
// `type` và `max_words` của CHÍNH payload này. Gửi sai thì BE phân loại đúng
// theo dữ liệu sai — khối nằm nhầm ngăn, tồn kho báo đủ mà rút đề ra sai cấu
// trúc, giáo viên không thấy gì bất thường cho tới lúc học sinh đang thi.

/** Đề có một câu trắc nghiệm và một câu tự luận, để đổi loại và nhập giới hạn từ. */
const DE_HON_HOP = {
    ...DE,
    sections: [{
        id: 'S1',
        name: 'Phần I',
        question_type: 'MultipleChoice',
        questions: [
            DE.sections[0].questions[0],
            {
                id: 'Q2',
                type: 'FreeAnswer',
                data: {question: '<p>Viết đoạn văn về quê hương.</p>'},
            },
        ],
    }],
};

/** Nạp đề hỗn hợp, trả về hàm đọc payload đã gửi lên question_bank/save. */
async function napDeHonHop() {
    const daGui: any[] = [];
    vi.spyOn(Api, 'post').mockImplementation(async (url: string, body?: any) => {
        if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
        if (url === 'question_bank/save') { daGui.push(body); return {saved: 2}; }
        return {};
    });
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [DE_HON_HOP], warnings: []});

    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, {target: {files: [new File(['x'], 'de.docx')]}});
    await screen.findByText(/Đọc được 1 đề/);

    return {
        daGui,
        luu: () => fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/)),
        cau: (qid: string) => daGui[0].sections[0].questions.find((q: any) => q.id === qid),
    };
}

/**
 * Đổi loại câu ĐẦU TIÊN. Mỗi câu một Dropdown riêng và cả hai cùng liệt kê 5
 * loại, nên `getByText('Đúng / Sai')` khớp nhiều phần tử — phải tìm trong
 * đúng dropdown của câu 1.
 */
function doiLoaiCau1(ten: string) {
    const dd = document.querySelectorAll('.import-type')[0] as HTMLElement;
    fireEvent.click(dd);
    fireEvent.click(within(dd).getByText(ten));
}

describe('ImportExam: payload quyết định câu vào ngăn nào', () => {
    it('giới hạn từ nhập trên màn hình phải đi lên BE dạng SỐ', async () => {
        ve();
        const t = await napDeHonHop();

        // Ô "giới hạn từ" chỉ hiện ở câu không phải trắc nghiệm.
        const o = document.querySelector('.import-wordlimit input') as HTMLInputElement;
        fireEvent.change(o, {target: {value: '200'}});

        t.luu();
        await screen.findByText(/Đã thêm 2 khối/);

        // BE so max_words với ngưỡng 50/400 để chia TraLoiNgan/VietDoan/VietBai.
        // Gửi chuỗi '200' thì so sánh trong Python 3 ném TypeError, còn Python 2
        // so chuỗi với số ra kết quả tuỳ ý — cả hai đều cho ngăn sai.
        expect(t.cau('Q2').data.max_words).toBe(200);
    });

    it('đổi loại câu thì payload mang loại MỚI, không giữ loại parser đoán', async () => {
        ve();
        const t = await napDeHonHop();

        // Parser chỉ đoán được Trắc nghiệm / Tự luận. Ba loại còn lại giáo viên
        // tự chọn — và chính lựa chọn đó quyết định ngăn trong ngân hàng.
        doiLoaiCau1('Đúng / Sai');

        t.luu();
        await screen.findByText(/Đã thêm 2 khối/);

        expect(t.cau('Q1').type).toBe('TrueFalse');
        // Và phải sạch dữ liệu riêng của loại cũ: answers của trắc nghiệm còn
        // sót lại thì BE lưu nguyên vào Question.data, TrueFalse.jsx đọc phải
        // mảng phương án ở chỗ nó chờ boolean.
        expect(t.cau('Q1').data.answers).toBeUndefined();
    });

    it('đổi loại một câu KHÔNG được đổi loại câu khác trong cùng phần', async () => {
        ve();
        const t = await napDeHonHop();

        doiLoaiCau1('Đúng / Sai');

        t.luu();
        await screen.findByText(/Đã thêm 2 khối/);

        // Câu 2 không bị đụng tới. BE nhận `type` của từng câu, nên một câu
        // đổi mà kéo cả phần đổi theo là cả phần vào nhầm ngăn.
        expect(t.cau('Q2').type).toBe('FreeAnswer');
    });

    it('ngữ liệu sửa trên màn hình đi lên cho CẢ nhóm, không riêng câu đầu', async () => {
        const daGui: any[] = [];
        vi.spyOn(Api, 'post').mockImplementation(async (url: string, body?: any) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/save') { daGui.push(body); return {saved: 1}; }
            return {};
        });
        // Hai câu chung một passageId — BE gom chúng thành MỘT khối DocHieu
        // theo đúng field này. Mất passageId là tách câu khỏi bài đọc.
        vi.spyOn(Api, 'upload').mockResolvedValue({
            exams: [{
                ...DE,
                sections: [{
                    id: 'S1', name: 'Phần I', question_type: 'MultipleChoice',
                    questions: [1, 2].map(i => ({
                        id: 'Q' + i,
                        type: 'MultipleChoice',
                        data: {
                            question: '<p>Câu ' + i + '</p>',
                            passage: '<p>Quê hương là chùm khế ngọt</p>',
                            passageId: 'P1',
                            answers: [{id: 'A1', value: '2'}],
                            correctAnswerId: 'A1',
                        },
                    })),
                }],
            }],
            warnings: [],
        });
        ve();
        const input = document.querySelector('input[type=file]') as HTMLInputElement;
        fireEvent.change(input, {target: {files: [new File(['x'], 'de.docx')]}});
        await screen.findByText(/Đọc được 1 đề/);

        fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/));
        await screen.findByText(/Đã thêm 1 khối/);

        const qs = daGui[0].sections[0].questions;
        expect(qs.map((q: any) => q.data.passageId)).toEqual(['P1', 'P1']);
    });
});
