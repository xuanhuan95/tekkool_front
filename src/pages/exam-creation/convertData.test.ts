import {describe, it, expect} from 'vitest';
import {convertData, type QuestionData} from './convertData';

// The old test copied convertData into the test file because ImportExam was JSX. Now the
// function lives in its own module and is imported directly — the two copies can't drift apart.

const MC: QuestionData = {
    question: '<p>Bài thơ nói về mùa nào?</p>',
    answers: [{id: 'a1', value: 'Xuân'}, {id: 'a2', value: 'Hạ'}],
    correctAnswerId: 'a1',
    passage: '<p>Mùa xuân về.</p>',
    passageId: 'E1_0_G1',
};

describe('convertData: keeps shared data', () => {
    it.each(['FreeAnswer', 'TrueFalse', 'FillBlank', 'ErrorIdentify'])(
        'converting to %s must not lose the passage shared by the group', (to) => {
            const r = convertData(MC, to);
            expect(r.passage).toBe(MC.passage);
            expect(r.passageId).toBe(MC.passageId);
            expect(r.question).toBe(MC.question);
        });

    it('a question without a passage does not produce an empty passageId', () => {
        const r = convertData({question: 'x'}, 'FreeAnswer');
        expect('passage' in r).toBe(false);
        expect('passageId' in r).toBe(false);
    });
});

describe('convertData: drops the old type\'s own data', () => {
    it('multiple choice -> free answer: drops the options, leaves no junk in the DB', () => {
        const r = convertData(MC, 'FreeAnswer');
        expect(r.answers).toBeUndefined();
        expect(r.correctAnswerId).toBeUndefined();
    });

    // data.answer means something DIFFERENT per type — carrying it over gives wrong scores.
    it('TrueFalse must not inherit FillBlank\'s string answer', () => {
        const r = convertData({question: 'x', answer: '<p>chuỗi</p>'}, 'TrueFalse');
        expect(r.answer).toBeUndefined();
    });

    it('FillBlank must not inherit TrueFalse\'s boolean answer', () => {
        const r = convertData({question: 'x', answer: true}, 'FillBlank');
        expect(r.answer).toBeUndefined();
    });

    it('TrueFalse must leave the answer EMPTY — presetting true/false is arbitrary', () => {
        const r = convertData({question: 'x', answer: '<p>x</p>'}, 'TrueFalse');
        expect('answer' in r).toBe(false);
    });

    it('multiple choice does not keep the word limit', () => {
        expect(convertData({question: 'x', max_words: 600}, 'MultipleChoice').max_words)
            .toBeUndefined();
    });
});

describe('convertData: builds all fields for the new type', () => {
    it('free answer keeps the word limit', () => {
        expect(convertData({question: 'Viết bài văn', max_words: 600}, 'FreeAnswer').max_words)
            .toBe(600);
    });

    it('free answer -> multiple choice: answers is an empty array so Answers() can map over it without breaking', () => {
        const r = convertData({question: 'Viết đoạn văn'}, 'MultipleChoice');
        expect(Array.isArray(r.answers)).toBe(true);
        expect(r.answers).toHaveLength(0);
        expect(r.correctAnswerId).toBeUndefined();
    });

    it('ErrorIdentify shares the options UI with multiple choice', () => {
        expect(convertData(MC, 'ErrorIdentify').answers).toHaveLength(2);
    });

    it('does not mutate the original object — the import screen keeps the old copy for undo', () => {
        const original = {...MC};
        convertData(MC, 'FreeAnswer');
        expect(MC).toEqual(original);
    });
});
