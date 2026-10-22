import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';

const {get} = vi.hoisted(() => ({get: vi.fn()}));
vi.mock('../../services/api', () => ({default: {get, post: vi.fn()}, setToken: vi.fn()}));

import RankingPage from './RankingPage';
import {boardIntro, meCard, rowSubline} from './ranking';
import {renderAt, routeApi} from './testUtils';
import {useAuthStore} from '../../stores/authStore';
import type {Board, BoardEntry} from '../../types/student';

const entry = (o: Partial<BoardEntry>): BoardEntry => ({rank: 1, is_me: false, hidden: false, name: 'X', points: 0, ...o});
const week = (o: Partial<Board> = {}): Board => ({board: 'week', total: 0, limit: 20, offset: 0, entries: [], me: null,
    week_start: '2026-10-19', week_end: '2026-10-25', ...o});

describe('ranking logic', () => {
    it('sublines: anonymous, week count, achievements exam', () => {
        expect(rowSubline(entry({hidden: true, name: 'Học sinh ẩn danh'}), 'week')).toBe('Đã ẩn tên');
        expect(rowSubline(entry({hidden: true, is_me: true, exams: 2}), 'week')).toBe('2 đề tuần này');
        expect(rowSubline(entry({exams: 9, provisional: true}), 'week')).toBe('9 đề tuần này · tạm tính');
        expect(rowSubline(entry({exam_name: '<p>Toán — Đề 3</p>'}), 'achievements')).toBe('Toán — Đề 3');
    });
    it('"Bạn" card in and out of the board', () => {
        expect(meCard(week({me: entry({rank: 14, is_me: true, exams: 9, points: 160})}), 'week', 'Minh Anh'))
            .toEqual({title: 'Bạn · hạng 14', sub: 'Minh Anh · 9 đề tuần này'});
        expect(meCard(week({me: entry({rank: null, is_me: true})}), 'week', 'Minh Anh'))
            .toEqual({title: 'Bạn · chưa có hạng', sub: 'Minh Anh · chưa có bài tuần này'});
    });
    it('intro shows the week', () => {
        expect(boardIntro(week(), 'week')).toMatch(/Tuần 19\/10 – 25\/10\./);
    });
});

describe('RankingPage', () => {
    beforeEach(() => {
        get.mockReset();
        useAuthStore.setState({user: {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student'}});
    });

    it('week board: top rows, anonymous row, "Bạn" outside the top; tab + subject filter refetch', async () => {
        get.mockImplementation(routeApi({
            'folder/subjects': [{id: 'toan', name: 'Toán', exams: 1, done: 0, last: null}],
            'me/profile': {id: 'me', name: 'Nguyễn Minh Anh', email: 'a@b.vn', group: 'student', hide_ranking_name: true},
            'ranking/week?folder=toan': week({total: 0, me: entry({rank: null, is_me: true, name: 'Nguyễn Minh Anh'})}),
            'ranking/week': week({total: 15, entries: [
                entry({rank: 1, name: 'Trần Gia Bảo', points: 342.5, exams: 12}),
                entry({rank: 2, name: 'Học sinh ẩn danh', hidden: true, points: 318}),
            ], me: entry({rank: 14, is_me: true, name: 'Nguyễn Minh Anh', points: 160, exams: 9})}),
            'ranking/achievements': {...week(), board: 'achievements', total: 1,
                entries: [entry({rank: 1, name: 'Lê Quốc Huy', points: 9.5, exam_name: 'Toán — Đề 2'})], me: null},
        }));
        renderAt('/ranking', [['/ranking', <RankingPage/>]]);
        expect(await screen.findByText('Trần Gia Bảo')).toBeInTheDocument();
        expect(screen.getByText('342,5')).toBeInTheDocument();
        expect(screen.getByText('Đã ẩn tên')).toBeInTheDocument();
        expect(screen.getByText('Bạn · hạng 14')).toBeInTheDocument();
        expect(screen.getByText('Nguyễn Minh Anh · 9 đề tuần này')).toBeInTheDocument();
        expect(await screen.findByText(/Bạn đang ẩn tên/)).toBeInTheDocument();
        expect(get).toHaveBeenCalledWith('ranking/week?limit=20');

        fireEvent.click(screen.getByRole('button', {name: 'Toán'}));
        expect(await screen.findByText('Tuần này chưa có ai trên bảng')).toBeInTheDocument();
        expect(screen.getByText('Bạn · chưa có hạng')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: 'Tất cả môn'}));
        fireEvent.click(screen.getByRole('tab', {name: 'Thành tích'}));
        expect(await screen.findByText('Lê Quốc Huy')).toBeInTheDocument();
        expect(screen.getByText('9,5')).toBeInTheDocument();
    });
});
