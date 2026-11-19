import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {Layout} from '../pages/exam-creation/layoutRules';
import type {BankBlocksPage, BankCapacity, BankKind, BankPaper, BankPapersPage, BankStats, BankSummary, StructureSlot} from '../types/exam';

export const bankKeys = {
    all: ['question_bank'] as const,
    list: () => [...bankKeys.all, 'list'] as const,
    subjects: () => [...bankKeys.all, 'subjects'] as const,
};

export function useBanks() {
    return useQuery({queryKey: bankKeys.list(), queryFn: () => Api.get<BankSummary[]>('question_bank/list')});
}

export function useBankSubjects() {
    return useQuery({queryKey: bankKeys.subjects(), queryFn: () => Api.get<string[]>('question_bank/subjects'), staleTime: 5 * 60_000});
}

/** BE answers `{error}` (200) on a refused create, e.g. unknown subject. */
export function useCreateBank() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (v: {name: string; subject: string; kind?: BankKind}) => {
            const r = await Api.post<{error?: string}>('question_bank/create', v);
            if (r && r.error) throw new Error(r.error);
            return r;
        },
        onSuccess: () => qc.invalidateQueries({queryKey: bankKeys.list()}),
    });
}

export function useRemoveBank() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Api.post('question_bank/remove', {id}),
        onSuccess: () => qc.invalidateQueries({queryKey: bankKeys.all}),
    });
}

export type CreateFromBankInput = {
    banks: string[]; name: string; duration: number; folder?: string;
    /** Required for kind block; ignored for a paper bank (exactly one bank). */
    structure?: StructureSlot[];
    /** Exam frame Nhóm → Phần → Tiểu mục (C1). Wins over `structure` when both are sent. */
    layout?: Layout;
};

/** Sample exams of a bank: frames the teacher can copy (`question_bank/templates`). */
export type BankTemplate = {id: string; name: string; layout: Layout; block_count: number; created_at?: string | null};
export function useBankTemplates(bankId: string) {
    return useQuery({
        queryKey: [...bankKeys.all, 'templates', bankId],
        queryFn: () => Api.get<BankTemplate[]>('question_bank/templates?bank=' + bankId),
        enabled: !!bankId,
    });
}

export function useCreateFromBank() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: CreateFromBankInput) => Api.post('exam/create_from_bank', v),
        onSuccess: () => qc.invalidateQueries({queryKey: ['exam']}),
    });
}

/** Draw-exam screen: stock per type + capacity. Bank is the main path; subject is the legacy route (blocks imported before banks). */
export function useDrawInfo(bankId: string, subject: string) {
    const body = bankId ? {bank: bankId} : {subject};
    return useQuery({
        queryKey: [...bankKeys.all, 'draw-info', bankId, subject],
        queryFn: async () => {
            const q = bankId ? 'bank=' + bankId : 'subject=' + encodeURIComponent(subject);
            const [stats, capacity] = await Promise.all([
                Api.get<BankStats>('question_bank/stats?' + q),
                Api.post<BankCapacity>('question_bank/capacity', body),
            ]);
            return {stats, capacity};
        },
    });
}

/** Stock of ONE bank (ImportExam's capacity card). A failure only hides the card, it never blocks importing. */
export function useBankStock(bankId: string | null) {
    return useQuery({
        queryKey: [...bankKeys.all, 'stock', bankId],
        queryFn: () => Api.post<BankCapacity>('question_bank/capacity', {bank: bankId}),
        enabled: !!bankId,
        retry: false,
    });
}

/** Blocks per type of ONE bank (A1: the "Dạng khối" filter only lists the types the bank really has). */
export function useBankStats(bankId: string) {
    return useQuery({
        queryKey: [...bankKeys.all, 'stats', bankId],
        queryFn: () => Api.get<BankStats>('question_bank/stats?bank=' + bankId),
        enabled: !!bankId,
    });
}

export const BLOCKS_PER_PAGE = 20;

/** SPT-73: one page of a bank's blocks. The previous page stays on screen while the next loads (no flicker on filter/page). */
export function useBankBlocks(bank: string, page: number, blockType: string, q: string, since = '') {
    const qs = new URLSearchParams({bank, page: String(page), per_page: String(BLOCKS_PER_PAGE)});
    if (blockType) qs.set('block_type', blockType);
    if (q) qs.set('q', q);
    if (since) qs.set('since', since);   // "Chỉ khối vừa nhập": ISO time the save started
    return useQuery({
        queryKey: [...bankKeys.all, 'blocks', bank, page, blockType, q, since],
        queryFn: () => Api.get<BankBlocksPage>('question_bank/blocks?' + qs.toString()),
        placeholderData: keepPreviousData,
    });
}

export function useDeleteBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Api.post('question_bank/delete_block', {id}),
        // 404 = already gone (other tab / second click) → same end state, so refresh either way.
        onSettled: () => qc.invalidateQueries({queryKey: bankKeys.all}),
    });
}

export const PAPERS_PER_PAGE = 20;

/** Whole-exam bank (kind paper): one page of its papers. */
export function useBankPapers(bank: string, page: number) {
    return useQuery({
        queryKey: [...bankKeys.all, 'papers', bank, page],
        queryFn: () => Api.get<BankPapersPage>(`question_bank/papers?bank=${bank}&page=${page}&per_page=${PAPERS_PER_PAGE}`),
        enabled: !!bank,
        placeholderData: keepPreviousData,
    });
}

/** One whole exam with keys. */
export function useBankPaper(id: string | null) {
    return useQuery({queryKey: [...bankKeys.all, 'paper', id], queryFn: () => Api.get<BankPaper>('question_bank/paper?id=' + id), enabled: !!id});
}

/** 409 when it would leave a published exam with nothing to draw (message names the exam). */
export function useDeletePaper() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Api.post<{id: string; kept_for_exams: unknown}>('question_bank/delete_paper', {id}),
        onSettled: () => qc.invalidateQueries({queryKey: bankKeys.all}),
    });
}
