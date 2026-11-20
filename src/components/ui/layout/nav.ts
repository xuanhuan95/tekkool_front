export interface NavItem {
    to: string;
    label: string;
    /** Match the path exactly (for "/"). */
    end?: boolean;
    /** Other path prefixes that belong to this tab (result/review/history → "Đề thi"). */
    also?: string[];
    /** Paths (may carry a `?query`) that do NOT belong to this tab even if the prefix matches. */
    not?: string[];
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base.replace(/\/$/, '') + '/');
/** `base` or `base?query`: the query part must appear in the current search string. */
const at = (pathname: string, search: string, p: string) => { const [base, q] = p.split('?'); return under(pathname, base) && (!q || search.includes(q)); };

/** Is `item` the current tab for `pathname`? Same rule as NavLink, plus `also` prefixes. */
export function isNavActive(item: NavItem, pathname: string, search = ''): boolean {
    if ((item.not || []).some(p => at(pathname, search, p))) return false;
    const own = item.end ? pathname === item.to : under(pathname, item.to);
    return own || (item.also || []).some(p => at(pathname, search, p));
}

/*
 * Menus from design-system.md §6. Paths: existing routes where they exist ('/', '/packages',
 * '/me' (account, PM 22/10); the layouts take `nav` as a prop, so screens can override.
 */
export const STUDENT_NAV_MOBILE: NavItem[] = [
    {to: '/', label: 'Trang chủ', end: true},
    {to: '/exams', label: 'Đề thi', also: ['/result', '/review', '/history']},
    {to: '/ranking', label: 'Xếp hạng'},
    {to: '/me', label: 'Tôi', also: ['/packages', '/billing', '/profile']},
];

export const STUDENT_NAV_WEB: NavItem[] = [
    {to: '/', label: 'Trang chủ', end: true},
    {to: '/exams', label: 'Đề thi', also: ['/result', '/review', '/history']},
    {to: '/ranking', label: 'Xếp hạng'},
    {to: '/packages', label: 'Gói thi', also: ['/billing']},
];

/**
 * Admin manages teachers, users, packages + prices, revenue, transactions (CLAUDE.md, chốt 21/10).
 * NOT under /admin: tekkool-deploy/nginx.conf has `location /admin { return 404; }` (blocks the
 * BE's unauthenticated Flask-Admin), so F5 on an /admin/... SPA route would 404.
 */
export const ADMIN_NAV: NavItem[] = [
    {to: '/manage/teachers', label: 'Giáo viên'},
    {to: '/manage/users', label: 'Học sinh'},
    {to: '/manage/subjects', label: 'Môn học'},
    {to: '/manage/packages', label: 'Gói thi'},
    {to: '/manage/revenue', label: 'Doanh thu'},
    {to: '/manage/transactions', label: 'Giao dịch'},
];

/** Teacher (spec-giao-vien §1, Q11): no Tổng quan screen; '/' is Môn & đề. */
export const TEACHER_NAV: NavItem[] = [
    {to: '/', label: 'Môn & đề', end: true, also: ['/subject', '/exam', '/create-exam', '/edit-exam', '/import-exam', '/create-from-bank'], not: ['/import-exam?bank=']},
    {to: '/question-bank', label: 'Ngân hàng câu hỏi', also: ['/draw-exam', '/import-exam?bank=']},
    {to: '/to-grade', label: 'Chấm bài', also: ['/my-exams']},
];
