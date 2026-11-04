import {describe, expect, it, vi} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

import {CreateMenu} from './Dashboard';
import {renderAt} from '../manage/testutil';

const subject = {id: 's1', name: 'Toán'} as any;

/** jsdom has no matchMedia -> phone layout (bottom sheet); stub it for the desktop popover. */
function desktop(on: boolean) {
    window.matchMedia = ((q: string) => ({matches: on, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn()})) as any;
}

describe('CreateMenu (+ Tạo đề)', () => {
    it('phone: bottom sheet with 3 ways; Esc and Huỷ close it', () => {
        desktop(false);
        renderAt(<CreateMenu subject={subject}/>);
        fireEvent.click(screen.getByRole('button', {name: '+ Tạo đề'}));
        const dlg = screen.getByRole('dialog', {name: 'Tạo đề cho môn Toán'});
        expect(dlg.textContent).toMatch(/Tự soạn.*Nhập Word.*Từ ngân hàng đề/);
        fireEvent.keyDown(document, {key: 'Escape'});
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: '+ Tạo đề'}));
        fireEvent.click(screen.getByRole('button', {name: 'Huỷ'}));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('desktop: popover anchored to the button; outside click and choosing an item close it', () => {
        desktop(true);
        renderAt(<div><CreateMenu subject={subject}/><p>ngoài</p></div>);
        fireEvent.click(screen.getByRole('button', {name: '+ Tạo đề'}));
        expect(screen.getAllByRole('menuitem').length).toBe(3);
        fireEvent.mouseDown(screen.getByText('ngoài'));
        expect(screen.queryByRole('menu')).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: '+ Tạo đề'}));
        fireEvent.click(screen.getAllByRole('menuitem')[1]);
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
