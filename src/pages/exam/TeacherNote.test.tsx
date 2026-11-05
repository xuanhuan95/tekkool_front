import {it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import TeacherNote from './TeacherNote';

it('shows the teacher comment in the note card', () => {
    render(<TeacherNote html='<p>Làm tốt</p>'/>);
    expect(screen.getByText('Nhận xét của giáo viên')).toBeTruthy();
    expect(screen.getByText('Làm tốt')).toBeTruthy();
});
