/*
 * Admin API (/manage/* screens). Shapes copied from the BE handlers:
 *   apis/admin.py (teachers), apis/admin_users.py, apis/admin_revenue.py, apis/package.py.
 * Every endpoint is admin_required on the BE — hiding the screens on the FE is only UX.
 */
import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {Package, Payment} from '../types/payment';

export type AccountStatus = 'active' | 'locked' | 'never_logged_in';
export type Role = 'student' | 'teacher' | 'admin';

export interface Paged<T> { items: T[]; total: number; page: number; limit: number }

export interface Teacher {
    id: string;
    name: string;
    email: string;
    subjects: string[];
    locked: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string | null;
    status: AccountStatus;
    exam_count: number;
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    group: string | null;
    locked: boolean;
    must_change_password: boolean;
    status: AccountStatus;
    created_at: string | null;
    last_login_at: string | null;
    /** Students only (null for teacher/admin). */
    turns_remaining: number | null;
    /** false = Admin account: view only, no lock / reset. */
    manageable: boolean;
}

export interface AdminUserDetail extends AdminUser {
    turns: {bought: number; used: number; remaining: number};
    orders: Array<Payment & {created_at?: string | null}>;
    order_counts: {paid: number; pending: number; failed: number; cancelled?: number};
    submissions: {count: number; exams: number; last_at: string | null};
    exam_count?: number;
}

/** `cancelled` = student cancelled on SePay (SPT-58). */
export type TxStatus = 'paid' | 'pending' | 'failed' | 'mismatch' | 'cancelled';
export type Period = 'day' | 'week' | 'month' | 'all';

export interface RevenueSummary {
    period: Period;
    date_from: string | null;
    date_to: string | null;
    revenue: number;
    prev_revenue: number | null;
    change_pct: number | null;
    orders: Record<TxStatus, number>;
    turns_sold: number;
    buyers: number;
    /** day: key = hour 0–23; week/month: 'YYYY-MM-DD'; all: 'YYYY-MM'. */
    series: Array<{key: number | string; revenue: number}>;
    by_package: Array<{package_id: string | null; name: string | null; orders: number; quantity: number; revenue: number}>;
}

export interface Transaction {
    invoice_number: string;
    sepay_order_id: string | null;
    sepay_transaction_id: string | null;
    user: {id: string; name: string; email: string} | null;
    packages: string[];
    amount: number;
    /** What SePay says it received; null = no proof of payment yet. */
    received: number | null;
    status: TxStatus;
    db_status: string;
    created_at: string | null;
    updated_at: string | null;
}

export interface TransactionList extends Paged<Transaction> {
    stats: Record<TxStatus, {count: number; amount: number}>;
}

export type TimelineEvent =
    {event: 'created' | 'reconciled'; at: string | null}
    | {event: 'sepay'; at: string | null; received: number | null}
    | {event: 'credited'; at: string | null; turns: number};

export interface TransactionDetail extends Transaction {
    turns: number;
    timeline: TimelineEvent[];
    raw_ipn: Record<string, unknown> | null;
    anomalies: Array<{type: AnomalyType; message: string; related?: string[]}>;
}

export type AnomalyType = 'paid_not_credited' | 'paid_no_turns' | 'amount_mismatch' | 'duplicate_transaction'
    | 'paid_without_ipn' | 'pending_stale';

export interface Anomaly {
    type: AnomalyType;
    invoice_number: string;
    status: TxStatus;
    amount: number;
    received: number | null;
    user: {id: string; name: string; email: string} | null;
    created_at: string | null;
    message: string;
    sepay_transaction_id?: string;
    related?: string[];
}

export interface ReconcileList { items: Anomaly[]; total: number; counts: Partial<Record<AnomalyType, number>> }

/** ?a=1&b=x — drops empty values so the BE sees "no filter", not "filter by ''". */
export function qs(params: Record<string, string | number | null | undefined>): string {
    const parts = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    return parts.length ? '?' + parts.join('&') : '';
}

const id = (s: string) => encodeURIComponent(s);

// ---------- Teachers (SPT-27) ----------
export interface TeacherFilter { q?: string; subject?: string; status?: string; page?: number; limit?: number }

export function useTeachers(f: TeacherFilter) {
    return useQuery({
        queryKey: ['manage', 'teachers', f],
        queryFn: () => Api.get<Paged<Teacher>>('admin/teachers' + qs({...f})),
        placeholderData: keepPreviousData,
    });
}

export function useCreateTeacher() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: {name: string; email: string; password: string; subjects: string[]}) =>
            Api.post<Teacher>('admin/create_teacher', body),
        onSuccess: () => { qc.invalidateQueries({queryKey: ['manage']}); },
    });
}

export function useLockTeacher() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({userId, lock}: {userId: string; lock: boolean}) =>
            Api.post<Teacher>((lock ? 'admin/lock_teacher/' : 'admin/unlock_teacher/') + id(userId)),
        onSuccess: () => { qc.invalidateQueries({queryKey: ['manage']}); },
    });
}

// ---------- Users (SPT-47) ----------
export interface UserFilter { group?: string; status?: string; q?: string; page?: number; limit?: number }

export function useUsers(f: UserFilter) {
    return useQuery({
        queryKey: ['manage', 'users', f],
        queryFn: () => Api.get<Paged<AdminUser> & {counts: Record<Role, number>}>('admin_users/list' + qs({...f})),
        placeholderData: keepPreviousData,
    });
}

export function useUserDetail(userId: string | null) {
    return useQuery({
        queryKey: ['manage', 'user', userId],
        queryFn: () => Api.get<AdminUserDetail>('admin_users/detail/' + id(userId!)),
        enabled: !!userId,
    });
}

export function useLockUser() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({userId, lock}: {userId: string; lock: boolean}) =>
            Api.post<AdminUser>((lock ? 'admin_users/lock/' : 'admin_users/unlock/') + id(userId)),
        onSuccess: () => { qc.invalidateQueries({queryKey: ['manage']}); },
    });
}

/** BE generates the temp password when none is given. It is returned ONCE and never stored in clear. */
export function useResetPassword() {
    return useMutation({
        mutationFn: (userId: string) =>
            Api.post<AdminUser & {temp_password: string; generated: boolean}>('admin_users/reset_password/' + id(userId), {}),
    });
}

// ---------- Packages (SPT-23) ----------
export const ADMIN_PACKAGES_KEY = ['manage', 'packages'] as const;

export function useAdminPackages() {
    return useQuery({queryKey: ADMIN_PACKAGES_KEY, queryFn: () => Api.get<Package[]>('package/list?all=1')});
}

export type PackageInput = {name: string; turns: number; price: number; description: string; order?: number;
    active: boolean; featured: boolean};

export function usePackageMutations() {
    const qc = useQueryClient();
    const done = () => {
        qc.invalidateQueries({queryKey: ADMIN_PACKAGES_KEY});
        qc.invalidateQueries({queryKey: ['package', 'list']});   // the student sales page
    };
    return {
        create: useMutation({mutationFn: (b: PackageInput) => Api.post<Package>('package/create', b), onSuccess: done}),
        update: useMutation({
            mutationFn: ({pkgId, body}: {pkgId: string; body: Partial<PackageInput>}) =>
                Api.post<Package>('package/update/' + id(pkgId), body),
            onSuccess: done,
        }),
        reorder: useMutation({mutationFn: (ids: string[]) => Api.post<Package[]>('package/reorder', {ids}), onSuccess: done}),
        remove: useMutation({
            mutationFn: (pkgId: string) =>
                Api.post<{deleted?: boolean; hidden?: boolean; sold?: number; message?: string}>('package/remove/' + id(pkgId)),
            onSuccess: done,
        }),
    };
}

// ---------- Revenue + transactions (SPT-23, SPT-47) ----------
export function useRevenueSummary(period: Period, date?: string) {
    return useQuery({
        queryKey: ['manage', 'revenue', period, date],
        queryFn: () => Api.get<RevenueSummary>('admin_revenue/summary' + qs({period, date})),
        placeholderData: keepPreviousData,
    });
}

export interface TxFilter { status?: string; from?: string; to?: string; q?: string; page?: number; limit?: number }

export function useTransactions(f: TxFilter, enabled = true) {
    return useQuery({
        queryKey: ['manage', 'transactions', f],
        queryFn: () => Api.get<TransactionList>('admin_revenue/transactions' + qs({...f})),
        placeholderData: keepPreviousData,
        enabled,
    });
}

export function useTransaction(inv: string | null) {
    return useQuery({
        queryKey: ['manage', 'transaction', inv],
        queryFn: () => Api.get<TransactionDetail>('admin_revenue/transaction/' + id(inv!)),
        enabled: !!inv,
    });
}

export function useReconcile(type?: string) {
    return useQuery({
        queryKey: ['manage', 'reconcile', type || ''],
        queryFn: () => Api.get<ReconcileList>('admin_revenue/reconcile' + qs({type})),
        placeholderData: keepPreviousData,
    });
}

// ---------- Subjects (SPT-65) ----------
export function useSubjectMutations() {
    const qc = useQueryClient();
    const done = () => qc.invalidateQueries({queryKey: ['folder']});   // student/teacher subject lists too
    return {
        create: useMutation({mutationFn: (name: string) => Api.post<{id: string; name: string}>('folder/create', {name}), onSuccess: done}),
        update: useMutation({
            mutationFn: (b: {id: string; name?: string; hidden?: boolean}) =>
                Api.post<{id: string; name: string; hidden: boolean}>('folder/update', b),
            onSuccess: done,
        }),
    };
}
