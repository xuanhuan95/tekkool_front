import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import Api from '../../services/api';
import DrawExam from './DrawExam';
import type {BankCapacity} from '../../types/exam';

// The "Rút một đề và làm thử" button used to call `this.props.navigate` — withRouter only
// passes match/location/history, so the button threw a TypeError instead of navigating:
// the bank had enough blocks yet the student couldn't enter the exam. The test builds a
// real router to catch exactly that kind of error, instead of mocking navigate and being falsely confident.

const navigated: string[] = [];

/** Destination screen of /do-exam/:id — records that we arrived. */
function Arrived() {
    // useLocation rather than jsdom's location: MemoryRouter keeps history
    // in memory and never touches the page's real URL.
    navigated.push(useLocation().pathname);
    return <div>ĐÃ VÀO ĐỀ</div>;
}

const renderAt = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path='/draw-exam/bank/:bankId' element={<DrawExam/>}/>
            <Route path='/do-exam/:id' element={<Arrived/>}/>
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

function mockBank(capacity: BankCapacity = CAP, stats: any = STATS) {
    vi.spyOn(Api, 'get').mockResolvedValue(stats);
    return vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
        if (url === 'question_bank/capacity') return capacity;
        if (url === 'question_bank/draw') return {id: 'E_new'};
        throw new Error('unknown endpoint: ' + url);
    });
}

describe('DrawExam: drawing an exam', () => {
    it('clicking Draw goes straight to the exam page', async () => {
        mockBank();
        renderAt('/draw-exam/bank/B1');

        const button = await screen.findByText('Rút một đề và làm thử');
        button.click();

        // This is what the old version broke: navigate undefined -> TypeError, staying
        // on the old screen without any notice.
        await waitFor(() => expect(screen.getByText('ĐÃ VÀO ĐỀ')).toBeTruthy());
        expect(navigated).toEqual(['/do-exam/E_new']);
    });

    it('when the BE reports missing blocks (409 via resolve) it shows the error and does not navigate', async () => {
        vi.spyOn(Api, 'get').mockResolvedValue(STATS);
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return CAP;
            return {error: 'Thiếu khối loại Đọc hiểu'};
        });
        renderAt('/draw-exam/bank/B1');

        (await screen.findByText('Rút một đề và làm thử')).click();

        await waitFor(() => expect(screen.getByText('Thiếu khối loại Đọc hiểu')).toBeTruthy());
        expect(navigated).toEqual([]);
    });
});

describe('DrawExam: stock table', () => {
    it('when a type runs out it disables the draw button, so no exam with missing questions', async () => {
        mockBank({...CAP, capacity: 0, bottleneck: null});
        renderAt('/draw-exam/bank/B1');

        const button = await screen.findByText('Rút một đề và làm thử');
        expect(button.closest('button')!.disabled).toBe(true);
        expect(screen.getByText('Chưa đủ khối để rút một đề')).toBeTruthy();
    });

    it('types outside the matrix are still shown — otherwise teachers think blocks vanished', async () => {
        // VietBai has 7 blocks but this subject's matrix doesn't use it -> never
        // drawn. Hiding it makes teachers keep writing that type without understanding
        // why the "drawable" number stays still.
        mockBank(CAP, {per_type: {...STATS.per_type, VietBai: 7}});
        renderAt('/draw-exam/bank/B1');

        await screen.findByText('Rút một đề và làm thử');
        expect(screen.getByText(/7 khối, không nằm trong ma trận/)).toBeTruthy();
    });

    it('a failed load shows an error instead of spinning forever', async () => {
        vi.spyOn(Api, 'get').mockRejectedValue({error: 'Ngân hàng không tồn tại'});
        vi.spyOn(Api, 'post').mockResolvedValue(CAP);
        renderAt('/draw-exam/bank/B1');

        await waitFor(() => expect(screen.getByText('Ngân hàng không tồn tại')).toBeTruthy());
    });
});
