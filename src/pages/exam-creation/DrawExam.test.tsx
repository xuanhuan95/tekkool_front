import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import Api from '../../services/api';
import DrawExam from './DrawExam';
import type {BankCapacity} from '../../types/exam';

// Nút "Rút một đề và làm thử" từng gọi `this.props.navigate` — withRouter chỉ
// truyền match/location/history, nên nút ném TypeError thay vì chuyển trang:
// ngân hàng đủ khối mà học sinh không vào được đề. Test dựng cả router thật
// để bắt đúng loại lỗi đó, không mock navigate ra rồi tự tin nhầm.

const navigated: string[] = [];

/** Màn đích của /do-exam/:id — ghi lại là đã tới nơi. */
function DaToi() {
    // useLocation chứ không phải location của jsdom: MemoryRouter giữ lịch sử
    // trong bộ nhớ, không đụng tới URL thật của trang.
    navigated.push(useLocation().pathname);
    return <div>ĐÃ VÀO ĐỀ</div>;
}

const ve = (duong: string) => render(
    <MemoryRouter initialEntries={[duong]}>
        <Routes>
            <Route path='/draw-exam/bank/:bankId' element={<DrawExam/>}/>
            <Route path='/do-exam/:id' element={<DaToi/>}/>
        </Routes>
    </MemoryRouter>
);

beforeEach(() => {
    navigated.length = 0;
    vi.restoreAllMocks();
});

const STATS = {per_type: {DocHieu: 10, TracNghiem: 40}};
const CAP: BankCapacity = {
    slots: {DocHieu: 2, TracNghiem: 8},
    capacity: 5,
    bottleneck: ['DocHieu', 5],
    subject: 'Ngữ văn',
};

function mockBank(cap: BankCapacity = CAP, stats: any = STATS) {
    vi.spyOn(Api, 'get').mockResolvedValue(stats);
    return vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
        if (url === 'question_bank/capacity') return cap;
        if (url === 'question_bank/draw') return {id: 'E_moi'};
        throw new Error('endpoint lạ: ' + url);
    });
}

describe('DrawExam: rút đề', () => {
    it('bấm Rút là vào thẳng trang làm bài', async () => {
        mockBank();
        ve('/draw-exam/bank/B1');

        const nut = await screen.findByText('Rút một đề và làm thử');
        nut.click();

        // Đây là phần bản cũ hỏng: navigate undefined -> ném TypeError, ở lại
        // nguyên màn cũ mà không báo gì.
        await waitFor(() => expect(screen.getByText('ĐÃ VÀO ĐỀ')).toBeTruthy());
        expect(navigated).toEqual(['/do-exam/E_moi']);
    });

    it('BE báo thiếu khối (409 về qua resolve) thì hiện lỗi, không chuyển trang', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(STATS);
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return CAP;
            return {error: 'Thiếu khối loại Đọc hiểu'};
        });
        ve('/draw-exam/bank/B1');

        (await screen.findByText('Rút một đề và làm thử')).click();

        await waitFor(() => expect(screen.getByText('Thiếu khối loại Đọc hiểu')).toBeTruthy());
        expect(navigated).toEqual([]);
    });
});

describe('DrawExam: bảng tồn kho', () => {
    it('hết khối một loại thì khoá nút rút, không cho vào đề thiếu câu', async () => {
        mockBank({...CAP, capacity: 0, bottleneck: null});
        ve('/draw-exam/bank/B1');

        const nut = await screen.findByText('Rút một đề và làm thử');
        expect(nut.closest('button')!.disabled).toBe(true);
        expect(screen.getByText('Chưa đủ khối để rút một đề')).toBeTruthy();
    });

    it('loại ngoài ma trận vẫn hiện ra — không thì giáo viên tưởng khối mất', async () => {
        // VietBai có 7 khối nhưng ma trận môn này không dùng -> không bao giờ
        // được rút. Giấu đi là giáo viên soạn tiếp loại đó mà không hiểu sao
        // số "rút được" đứng yên.
        mockBank(CAP, {per_type: {...STATS.per_type, VietBai: 7}});
        ve('/draw-exam/bank/B1');

        await screen.findByText('Rút một đề và làm thử');
        expect(screen.getByText(/7 khối, không nằm trong ma trận/)).toBeTruthy();
    });

    it('tải hỏng thì báo lỗi chứ không quay loader mãi', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({error: 'Ngân hàng không tồn tại'});
        vi.spyOn(Api, 'post').mockResolvedValue(CAP);
        ve('/draw-exam/bank/B1');

        await waitFor(() => expect(screen.getByText('Ngân hàng không tồn tại')).toBeTruthy());
    });
});
