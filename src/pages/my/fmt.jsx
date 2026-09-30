import React from 'react';
import {Label} from 'semantic-ui-react';

/**
 * Định dạng dùng chung cho các màn bài làm / chấm bài / hoá đơn.
 *
 * ponytail: gom một chỗ vì luật "chưa chấm xong thì KHÔNG hiện điểm như điểm
 * cuối" phải giống nhau ở cả ba màn. Chép ba bản là ba chỗ lệch nhau về sau.
 */

export function fmtDate(iso) {
    if (!iso) return '—';
    // BE trả UTC không kèm 'Z' (datetime.utcnow().isoformat()) -> trình duyệt
    // hiểu nhầm là giờ máy. Thêm 'Z' để đổi sang giờ Việt Nam cho đúng.
    let d = new Date(/[Z+]/.test(iso) ? iso : iso + 'Z');
    return isNaN(d) ? '—' : d.toLocaleString('vi-VN');
}

export function fmtDuration(sec) {
    if (!sec) return '—';
    let m = Math.floor(sec / 60);
    return m < 60 ? m + ' phút' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
}

export function fmtMoney(amount) {
    return (amount || 0).toLocaleString('vi-VN') + ' đ';
}

/**
 * Điểm của một bài.
 *
 * ponytail: còn câu tự luận chưa chấm thì hiện "chờ chấm", KHÔNG hiện điểm
 * tạm. Học sinh làm đúng hết trắc nghiệm mà tự luận chưa chấm sẽ thấy "5/10"
 * và tưởng mình bị 5 điểm — khiếu nại ngay, dù giáo viên chưa chấm gì.
 */
export function ScoreLabel({sub}) {
    if (sub.pending_count > 0) {
        return <Label size='small' color='yellow'>
            chờ chấm{sub.pending_count > 1 ? ' (' + sub.pending_count + ' câu)' : ''}
        </Label>;
    }

    let ratio = sub.max_score ? sub.score / sub.max_score : 0;
    let color = ratio >= 0.8 ? 'green' : ratio >= 0.5 ? 'olive' : 'red';

    return <Label size='small' color={color}>
        {round(sub.score)} / {round(sub.max_score)}
    </Label>;
}

// 1.5 giữ nguyên, 2.0 hiện là 2 — không ai viết điểm là "2.0".
function round(n) {
    return Math.round((n || 0) * 100) / 100;
}
