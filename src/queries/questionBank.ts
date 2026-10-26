import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import Api from '../services/api';
import type {BankBlocksPage, BankCapacity, BankStats, BankSummary, StructureSlot} from '../types/exam';

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
        mutationFn: async (v: {name: string; subject: string}) => {
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

/** Stock per type + how many retakes the structure allows. Refetches only when banks or slot counts change. */
export function useBankCapacity(banks: string[], slots: Record<string, number>) {
    return useQuery({
        queryKey: [...bankKeys.all, 'capacity', banks.join(','), JSON.stringify(slots)],
        queryFn: () => Api.post<BankCapacity>('question_bank/capacity', {banks, slots}),
        enabled: banks.length > 0,
        placeholderData: prev => prev,
    });
}

export type CreateFromBankInput = {
    banks: string[]; name: string; duration: number; folder?: string; cau_truc: StructureSlot[];
};

export function useCreateFromBank() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: CreateFromBankInput) => Api.post('exam/create_from_bank', v),
        onSuccess: () => qc.invalidateQueries({queryKey: ['exam']}),
    });
}

/** Draw-exam screen: stock per type + capacity. Bank is the main path; subject is the legacy route (blocks imported before banks). */
export function useDrawInfo(bankId: string, subject: string) {
    const body = bankId ? {bank: bankId} : {subject, matran: subject || 'Ngữ văn'};
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

/** 409 (not enough blocks) arrives resolved as `{error}`, not thrown. */
export function useDrawExam(bankId: string, subject: string) {
    return useMutation({
        mutationFn: async () => {
            const r = await Api.post<{id?: string; error?: string}>('question_bank/draw',
                bankId ? {bank: bankId} : {subject, matran: subject || 'Ngữ văn'});
            if (r.error) throw new Error(r.error);
            return r as {id: string};
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

export const BLOCKS_PER_PAGE = 20;

/** SPT-73: one page of a bank's blocks. The previous page stays on screen while the next loads (no flicker on filter/page). */
export function useBankBlocks(bank: string, page: number, blockType: string, q: string) {
    const qs = new URLSearchParams({bank, page: String(page), per_page: String(BLOCKS_PER_PAGE)});
    if (blockType) qs.set('block_type', blockType);
    if (q) qs.set('q', q);
    return useQuery({
        queryKey: [...bankKeys.all, 'blocks', bank, page, blockType, q],
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
