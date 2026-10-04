import {describe, it, expect} from 'vitest';
import {fmtDate, fmtDuration, fmtMoney, round} from './fmt';

describe('round', () => {
    it('cắt đuôi float, không hiện 2.9999999999999996', () => {
        // Văn: 10 câu x 0.3 điểm. 0.3 không biểu diễn chính xác trong float.
        const sum = Array(10).fill(0.3).reduce((a, b) => a + b, 0);
        expect(sum).not.toBe(3);           // đây là lý do hàm này tồn tại
        expect(round(sum)).toBe(3);
    });

    it('2.0 hiện là 2, 1.5 giữ nguyên', () => {
        expect(round(2.0)).toBe(2);
        expect(round(1.5)).toBe(1.5);
    });

    it('không có điểm thì là 0, không phải NaN', () => {
        expect(round(undefined)).toBe(0);
        expect(round(null)).toBe(0);
        // 0 điểm là điểm thật, không được nhầm thành "chưa có".
        expect(round(0)).toBe(0);
    });
});

describe('fmtDate', () => {
    it('BE trả UTC thiếu Z vẫn phải đổi đúng sang giờ Việt Nam', () => {
        // datetime.utcnow().isoformat() không kèm 'Z'. Thiếu xử lý thì trình
        // duyệt hiểu là giờ máy -> lệch 7 tiếng.
        const khongZ = fmtDate('2026-10-04T06:00:00');
        const coZ = fmtDate('2026-10-04T06:00:00Z');
        expect(khongZ).toBe(coZ);
    });

    it('rỗng hoặc rác thì hiện gạch, không vỡ', () => {
        expect(fmtDate(undefined)).toBe('—');
        expect(fmtDate('')).toBe('—');
        expect(fmtDate('khong-phai-ngay')).toBe('—');
    });
});

describe('fmtDuration', () => {
    it('dưới 1 tiếng hiện phút', () => {
        expect(fmtDuration(90)).toBe('1 phút');
        expect(fmtDuration(45 * 60)).toBe('45 phút');
    });

    it('từ 1 tiếng trở lên hiện giờ, phút đệm 0', () => {
        expect(fmtDuration(60 * 60)).toBe('1h00');
        expect(fmtDuration(65 * 60)).toBe('1h05');
        expect(fmtDuration(125 * 60)).toBe('2h05');
    });

    it('không có thì hiện gạch', () => {
        expect(fmtDuration(undefined)).toBe('—');
        expect(fmtDuration(0)).toBe('—');
    });
});

describe('fmtMoney', () => {
    it('phân cách nghìn theo kiểu Việt Nam', () => {
        expect(fmtMoney(50000)).toBe('50.000 đ');
    });

    it('không có tiền thì là 0, không phải "undefined đ"', () => {
        expect(fmtMoney(undefined)).toBe('0 đ');
    });
});
