import {describe, it, expect} from 'vitest';
import {render, act} from '@testing-library/react';
import {Editor} from './Editor';

// Giới hạn từ KHÔNG còn chặn gõ (yêu cầu 10/2025): học sinh viết quá bao nhiêu
// cũng được, bộ đếm chỉ để biết. Trước đây một extension ProseMirror nuốt phím
// khi chạm hạn — nếu ai đó dựng lại nó, những ca dưới đây đỏ ngay.
//
// max_words vẫn phải sống: core_question_bank._tu_luan_type phân loại khối
// TraLoiNgan / VietDoan / VietBai bằng chính con số này.

/** Dựng Editor, trả về hàm ghi nội dung và hàm đọc lại text + bộ đếm. */
function dung(props: {maxWords?: number; maxChars?: number}) {
    const ref: {current: any} = {current: null};
    const r = render(<Editor refMedium={ref} {...props}/>);
    return {
        ghi: (html: string) => act(() => { ref.current.medium.setContent(html); }),
        text: () => ref.current.medium.getContent().replace(/<[^>]*>/g, ''),
        dem: () => r.container.querySelector('.tt-charcount'),
        // React in '#db2828' ra 'rgb(219, 40, 40)' — so bằng chuỗi hex là
        // luôn khớp "không đỏ", test xanh giả.
        mau: () => (r.container.querySelector('.tt-charcount') as HTMLElement).style.color,
    };
}

describe('Editor — giới hạn từ chỉ để đếm, không chặn', () => {
    it('viết quá số từ vẫn giữ nguyên chữ, không bị cắt', () => {
        const e = dung({maxWords: 5});
        e.ghi('<p>một hai ba bốn năm sáu bảy tám</p>');
        expect(e.text()).toBe('một hai ba bốn năm sáu bảy tám');
    });

    it('quá hạn ký tự cũng không bị cắt', () => {
        const e = dung({maxChars: 5});
        e.ghi('<p>abcdefghij</p>');
        expect(e.text()).toBe('abcdefghij');
    });

    it('bộ đếm báo đúng số từ THẬT, kể cả khi vượt', () => {
        const e = dung({maxWords: 5});
        e.ghi('<p>một hai ba bốn năm sáu bảy tám</p>');
        expect(e.dem()!.textContent).toBe('8 / 5 từ');
    });

    it('vượt hạn không đổi sang màu đỏ — vượt không còn là lỗi', () => {
        const e = dung({maxWords: 5});
        e.ghi('<p>một hai ba bốn năm sáu bảy tám</p>');
        expect(e.mau()).toBe('rgb(118, 118, 118)');
    });

    it('chưa đặt giới hạn thì không hiện bộ đếm', () => {
        const e = dung({});
        e.ghi('<p>một hai ba</p>');
        expect(e.dem()).toBeNull();
    });
});
