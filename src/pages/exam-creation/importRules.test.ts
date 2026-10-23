import {describe, expect, it} from 'vitest';

import {
    badTrueFalse, countQuestions, examStats, fileProblem, importErrorText, missingKeys, removeQuestions, saveBlocker,
    setPassage, setType, toUnits,
    type ImportedExam, type ImportQuestion,
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
        const bad = exam(mc('1'), mc('2', 'a'), tf('3'));
        expect(missingKeys(bad)).toBe(1);
        expect(saveBlocker([bad])).toBe('Còn 1 câu chưa có đáp án · Còn 1 câu Đúng/Sai chưa đủ 4 ý');
        expect(saveBlocker([])).toBeNull();
        expect(saveBlocker([exam(mc('1', 'a'))])).toBeNull();
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
