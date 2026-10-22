import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';

import {
    Button, Card, ConfirmDialog, ExamEnd, ExamHeader, ExamLayout, ExamSection, Modal, QuestionBlock,
    QuestionGrid, QuestionNumberStrip,
} from '../../components/ui';
import type {QuestionGridPart, QuestionStatus, TrueFalseValue} from '../../components/ui';

/*
 * Demo of the exam screen built from the kit: "Toán — Đề thi thử SPT số 3", 23 questions,
 * 4 parts, ONE scrolling page, no previous/next, "Hết đề" + Nộp bài at the end.
 * Presentation only: local state, fake 38:12 clock. The real screen (Sprint 1 item 3) takes the
 * deadline from the server, autosaves and blocks double submit with the API.
 */

const CHOICE = [
    {p: <>Tích phân I = ∫<sub>0</sub><sup>2</sup> (3x<sup>2</sup> − 2x) dx bằng</>, o: ['2', '6', '4', '8']},
    {p: <>Số điểm cực trị của hàm số y = x<sup>3</sup> − 3x + 2 là</>, o: ['0', '1', '2', '3']},
    {p: <>Cấp số cộng có u<sub>1</sub> = 2, d = 3. Tính u<sub>10</sub>.</>, o: ['29', '32', '27', '30']},
    {p: 'Trong không gian Oxyz, mặt phẳng nào đi qua gốc toạ độ?',
     o: ['x + y + z − 1 = 0', '2x − y + 3z = 0', 'x − 2 = 0', 'y + z + 4 = 0']},
];
const TF_STATEMENTS = [
    {key: 'a', content: <>f′(x) = 3x<sup>2</sup> − 6x.</>},
    {key: 'b', content: 'Hàm số đồng biến trên khoảng (0; 2).'},
    {key: 'c', content: 'Giá trị cực tiểu của hàm số bằng −2.'},
    {key: 'd', content: 'Đồ thị cắt trục tung tại điểm (0; 2).'},
];

type Answers = Record<number, string | TrueFalseValue | null>;

const PARTS = [
    {id: 'phan-1', title: 'Phần I · Trắc nghiệm', grid: 'Phần I · Trắc nghiệm', from: 1, to: 12,
     note: 'Câu 1–12 · 0,25 điểm/câu · chọn 1 trong 4 đáp án'},
    {id: 'phan-2', title: 'Phần II · Đúng / Sai', grid: 'Phần II · Đúng/Sai', from: 13, to: 16,
     note: 'Câu 13–16 · tối đa 1 điểm/câu · đúng 1 ý 0,1đ · 2 ý 0,25đ · 3 ý 0,5đ · 4 ý 1đ'},
    {id: 'phan-3', title: 'Phần III · Trả lời ngắn', grid: 'Phần III · Trả lời ngắn', from: 17, to: 22,
     note: 'Câu 17–22 · 0,25 điểm/câu · chỉ ghi kết quả'},
    {id: 'phan-4', title: 'Phần IV · Tự luận', grid: 'Phần IV · Tự luận', from: 23, to: 23,
     note: 'Câu 23 · 1,5 điểm · trình bày lời giải'},
];
const TOTAL = 23;

function isAnswered(v: Answers[number]): boolean {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    return Object.values(v).some(x => x === true || x === false);
}

export default function DevExam() {
    const navigate = useNavigate();
    const [answers, setAnswers] = useState<Answers>({1: 'C', 2: 'B', 13: {a: true, b: false, d: true}, 17: '2,5'});
    const [flags, setFlags] = useState<Set<number>>(new Set([5, 13]));
    const [current, setCurrent] = useState(1);
    const [seconds, setSeconds] = useState(38 * 60 + 12);
    const [sheet, setSheet] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Demo clock only.
    useEffect(() => {
        const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, []);

    // Highlight the question in view (strip + grid). Demo-grade; the real screen may refine.
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(entries => {
            const top = entries.filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (top) setCurrent(Number(top.target.id.replace('cau-', '')));
        }, {rootMargin: '-200px 0px -55% 0px'});
        document.querySelectorAll('[id^="cau-"]').forEach(el => io.observe(el));
        return () => io.disconnect();
    }, []);

    const status: QuestionStatus[] = useMemo(() => Array.from({length: TOTAL}, (_, i) => ({
        number: i + 1, answered: isAnswered(answers[i + 1]), flagged: flags.has(i + 1),
    })), [answers, flags]);
    const answered = status.filter(q => q.answered).length;
    const gridParts: QuestionGridPart[] = PARTS.map(p => ({title: p.grid, questions: status.slice(p.from - 1, p.to)}));

    const set = (n: number) => (v: string | TrueFalseValue) => setAnswers(a => ({...a, [n]: v}));
    const flag = (n: number) => () => setFlags(f => { const x = new Set(f); if (x.has(n)) x.delete(n); else x.add(n); return x; });
    const jump = (n: number) => {
        setSheet(false);
        setCurrent(n);
        document.getElementById('cau-' + n)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    };
    const submit = () => { setSubmitting(true); setTimeout(() => { setSubmitting(false); setConfirm(false); }, 1500); };
    const left = TOTAL - answered;

    const common = (n: number) => ({number: n, flagged: flags.has(n), onToggleFlag: flag(n)});

    return <ExamLayout
        header={<ExamHeader title='Toán · Đề thi thử SPT số 3' secondsLeft={seconds} answered={answered} total={TOTAL}
                            onExit={() => navigate('/dev/ui')} onSubmit={() => setConfirm(true)}
                            strip={<QuestionNumberStrip questions={status} current={current} onJump={jump}
                                                        onOpenAll={() => setSheet(true)}/>}/>}
        aside={<Card>
            <QuestionGrid showHeading parts={gridParts} current={current} onJump={jump}
                          footer={<Button variant='primary' block onClick={() => setConfirm(true)}>Nộp bài</Button>}/>
        </Card>}>

        <ExamSection {...PARTS[0]}>
            {Array.from({length: 12}, (_, i) => {
                const n = i + 1, q = CHOICE[i % CHOICE.length];
                return <QuestionBlock key={n} kind='choice' {...common(n)} prompt={q.p}
                                      options={q.o.map((c, j) => ({key: 'ABCD'[j], content: c}))}
                                      value={answers[n] as string | null} onChange={set(n)}/>;
            })}
        </ExamSection>

        <ExamSection {...PARTS[1]}>
            {[13, 14, 15, 16].map(n =>
                <QuestionBlock key={n} kind='truefalse' {...common(n)}
                               prompt={<>Cho hàm số f(x) = x<sup>3</sup> − 3x<sup>2</sup> + 2. Xét tính đúng, sai của các mệnh đề sau.</>}
                               statements={TF_STATEMENTS} value={answers[n] as TrueFalseValue} onChange={set(n)}/>)}
        </ExamSection>

        <ExamSection {...PARTS[2]}>
            {[17, 18, 19, 20, 21, 22].map(n =>
                <QuestionBlock key={n} kind='short' {...common(n)}
                               label={n === 17 ? 'Kết quả (đơn vị: giờ)' : 'Kết quả'}
                               prompt={n === 17
                                   ? <>Bể hình hộp chữ nhật (rỗng) có đáy 2 m × 1,6 m, bơm nước 1,6 m<sup>3</sup>/giờ. Sau bao nhiêu giờ mực nước cao 1,25 m?</>
                                   : <>Cấp số nhân có u<sub>1</sub> = 3, công bội q = 2. Tính tổng 6 số hạng đầu tiên.</>}
                               value={(answers[n] as string) || ''} onChange={set(n)}/>)}
        </ExamSection>

        <ExamSection {...PARTS[3]}>
            <QuestionBlock kind='essay' {...common(23)} title='Câu 23 · 1,5 điểm'
                           prompt='Bác An có 120 m lưới để rào một mảnh vườn hình chữ nhật sát bờ sông (cạnh giáp bờ sông không cần rào). Tìm kích thước mảnh vườn để diện tích lớn nhất.'
                           value={(answers[23] as string) || ''} onChange={set(23)}
                           onTool={() => {}} onAttach={() => {}}/>
        </ExamSection>

        <ExamEnd answered={answered} total={TOTAL} flagged={flags.size} savedAt='20:41'
                 submitting={submitting} onSubmit={() => setConfirm(true)}/>

        <Modal open={sheet} onClose={() => setSheet(false)} title='Đi tới câu' placement='sheet' showClose>
            <QuestionGrid parts={gridParts} current={current} onJump={jump}/>
        </Modal>
        <ConfirmDialog open={confirm} title='Nộp bài?' cancelLabel='Làm tiếp' confirmLabel='Nộp bài' loading={submitting}
                       message={left > 0 ? `Bạn còn ${left} câu chưa làm. Nộp rồi sẽ không sửa được bài.`
                           : 'Nộp rồi sẽ không sửa được bài.'}
                       onCancel={() => setConfirm(false)} onConfirm={submit}/>
    </ExamLayout>;
}
