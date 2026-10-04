import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import Api from '../../services/api';
import DoExam from './DoExam';

// Đây là màn TRỪ LƯỢT. `GET exam/during_test/<id>` tốn một lượt của học sinh
// mỗi lần mở lượt mới, nên mọi thứ ở đây đo bằng tiền:
//   - gọi hai lần  = trừ hai lượt cho một lần thi
//   - hết lượt mà vẫn vào = học sinh rơi vào phòng thi không có bài
//   - đồng hồ tính lại từ duration = đóng tab 20 phút rồi mở lại được cấp
//     thêm nguyên 20 phút, trong khi server đã chốt hạn nộp.

const DE = {
    id: 'E1',
    name: 'Đề kiểm tra',
    duration: 45,
    remaining_sec: 600,
    sections: [{
        id: 'S1',
        exam: 'E1',
        name: 'Phần I',
        question_type: 'MultipleChoice',
        questions: [{
            id: 'Q1',
            type: 'MultipleChoice',
            exam: 'E1',
            section: 'S1',
            data: {
                question: '<p>1+1=?</p>',
                answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}],
            },
            markedAnswer: null,
        }],
    }],
};

const daDi: string[] = [];
function DaChuyenTrang() {
    daDi.push(useLocation().pathname);
    return <div>ĐÃ RỜI TRANG</div>;
}

const ve = () => render(
    <MemoryRouter initialEntries={['/do-exam/E1']}>
        <Routes>
            <Route path='/do-exam/:examId' element={<DoExam/>}/>
            <Route path='/packages' element={<DaChuyenTrang/>}/>
        </Routes>
    </MemoryRouter>
);

beforeEach(() => {
    daDi.length = 0;
    vi.restoreAllMocks();
    vi.spyOn(Api, 'post').mockResolvedValue({});
});

afterEach(() => vi.useRealTimers());

describe('DoExam: mở đề — mỗi lần gọi là một lượt', () => {
    it('mở đề chỉ được gọi during_test ĐÚNG MỘT LẦN', async () => {
        // RULES.md mục 3 cảnh báo: bọc during_test bằng useQuery mà quên
        // retry:false thì mỗi lần retry là một lượt của học sinh bay mất.
        // Hiện DoExam gọi thẳng Api.get — test này chốt lại con số đó.
        const get = vi.spyOn(Api, 'get').mockResolvedValue(DE);
        ve();
        await screen.findByText(/1\+1/);

        const goi = get.mock.calls.filter(c => String(c[0]).startsWith('exam/during_test'));
        expect(goi.length).toBe(1);
    });

    it('lỗi mạng KHÔNG được gọi lại during_test — retry là mất thêm lượt', async () => {
        const get = vi.spyOn(Api, 'get').mockRejectedValue({message: 'Network error'});
        ve();
        await screen.findByText(/Network error/);

        // Thà báo lỗi cho học sinh bấm lại, còn hơn âm thầm trừ lượt thứ hai.
        const goi = get.mock.calls.filter(c => String(c[0]).startsWith('exam/during_test'));
        expect(goi.length).toBe(1);
    });
});

describe('DoExam: hết lượt và đề có phí', () => {
    it('402 hết lượt thì chặn tại chỗ, KHÔNG đá sang trang khác', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 402});
        ve();

        // Học sinh đang muốn làm ĐÚNG đề này — đá sang /packages là mất ngữ cảnh,
        // mua xong không biết đường quay lại.
        await waitFor(() => expect(document.body.textContent).not.toMatch(/ĐÃ RỜI TRANG/));
        expect(daDi).toEqual([]);
    });

    it('403 đề chưa mua thì đưa sang trang gói', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({code: 403});
        ve();
        await screen.findByText('ĐÃ RỜI TRANG');
        expect(daDi).toContain('/packages');
    });

    it('lỗi khác phải hiện ra, không để loader quay mãi', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({message: 'Đề đã bị xoá'});
        ve();
        await screen.findByText('Đề đã bị xoá');
    });
});

describe('DoExam: F5 ngay sau khi nộp', () => {
    it('BE trả bài đã nộp thì hiện kết quả, không mở lượt mới', async () => {
        // Lỗi này đã trừ oan 4 lượt của học sinh thật trên production.
        vi.spyOn(Api, 'get').mockResolvedValue({
            ...DE, da_nop: true, score: 8, max_score: 10,
            graded_max_score: 10, pending_count: 0, status: 'GRADED',
        });
        ve();

        // Phải nhảy thẳng sang màn kết quả. Khẳng định vào thứ CHỈ có khi
        // da_nop được xử lý đúng — "không thấy câu hỏi" là chưa đủ, đề cũng
        // không hiện vì nhiều lý do khác và test sẽ xanh vì nhầm lý do.
        await screen.findByText('Đã nộp bài');
        expect(screen.queryByText(/1\+1/)).toBeNull();
    });
});

describe('DoExam: đồng hồ chốt ở server', () => {
    it('đếm theo remaining_sec chứ KHÔNG tính lại từ duration', async () => {
        // remaining_sec=600 (10 phút còn lại) trong khi duration=45 phút.
        // Lấy duration là học sinh đóng tab 35 phút rồi mở lại được cấp lại
        // nguyên 45 phút, trong khi server đã chốt hạn nộp từ lâu.
        vi.spyOn(Api, 'get').mockResolvedValue(DE);
        ve();
        await screen.findByText(/1\+1/);
        await screen.findByText('10:00');
        expect(screen.queryByText('45:00')).toBeNull();
    });

    it('remaining_sec = null (đề không giới hạn giờ) thì rơi về duration', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...DE, remaining_sec: null});
        ve();
        await screen.findByText(/1\+1/);
        await screen.findByText('45:00');
    });

    it('remaining_sec nhỏ vẫn hiện đúng, không âm', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue({...DE, remaining_sec: 5});
        ve();
        await screen.findByText(/1\+1/);
        await screen.findByText('0:05');
    });
});
