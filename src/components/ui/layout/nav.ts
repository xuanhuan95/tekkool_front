export interface NavItem {
    to: string;
    label: string;
    /** Match the path exactly (for "/"). */
    end?: boolean;
}

/*
 * Menus from design-system.md §6. Paths: existing routes where they exist ('/', '/packages',
 * '/profile'); '/exams' and '/ranking' are placeholders until the student screens (Sprint 1, item 3)
 * add those routes — the layouts take `nav` as a prop, so screens can override.
 */
export const STUDENT_NAV_MOBILE: NavItem[] = [
    {to: '/', label: 'Trang chủ', end: true},
    {to: '/exams', label: 'Đề thi'},
    {to: '/ranking', label: 'Xếp hạng'},
    {to: '/profile', label: 'Tôi'},
];

export const STUDENT_NAV_WEB: NavItem[] = [
    {to: '/', label: 'Trang chủ', end: true},
    {to: '/exams', label: 'Đề thi'},
    {to: '/ranking', label: 'Xếp hạng'},
    {to: '/packages', label: 'Gói thi'},
];

/** Admin manages teachers, users, packages + prices, revenue, transactions (CLAUDE.md, chốt 21/10). */
export const ADMIN_NAV: NavItem[] = [
    {to: '/admin/teachers', label: 'Giáo viên'},
    {to: '/admin/users', label: 'Người dùng'},
    {to: '/admin/packages', label: 'Gói thi'},
    {to: '/admin/revenue', label: 'Doanh thu'},
    {to: '/admin/transactions', label: 'Giao dịch'},
];
