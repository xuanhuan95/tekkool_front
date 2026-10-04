import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';

import MultipleChoice from './MultipleChoice';
import ErrorIdentify from './ErrorIdentify';
import Default from '../Default';

// Hai loại câu này gần như một: cùng "chọn 1 trong N phương án", cùng UI đáp
// án, cùng parse "A. ... B. ..." khi dán từ Word. Chúng khác đúng BA điều, và
// cả ba đều là thứ giáo viên nhìn thấy ngay:
//   - ErrorIdentify có nút "chuyển vùng chọn thành đáp án" (MC không có)
//   - ErrorIdentify chèn ô tích, MC chèn gạch chân "______"
//   - class CSS khác nhau -> ErrorIdentify mới có số A/B/C do CSS counter sinh
// Test này chốt cả ba, để gộp hai file lại mà không lặng lẽ mất cái nào.

const de = Default.exam();
const phan = Default.section(de.id);

function veCau(Comp: any, data: Record<string, unknown> = {}) {
    const q = Default.question('MultipleChoice', de.id, phan.id);
    Object.assign(q.data, data);
    phan.questions = [q];
    const touch = vi.fn();
    render(<Comp question={q} section={phan} setSectionState={touch}/>);
    return {q, touch};
}

beforeEach(() => vi.restoreAllMocks());

describe('MultipleChoice vs ErrorIdentify: ba điểm khác nhau phải giữ', () => {
    it('chỉ ErrorIdentify có nút chuyển vùng chọn thành đáp án', () => {
        veCau(MultipleChoice);
        expect(screen.queryByTitle('Chuyển vùng chọn thành đáp án')).toBeNull();
    });

    it('ErrorIdentify PHẢI có nút đó — mất nút là giáo viên hết đường tạo ô tích', () => {
        veCau(ErrorIdentify);
        expect(screen.getByTitle('Chuyển vùng chọn thành đáp án')).toBeTruthy();
    });

    it('class CSS khác nhau: .ErrorIdentify mới chạy CSS counter đánh số ô tích', () => {
        const {container: a} = render(
            <MultipleChoice question={Default.question('MultipleChoice', de.id, phan.id)}
                            section={phan} setSectionState={vi.fn()}/>);
        expect(a.querySelector('form.multiple-choice')).toBeTruthy();
        expect(a.querySelector('form.ErrorIdentify')).toBeNull();

        const {container: b} = render(
            <ErrorIdentify question={Default.question('ErrorIdentify', de.id, phan.id)}
                           section={phan} setSectionState={vi.fn()}/>);
        expect(b.querySelector('form.ErrorIdentify')).toBeTruthy();
        expect(b.querySelector('form.multiple-choice')).toBeNull();
    });
});

describe('Phần dùng chung: phương án hiện ra giống hệt nhau', () => {
    it.each([['MultipleChoice', MultipleChoice], ['ErrorIdentify', ErrorIdentify]])(
        '%s hiện đủ phương án đã có và đánh dấu đúng đáp án',
        (_ten, Comp: any) => {
            const {container} = render(
                <Comp question={(() => {
                    const q = Default.question('MultipleChoice', de.id, phan.id);
                    q.data.answers = [{id: 'A1', value: 'Hà Nội'}, {id: 'A2', value: 'Huế'}];
                    q.data.correctAnswerId = 'A2';
                    phan.questions = [q];
                    return q;
                })()} section={phan} setSectionState={vi.fn()}/>);

            const radio = container.querySelectorAll('input[type=radio]');
            expect(radio.length).toBe(2);
            // Đáp án đúng là cái THỨ HAI. Không khẳng định cái thứ nhất KHÔNG
            // sáng thì test vẫn xanh kể cả khi mọi radio đều checked.
            expect((radio[0] as HTMLInputElement).checked).toBe(false);
            expect((radio[1] as HTMLInputElement).checked).toBe(true);
        });

    it.each([['MultipleChoice', MultipleChoice], ['ErrorIdentify', ErrorIdentify]])(
        '%s xoá phương án thì báo cho store vẽ lại',
        (_ten, Comp: any) => {
            const q = Default.question('MultipleChoice', de.id, phan.id);
            q.data.answers = [{id: 'A1', value: 'Hà Nội'}, {id: 'A2', value: 'Huế'}];
            phan.questions = [q];
            const touch = vi.fn();
            const {container} = render(
                <Comp question={q} section={phan} setSectionState={touch}/>);

            fireEvent.click(container.querySelector('i.remove.icon')!);

            expect(q.data.answers.map((a: any) => a.id)).toEqual(['A2']);
            // Sửa dữ liệu mà không gọi setSectionState là màn hình đứng im:
            // giáo viên bấm xoá, thấy phương án còn nguyên, bấm tiếp.
            expect(touch).toHaveBeenCalled();
        });
});

describe('Lệch 7px của icon xoá — khác biệt thứ tư, dễ mất khi gộp', () => {
    const veVoiPhuongAn = (Comp: any) => {
        const q = Default.question('MultipleChoice', de.id, phan.id);
        q.data.answers = [{id: 'A1', value: 'x'}];
        phan.questions = [q];
        return render(<Comp question={q} section={phan} setSectionState={vi.fn()}/>).container;
    };

    it('MultipleChoice đẩy icon xuống 7px cho thẳng hàng với ô đáp án', () => {
        const i = veVoiPhuongAn(MultipleChoice).querySelector('i.remove.icon') as HTMLElement;
        expect(i.style.marginTop).toBe('7px');
    });

    it('ErrorIdentify KHÔNG đẩy — dòng của nó cao hơn, đẩy thêm là lệch', () => {
        const i = veVoiPhuongAn(ErrorIdentify).querySelector('i.remove.icon') as HTMLElement;
        expect(i.style.marginTop).toBe('');
    });
});

describe('editorType: chèn ô tích hay gạch chân (khác biệt dễ mất nhất)', () => {
    // Ba test trên bắt được class, nút và lệch 7px — nhưng bỏ `editorType` đi
    // thì cả lưới vẫn xanh, trong khi đây mới là thứ quyết định ErrorIdentify
    // chèn Ô TÍCH hay chèn "______" như trắc nghiệm. Giáo viên soạn đề tìm lỗi
    // sai mà ra gạch chân là sai hẳn loại câu.
    //
    // Bôi đen phải đi qua Tiptap: hàm toAnswer đọc `editor.state.selection`,
    // không đọc window.getSelection. Ctrl+A trong vùng soạn thảo là đường
    // người dùng thật đi, và ProseMirror tự xử lý phím đó.
    const soanRoiChuyenThanhDapAn = (container: HTMLElement) => {
        const vung = container.querySelector('.ProseMirror') as HTMLElement;
        fireEvent.focus(vung);
        fireEvent.keyDown(vung, {key: 'a', code: 'KeyA', ctrlKey: true});
        fireEvent.click(screen.getByTitle('Chuyển vùng chọn thành đáp án'));
        return vung;
    };

    it('ErrorIdentify chèn <span class=check-item>, không phải gạch chân', () => {
        const q = Default.question('ErrorIdentify', de.id, phan.id);
        q.data.question = '<p>Câu có lỗi sai ở đây</p>';
        phan.questions = [q];
        const {container} = render(
            <ErrorIdentify question={q} section={phan} setSectionState={vi.fn()}/>);

        const vung = soanRoiChuyenThanhDapAn(container);

        expect(vung.querySelector('span.check-item')).toBeTruthy();
        expect(vung.textContent).not.toMatch(/_____/);
    });
});
