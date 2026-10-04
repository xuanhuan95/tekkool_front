import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
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

// ──────────────────────────────────────────────────────────────────────
// S3.2 hết giờ · S3.4 mất mạng giữa chừng
// ──────────────────────────────────────────────────────────────────────

describe('DoExam: hết giờ (S3.2)', () => {
    it('hết giờ thì tự nộp, KHÔNG hỏi confirm', async () => {
        // finish() có window.confirm. Hết giờ mà vẫn hỏi "có chắc không" là vô
        // nghĩa: thí sinh bấm Cancel rồi ngồi làm tiếp quá giờ.
        vi.spyOn(Api, 'get').mockResolvedValue({...DE, remaining_sec: 2});
        const post = vi.spyOn(Api, 'post').mockResolvedValue({score: 5, max_score: 10});
        const hoi = vi.spyOn(window, 'confirm').mockReturnValue(false);
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        ve();
        await screen.findByText(/1\+1/);

        // Đẩy đồng hồ máy qua hạn rồi cho interval chạy.
        const that = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(that + 3000);
        await waitFor(() => {
            const nop = post.mock.calls.filter(c => String(c[0]).startsWith('exam/submit'));
            expect(nop.length).toBe(1);
        });
        expect(hoi).not.toHaveBeenCalled();
    });

    it('nộp tự động hỏng vẫn khoá bài, không trả về màn làm bài', async () => {
        // Mạng rớt đúng lúc hết giờ: không được để thí sinh làm tiếp vô hạn
        // trong khi server đã chốt hạn nộp.
        vi.spyOn(Api, 'get').mockResolvedValue({...DE, remaining_sec: 2});
        vi.spyOn(Api, 'post').mockRejectedValue({message: 'Network error'});
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        ve();
        await screen.findByText(/1\+1/);

        const that = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(that + 3000);
        await screen.findByText('Đã nộp bài');
    });
});

describe('DoExam: mất mạng khi đang làm (S3.4)', () => {
    it('lưu đáp án hỏng phải báo cho học sinh, không im lặng nuốt', async () => {
        // setAnswer `await Api.post(...)` rồi mới ghi vào state. Post ném thì
        // state không đổi VÀ không có thông báo nào: học sinh bấm đáp án, thấy
        // nút không sáng, tưởng mình bấm hụt, bấm lại — bài vẫn không được lưu.
        vi.spyOn(Api, 'get').mockResolvedValue(DE);
        vi.spyOn(Api, 'post').mockRejectedValue({message: 'Failed to fetch'});
        const bao = vi.spyOn(window, 'alert').mockImplementation(() => {});
        ve();
        await screen.findByText(/1\+1/);

        // Semantic Radio: click phải vào chính <input>, click <label> qua
        // Node.click() không chạy onChange trong jsdom.
        const o = document.querySelector('input[type=radio][value="2"]')!;
        fireEvent.click(o);

        await waitFor(() => expect(bao).toHaveBeenCalled());
    });

    it('đáp án đã lưu trước đó hiện lại sau khi vào lại đề', async () => {
        // Vào lại giữa chừng: BE trả đề kèm markedAnswer. Không đọc field này
        // thì bài làm 30 phút của học sinh hiện ra trắng trơn.
        vi.spyOn(Api, 'get').mockResolvedValue({
            ...DE,
            sections: [{
                ...DE.sections[0],
                // DoExam so checked bằng answer.VALUE chứ không phải id
                // (core_grading.py ghi rõ FE lưu value). Đặt 'A1' ở đây là
                // test sai, không phải code sai.
                questions: [{...DE.sections[0].questions[0], markedAnswer: '2'}],
            }],
        });
        ve();
        await screen.findByText(/1\+1/);

        const o = document.querySelector('input[type=radio][value="2"]') as HTMLInputElement;
        expect(o.checked).toBe(true);
        // Phương án không chọn phải KHÔNG sáng — nếu không, test xanh kể cả
        // khi mọi radio đều checked.
        const khac = document.querySelector('input[type=radio][value="3"]') as HTMLInputElement;
        expect(khac.checked).toBe(false);
    });
});

// ──────────────────────────────────────────────────────────────────────
// S5.1/5.2 còn câu chờ chấm · S5.6 thời gian làm bài sau F5
// ──────────────────────────────────────────────────────────────────────

/** Vào lại đề đã nộp (BE trả `da_nop`) — đường duy nhất tới màn kết quả. */
const daNop = (them: Record<string, unknown>) => ({
    ...DE, da_nop: true, status: 'GRADING', ...them,
});

describe('DoExam: màn kết quả khi còn câu chờ chấm (S5.1/S5.2)', () => {
    it('mẫu số là graded_max_score, KHÔNG phải max_score cả bài', async () => {
        // Bài 10 trắc nghiệm (10đ) + 2 tự luận (2đ). Máy mới chấm phần trắc
        // nghiệm: 8/10. Lấy mẫu số 12 thành "8/12" — học sinh đọc ra là mình
        // sai 4 câu, trong khi thực tế chỉ sai 2 và 2 câu kia chưa ai chấm.
        vi.spyOn(Api, 'get').mockResolvedValue(daNop({
            score: 8, graded_max_score: 10, max_score: 12, pending_count: 2,
        }));
        ve();
        await screen.findByText('Đã nộp bài');

        await screen.findByText('8/10');
        // Khẳng định ngược: "8/12" KHÔNG được xuất hiện ở đâu cả. Thiếu dòng
        // này thì test vẫn xanh nếu màn hình in cả hai con số.
        expect(screen.queryByText('8/12')).toBeNull();
    });

    it('chưa chấm xong thì nói rõ "chờ chấm", không trình điểm tạm như điểm cuối', async () => {
        // "Điểm của bạn: 8" khi còn 2 câu chưa chấm là nói dối: điểm cuối có
        // thể là 10. Học sinh đóng máy, tưởng đó là điểm thật.
        vi.spyOn(Api, 'get').mockResolvedValue(daNop({
            score: 8, graded_max_score: 10, max_score: 12, pending_count: 2,
        }));
        ve();
        await screen.findByText('Đã nộp bài');

        expect(document.body.textContent).toMatch(/chờ giáo viên chấm/);
        expect(screen.queryByText(/Điểm của bạn/)).toBeNull();
    });

    it('chấm xong hết thì mới hiện điểm cuối trên tổng cả bài', async () => {
        // Mặt còn lại của hai test trên: pending_count = 0 thì PHẢI có điểm
        // cuối. Không có test này thì xoá luôn nhánh hiện điểm vẫn xanh.
        vi.spyOn(Api, 'get').mockResolvedValue(daNop({
            score: 11, graded_max_score: 12, max_score: 12,
            pending_count: 0, status: 'GRADED',
        }));
        ve();
        await screen.findByText('Đã nộp bài');

        await screen.findByText('11/12');
        expect(document.body.textContent).not.toMatch(/chờ giáo viên chấm/);
    });
});

describe('DoExam: thời gian làm bài sau F5 (S5.6)', () => {
    it('lấy duration_sec của bài đã nộp, không hiện "0 phút"', async () => {
        // F5 ở màn kết quả: state.passedTime về 0 vì component dựng lại.
        // Chỉ đọc passedTime là học sinh thấy "làm trong 0 phút" sau khi ngồi
        // làm 23 phút — con số sai nằm ngay cạnh điểm, đọc là mất tin cả trang.
        vi.spyOn(Api, 'get').mockResolvedValue(daNop({
            score: 9, graded_max_score: 10, max_score: 10,
            pending_count: 0, status: 'GRADED', duration_sec: 23 * 60 + 40,
        }));
        ve();
        await screen.findByText('Đã nộp bài');

        // 1420s -> 23 phút (làm tròn xuống), không phải 0.
        await screen.findByText(/Thời gian làm bài: 23 phút/);
    });

    it('bài cũ không có duration_sec thì rơi về passedTime, không nổ', async () => {
        // Bài nộp trước khi BE lưu duration_sec. Phải ra 0 phút một cách êm,
        // không được NaN hay trắng màn.
        vi.spyOn(Api, 'get').mockResolvedValue(daNop({
            score: 9, graded_max_score: 10, max_score: 10, pending_count: 0,
        }));
        ve();
        await screen.findByText('Đã nộp bài');

        expect(document.body.textContent).toMatch(/Thời gian làm bài: 0 phút/);
        expect(document.body.textContent).not.toMatch(/NaN/);
    });
});
