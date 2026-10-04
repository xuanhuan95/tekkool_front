import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
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
