import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import Api from '../../services/api';
import ImportExam from './ImportExam';

// This screen is the only door for getting exams into the system. Two places once
// lied to teachers: the hint line bragging "Đã thêm N khối" after a later save that
// never touched the bank, and the "Kiểm tra trùng lặp" button failing silently —
// no chip showed after the click, looking exactly like "bank has no duplicates".

const EXAM = {
    id: 'E1',
    name: 'Đề thử 1',
    duration: 45,
    source: ['Câu 1. Nội dung'],
    sections: [{
        id: 'S1',
        name: 'Phần I',
        question_type: 'MultipleChoice',
        questions: [{
            id: 'Q1',
            type: 'MultipleChoice',
            data: {
                question: '<p>1+1=?</p>',
                answers: [{id: 'A1', value: '2'}, {id: 'A2', value: '3'}],
                correctAnswerId: 'A1',
            },
        }],
    }],
};

const renderScreen = (path = '/import-exam?bank=B1') => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path='/import-exam' element={<ImportExam/>}/>
            {/* save(false) pushes to '/' — if not declared, any test that touches
                "Tạo thẳng đề" would blow up somewhere unrelated. */}
            <Route path='/' element={<div>TRANG CHỦ</div>}/>
        </Routes>
    </MemoryRouter>
);

/** Imitate a teacher picking a .docx file: the BE returns the preview. */
async function loadFile() {
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [EXAM], warnings: []});
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['x'], 'de.docx');
    fireEvent.change(input, {target: {files: [file]}});
    await screen.findByText(/Đọc được 1 đề/);
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api, 'get').mockImplementation(async (url: string) => {
        if (url === 'question_bank/list') return [{id: 'B1', name: 'NH Toán 12'}];
        return [];
    });
});

describe('ImportExam: hint line after saving', () => {
    it('a failed later save must not keep the "added N blocks" hint', async () => {
        let firstTime = true;
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/save') {
                if (firstTime) { firstTime = false; return {saved: 12}; }
                throw {message: 'Ngân hàng đầy'};
            }
            return {};
        });
        renderScreen();
        await loadFile();

        fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/));
        await screen.findByText('Đã thêm 12 khối vào ngân hàng.');

        // The second run fails midway: NO block was added. If the old hint stays,
        // the teacher reads it, assumes 12 blocks went in again, and closes the tab.
        fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/));
        await screen.findByText('Ngân hàng đầy');
        expect(screen.queryByText('Đã thêm 12 khối vào ngân hàng.')).toBeNull();
    });
});

describe('ImportExam: duplicate check', () => {
    it('a failed duplicate check must report an error, not stay silent as if clean', async () => {
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/check_trung') throw {error: 'Ngân hàng đang bận'};
            return {};
        });
        renderScreen();
        await loadFile();

        fireEvent.click(screen.getByText(/Kiểm tra trùng lặp/));
        await screen.findByText('Ngân hàng đang bận');
    });

    it('a duplicate question shows its rate on exactly that question', async () => {
        vi.spyOn(Api, 'post').mockImplementation(async (url: string) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/check_trung')
                return {trung: {Q1: {score: 0.97, khop: [{khoi: 'K9', score: 0.97}]}}};
            return {};
        });
        renderScreen();
        await loadFile();

        fireEvent.click(screen.getByText(/Kiểm tra trùng lặp/));
        await screen.findByText('1 câu trùng');
    });
});

describe('ImportExam: blocking saves in the wrong place', () => {
    it('without ?bank= the save-to-bank button is locked', async () => {
        vi.spyOn(Api, 'post').mockResolvedValue({});
        renderScreen('/import-exam');
        await loadFile();

        const button = screen.getByText(/Lưu 1 đề vào ngân hàng/).closest('button')!;
        // Blocks without a bank fall into a shared nameless, subject-less basket
        // that no screen can draw from.
        expect(button.disabled).toBe(true);
        expect(screen.getByText(/Muốn lưu vào ngân hàng thì vào/)).toBeTruthy();
    });
});

// ──────────────────────────────────────────────────────────────────────
// The seam: on-screen actions → payload sent to question_bank/save
// ──────────────────────────────────────────────────────────────────────
//
// `convertData` is tested separately, `split_blocks` has a self-check on the BE.
// Nobody guards the middle: what decides which slot a question goes into in the
// bank is the `type` and `max_words` of THIS payload itself. Send them wrong and
// the BE classifies correctly from wrong data — blocks land in the wrong slot,
// stock reports enough yet drawn exams have the wrong structure, and the teacher
// sees nothing unusual until students are mid-exam.

/** An exam with one multiple-choice and one free-answer question, to switch type and enter a word limit. */
const MIXED_EXAM = {
    ...EXAM,
    sections: [{
        id: 'S1',
        name: 'Phần I',
        question_type: 'MultipleChoice',
        questions: [
            EXAM.sections[0].questions[0],
            {
                id: 'Q2',
                type: 'FreeAnswer',
                data: {question: '<p>Viết đoạn văn về quê hương.</p>'},
            },
        ],
    }],
};

/** Load the mixed exam, return helpers to read the payload sent to question_bank/save. */
async function loadMixedExam() {
    const sent: any[] = [];
    vi.spyOn(Api, 'post').mockImplementation(async (url: string, body?: any) => {
        if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
        if (url === 'question_bank/save') { sent.push(body); return {saved: 2}; }
        return {};
    });
    vi.spyOn(Api, 'upload').mockResolvedValue({exams: [MIXED_EXAM], warnings: []});

    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, {target: {files: [new File(['x'], 'de.docx')]}});
    await screen.findByText(/Đọc được 1 đề/);

    return {
        sent,
        save: () => fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/)),
        question: (qid: string) => sent[0].sections[0].questions.find((q: any) => q.id === qid),
    };
}

/**
 * Change the type of the FIRST question. Each question has its own Dropdown and
 * both list the same 5 types, so `getByText('Đúng / Sai')` matches several
 * elements — it must be looked up inside question 1's dropdown.
 */
function changeQuestion1Type(label: string) {
    const dd = document.querySelectorAll('.import-type')[0] as HTMLElement;
    fireEvent.click(dd);
    fireEvent.click(within(dd).getByText(label));
}

describe('ImportExam: payload decides which slot a question goes into', () => {
    it('the word limit typed on screen must reach the BE as a NUMBER', async () => {
        renderScreen();
        const t = await loadMixedExam();

        // The "word limit" box only shows on non-multiple-choice questions.
        const box = document.querySelector('.import-wordlimit input') as HTMLInputElement;
        fireEvent.change(box, {target: {value: '200'}});

        t.save();
        await screen.findByText(/Đã thêm 2 khối/);

        // The BE compares max_words against thresholds 50/400 to split TraLoiNgan/VietDoan/VietBai.
        // Sending the string '200' makes the comparison raise TypeError in Python 3, and in
        // Python 2 string-vs-number gives arbitrary results — both yield the wrong slot.
        expect(t.question('Q2').data.max_words).toBe(200);
    });

    it('changing a question type makes the payload carry the NEW type, not the parser guess', async () => {
        renderScreen();
        const t = await loadMixedExam();

        // The parser can only guess multiple choice / free answer. The teacher picks the
        // other three — and that very choice decides the slot in the bank.
        changeQuestion1Type('Đúng / Sai');

        t.save();
        await screen.findByText(/Đã thêm 2 khối/);

        expect(t.question('Q1').type).toBe('TrueFalse');
        // And the old type's own data must be cleaned: leftover multiple-choice answers
        // get stored whole into Question.data, and TrueFalse.jsx reads an array of
        // options where it expects a boolean.
        expect(t.question('Q1').data.answers).toBeUndefined();
    });

    it('changing one question type must NOT change another question in the same section', async () => {
        renderScreen();
        const t = await loadMixedExam();

        changeQuestion1Type('Đúng / Sai');

        t.save();
        await screen.findByText(/Đã thêm 2 khối/);

        // Question 2 is untouched. The BE takes each question's `type`, so one question
        // changing and dragging the whole section along would send the whole section to the wrong slot.
        expect(t.question('Q2').type).toBe('FreeAnswer');
    });

    it('a passage edited on screen goes up for the WHOLE group, not just the first question', async () => {
        const sent: any[] = [];
        vi.spyOn(Api, 'post').mockImplementation(async (url: string, body?: any) => {
            if (url === 'question_bank/capacity') return {slots: {}, capacity: 0, per_type: {}};
            if (url === 'question_bank/save') { sent.push(body); return {saved: 1}; }
            return {};
        });
        // Two questions share one passageId — the BE groups them into ONE DocHieu block
        // by exactly this field. Losing passageId detaches a question from its reading.
        vi.spyOn(Api, 'upload').mockResolvedValue({
            exams: [{
                ...EXAM,
                sections: [{
                    id: 'S1', name: 'Phần I', question_type: 'MultipleChoice',
                    questions: [1, 2].map(i => ({
                        id: 'Q' + i,
                        type: 'MultipleChoice',
                        data: {
                            question: '<p>Câu ' + i + '</p>',
                            passage: '<p>Quê hương là chùm khế ngọt</p>',
                            passageId: 'P1',
                            answers: [{id: 'A1', value: '2'}],
                            correctAnswerId: 'A1',
                        },
                    })),
                }],
            }],
            warnings: [],
        });
        renderScreen();
        const input = document.querySelector('input[type=file]') as HTMLInputElement;
        fireEvent.change(input, {target: {files: [new File(['x'], 'de.docx')]}});
        await screen.findByText(/Đọc được 1 đề/);

        fireEvent.click(screen.getByText(/Lưu 1 đề vào ngân hàng/));
        await screen.findByText(/Đã thêm 1 khối/);

        const qs = sent[0].sections[0].questions;
        expect(qs.map((q: any) => q.data.passageId)).toEqual(['P1', 'P1']);
    });
});
