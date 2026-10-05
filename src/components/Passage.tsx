import renderHTML from './SafeHtml';
import type {Question} from '../pages/exam-creation/Default';

/** Danh sách passageId theo thứ tự xuất hiện trong section (bỏ trùng). */
const nhomTrongPhan = (questions: Question[]): (string | undefined)[] => {
    const ra: (string | undefined)[] = [];
    for (const q of questions || []) {
        const id = q.data && q.data.passageId;
        if (q.data && q.data.passage && !ra.includes(id)) ra.push(id);
    }
    return ra;
};

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
 * `questions` là cả section, chỉ dùng để đánh số văn bản.
 */
export default function Passage(
    {question, prev, questions}: {question: Question; prev?: Question; questions?: Question[]},
) {
    const {passage, passageId} = question.data || {};
    if (!passage) return null;
    if (prev && prev.data && prev.data.passageId === passageId) return null;

    // Đánh số theo THỨ TỰ TRONG ĐỀ ĐANG XEM, không phải số của đề gốc: khối rút
    // từ ngân hàng mang theo số cũ thì "Phần I" lại hiện "Văn bản 2", mà hai
    // khối cùng rút vào một đề còn cùng mang một số.
    // Một văn bản thì không đánh số — "Văn bản 1" đứng trơ một mình là chữ thừa.
    const nhom = nhomTrongPhan(questions || []);
    const so = nhom.length > 1 ? nhom.indexOf(passageId) + 1 : 0;

    return <div className='passage'>
        {so > 0 && <p><b>VĂN BẢN {so}</b></p>}
        {renderHTML(passage)}
    </div>;
}
