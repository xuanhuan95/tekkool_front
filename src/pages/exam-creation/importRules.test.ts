import {describe, expect, it} from 'vitest';

import {
    badTrueFalse, countQuestions, examStats, fileProblem, importErrorText, missingKeys, removeQuestions, saveBlocker,
    setPassage, setType, toUnits,
    missingTfStatements, splitOptions, answerCounts, answerFrame, applyPasted, examIssues, issueKey, missingNumbers, pasteRows, unseenSevere,
    type ImportedExam, type ImportIssue, type ImportQuestion,
} from './importRules';

const mc = (id: string, key?: string): ImportQuestion => ({
    id, type: 'MultipleChoice',
    data: {question: '<p>' + id + '</p>', answers: [{id: id + 'a', value: 'x'}], correctAnswerId: key},
});
const tf = (id: string, pid?: string): ImportQuestion =>
    ({id, type: 'TrueFalse', data: {question: '<p>ý ' + id + '</p>', passage: '<p>stem</p>', passageId: pid, answer: true}});
const exam = (...questions: ImportQuestion[]): ImportedExam =>
    ({id: 'E', name: 'Đề', sections: [{id: 'S', name: 'Phần I', questions}]});

describe('Q13: Đúng/Sai needs exactly 4 ý', () => {
    it('four ý sharing a passageId are one question and pass', () => {
        const e = exam(tf('1', 'P'), tf('2', 'P'), tf('3', 'P'), tf('4', 'P'));
        expect(countQuestions(e)).toBe(1);
        expect(badTrueFalse(e)).toBe(0);
        expect(saveBlocker([e])).toBeNull();
    });

    it('3 or 5 ý, or a lone ý without a passageId, block saving', () => {
        expect(badTrueFalse(exam(tf('1', 'P'), tf('2', 'P'), tf('3', 'P')))).toBe(1);
        expect(badTrueFalse(exam(...['1', '2', '3', '4', '5'].map(i => tf(i, 'P'))))).toBe(1);
        const lone = exam(tf('1'));
        expect(badTrueFalse(lone)).toBe(1);
        expect(saveBlocker([lone])).toBe('Còn 1 câu Đúng/Sai chưa đủ 4 ý');
    });

    it('two groups with different passageId are two questions, and one bad group is counted once', () => {
        const e = exam(tf('1', 'P'), tf('2', 'P'), tf('3', 'P'), tf('4', 'P'), tf('5', 'Q'), tf('6', 'Q'));
        expect(toUnits(e.sections[0].questions).map(u => u.questions.length)).toEqual([4, 2]);
        expect(badTrueFalse(e)).toBe(1);
    });

    it('ý of one group that are not consecutive do not merge', () => {
        const units = toUnits([tf('1', 'P'), mc('m', 'a'), tf('2', 'P')]);
        expect(units).toHaveLength(3);
    });
});

describe('Q12: a pick-one question needs a correct answer', () => {
    it('counts only the ticked exams, and says both reasons at once', () => {
        const bad = exam(mc('1'), mc('2', '2a'), tf('3'));
        expect(missingKeys(bad)).toBe(1);
        expect(saveBlocker([bad])).toBe('Còn 1 câu chưa có đáp án · Còn 1 câu Đúng/Sai chưa đủ 4 ý');
        expect(saveBlocker([])).toBeNull();
        expect(saveBlocker([exam(mc('1', '1a'))])).toBeNull();
    });

    it('ErrorIdentify is pick-one too', () => {
        const q: ImportQuestion = {id: 'e', type: 'ErrorIdentify', data: {question: 'x', answers: []}};
        expect(missingKeys(exam(q))).toBe(1);
    });
});

describe('editing the preview payload', () => {
    it('changing type moves every ý of a group and keeps passage and passageId', () => {
        const e = setType(exam(tf('1', 'P'), tf('2', 'P')), ['1', '2'], 'FreeAnswer');
        expect(e.sections[0].questions.map(q => q.type)).toEqual(['FreeAnswer', 'FreeAnswer']);
        expect(e.sections[0].question_type).toBe('FreeAnswer');
        expect(e.sections[0].questions[0].data).toMatchObject({passage: '<p>stem</p>', passageId: 'P'});
        expect(e.sections[0].questions[0].data.answer).toBeUndefined();
    });

    it('a passage edit goes to the whole group only', () => {
        const e = setPassage(exam(tf('1', 'P'), tf('2', 'P'), tf('3', 'Q')), 'P', '<p>new</p>');
        expect(e.sections[0].questions.map(q => q.data.passage)).toEqual(['<p>new</p>', '<p>new</p>', '<p>stem</p>']);
    });

    it('removing the last question drops the section', () => {
        expect(removeQuestions(exam(mc('1')), ['1']).sections).toEqual([]);
    });

    it('stats list the new Đúng/Sai row with the question number', () => {
        const {total, rows} = examStats(exam(mc('1', 'a'), tf('2', 'P'), tf('3', 'P')));
        expect(total).toBe(2);
        const row = rows.find(r => r[0] === 'Câu Đúng/Sai không đủ 4 ý')!;
        expect(row[1].map(x => x.no)).toEqual([2]);
    });
});

describe('upload checks and messages', () => {
    it('refuses a non-docx or oversized file before uploading', () => {
        expect(fileProblem({name: 'de.pdf', size: 10})).toMatch(/Chỉ nhận file .docx/);
        expect(fileProblem({name: 'de.docx', size: 11 * 1024 * 1024})).toBe('File quá lớn (tối đa 10 MB).');
        expect(fileProblem({name: 'DE.DOCX', size: 1024})).toBeNull();
    });

    it('maps the backend messages and keeps unknown ones visible', () => {
        expect(importErrorText('Khong doc duoc file: bad zip')).toMatch(/hỏng hoặc đang đặt mật khẩu/);
        expect(importErrorText('Khong tim thay de nao trong file')).toMatch(/Câu 1/);
        expect(importErrorText('boom')).toBe('Không đọc được file: boom');
    });
});

describe('SPT-93: coded warnings', () => {
    const iss = (over: Partial<ImportIssue>): ImportIssue => ({
        code: 'COUNT_MISMATCH', level: 'error', exam_id: 'E', section_index: null, question_id: null, question_no: null, message: 'm', ...over,
    });
    const sev = iss({}), gap = iss({code: 'NUMBER_GAP', level: 'warning', question_id: 'q', message: 'gap'});
    const info = iss({code: 'NO_DECLARED_COUNT', level: 'info', message: 'i'});

    it('info is never shown; renumbering drops only the number-jump warnings', () => {
        expect(examIssues([sev, gap, info], 'E').map(i => i.code)).toEqual(['COUNT_MISMATCH', 'NUMBER_GAP']);
        expect(examIssues([sev, gap, info], 'E', true).map(i => i.code)).toEqual(['COUNT_MISMATCH']);
        expect(examIssues([sev], 'OTHER')).toEqual([]);
    });

    it('only Nặng warnings of the ticked exams that were not seen block saving', () => {
        const other = iss({exam_id: 'F', message: 'x'});
        expect(unseenSevere([sev, gap, other], ['E'], {})).toEqual([sev]);
        expect(unseenSevere([sev, gap, other], ['E', 'F'], {[issueKey(sev)]: true})).toEqual([other]);
        expect(unseenSevere([sev], ['E'], {}, {E: true})).toEqual([sev]);   // renumbering does not hide a COUNT_MISMATCH
        expect(unseenSevere([iss({code: 'NUMBER_GAP'})], ['E'], {}, {E: true}).length).toBe(0);
    });

    const num = (id: string, no: number) => ({...mc(id, id + 'a'), source_no: no});

    it('finds the numbers the file has but the reader skipped (per section: the file restarts at Câu 1)', () => {
        const e = exam(num('a', 1), num('b', 2), num('c', 4), num('d', 5));
        expect(missingNumbers(e)).toEqual([{beforeId: 'c', no: 3}]);
        const two = {id: 'E', name: 'Đề', sections: [
            {id: 'S1', name: 'I', questions: [num('a', 1), num('b', 2)]}, {id: 'S2', name: 'II', questions: [num('c', 1)]}]};
        expect(missingNumbers(two)).toEqual([]);
        // an absurd jump is a typo in the file, not 90 lost questions
        expect(missingNumbers(exam(num('a', 1), num('b', 99)))).toEqual([]);
    });

    it('counts answers live (Đúng/Sai per ý, short answer by text)', () => {
        const fill = (id: string, answer?: string): ImportQuestion => ({id, type: 'FillBlank', data: {question: '<p>q</p>', answer}});
        const e = exam(mc('1', '1a'), mc('2'), tf('t1', 'P'), fill('f1', '<p>3,5</p>'), fill('f2'));
        expect(answerCounts(e)).toEqual({total: 5, done: 3});
    });
});

describe('SPT-93: Dán đáp án nhanh', () => {
    const two = (id: string, key?: string): ImportQuestion => ({
        id, type: 'MultipleChoice',
        data: {question: '<p>q</p>', answers: [{id: id + 'A', value: 'x'}, {id: id + 'B', value: 'y'}], correctAnswerId: key},
    });
    const e = exam(two('1', '1A'), two('2'), two('3', '3A'));

    it('applies the BE reply and leaves every other question alone', () => {
        const out = applyPasted(e, {'2': {correctAnswerId: '2B'}, '3': {correctAnswerId: '3B'}});
        expect(out.sections[0].questions.map(q => q.data.correctAnswerId)).toEqual(['1A', '2B', '3B']);
    });

    it('previews new / change / same per question', () => {
        const rows = pasteRows(e, {'1': {correctAnswerId: '1A'}, '2': {correctAnswerId: '2B'}, '3': {correctAnswerId: '3B'}});
        expect(rows.map(r => [r.no, r.now, r.next, r.status])).toEqual([
            [1, 'A', 'A', 'same'], [2, '', 'B', 'new'], [3, 'A', 'B', 'change'],
        ]);
    });

    it('a Đúng/Sai question is one row; the frame has no content, only ids', () => {
        const t = exam(tf('t1', 'P'), tf('t2', 'P'), tf('t3', 'P'), tf('t4', 'P'));
        const rows = pasteRows(t, Object.fromEntries(['t1', 't2', 't3', 't4'].map((id, i) => [id, {answer: i % 2 === 0}])));
        expect(rows).toHaveLength(1);
        expect(rows[0].next).toBe('Đ S Đ S');
        expect(answerFrame(t)[0]).toEqual({id: 't1', type: 'TrueFalse', answer_ids: [], group: 'P'});
        expect(JSON.stringify(answerFrame(e))).not.toContain('<p>');
    });
});

describe('B1: what the BE (invalid_questions_response) refuses, the FE blocks first', () => {
    it('a Đúng/Sai ý without Đúng/Sai blocks saving and names the ý', () => {
        const unset = (id: string): ImportQuestion => ({id, type: 'TrueFalse', data: {question: 'y', passageId: 'P'}});
        const e = exam(tf('1', 'P'), unset('2'), tf('3', 'P'), unset('4'));
        expect(missingTfStatements(toUnits(e.sections[0].questions)[0])).toEqual(['b', 'd']);
        expect(saveBlocker([e])).toBe('Còn 1 câu Đúng/Sai chưa đặt Đúng/Sai cho từng ý');
        expect(saveBlocker([exam(tf('1', 'P'), tf('2', 'P'), tf('3', 'P'), tf('4', 'P'))])).toBeNull();
    });

    it('a correct answer pointing at no option is as bad as none', () => {
        expect(saveBlocker([exam(mc('1', 'ghost'))])).toBe('Còn 1 câu chưa có đáp án');
    });
});

describe('B5: tách A–D', () => {
    it('cuts stem and four options, inline or one per paragraph', () => {
        expect(splitOptions('<p>Chất nào? A. HCl B. NaCl C. KCl D. H₂O</p>')).toEqual({
            stem: '<p>Chất nào?</p>', options: ['<p>HCl</p>', '<p>NaCl</p>', '<p>KCl</p>', '<p>H₂O</p>']});
        expect(splitOptions('<p>Chất nào?</p><p>A. 1</p><p>B. 2</p><p>C. 3</p><p>D. 4</p>')?.options).toEqual(['<p>1</p>', '<p>2</p>', '<p>3</p>', '<p>4</p>']);
    });

    it('is null unless A, B, C, D all appear in order', () => {
        expect(splitOptions('<p>Viết đoạn văn. A. một B. hai</p>')).toBeNull();
        expect(splitOptions('<p>Viết đoạn văn.</p>')).toBeNull();
    });
});

describe('V2-1: tách A–D takes the real A–D run', () => {
    it('"A." inside the stem does not become option A', () => {
        expect(splitOptions('<p>Cho dung dịch A. Chọn A. một B. hai C. ba D. bốn</p>')).toEqual({
            stem: '<p>Cho dung dịch A. Chọn</p>', options: ['<p>một</p>', '<p>hai</p>', '<p>ba</p>', '<p>bốn</p>']});
    });
});
