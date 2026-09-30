import React from 'react';
import renderHTML from './SafeHtml';

/**
 * Ngữ liệu đọc hiểu dùng chung cho cả nhóm câu ("Đọc văn bản 1 và trả lời các
 * câu hỏi từ 1 đến 5").
 *
 * ponytail: mỗi câu trong nhóm giữ MỘT BẢN SAO ngữ liệu (data.passage) kèm
 * data.passageId. In thẳng ra là lặp 5 lần. Component này lọc theo passageId
 * để chỉ in ở câu ĐẦU nhóm — logic giống nhau ở màn làm bài, xem trước, in đề
 * và soạn đề nên để một chỗ, sửa một lần.
 *
 * `prev` là câu liền trước trong cùng section (các câu cùng nhóm luôn liền kề).
 */
export default function Passage({question, prev}) {
    let {passage, passageId} = question.data || {};
    if (!passage) return null;
    if (prev && prev.data && prev.data.passageId === passageId) return null;

    return <div className='passage'>{renderHTML(passage)}</div>;
}
