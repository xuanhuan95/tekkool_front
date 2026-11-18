import {plain, toUnits, type DuplicateInfo, type ImportQuestion, type MatchSource, type ImportedExam, type ImportSection} from './importRules';

/**
 * Bank-import duplicate rules (B7, BF-02). Pure, so the screen only renders.
 * A "block" is what the bank stores: a passage with its questions, a Đúng/Sai group, or one question on its own.
 */

/** From this score a block counts as "the same" (below it the chip on the question is a warning only). */
export const SAME_BLOCK = 0.95;

export type Block = {id: string; questions: ImportQuestion[]; section: number};

/** The blocks of one exam in paper order: units that share a passage are ONE block (reading = passage + its questions). */
export function blocksOf(exam: ImportedExam): Block[] {
    const out: Block[] = [];
    exam.sections.forEach((s, section) => {
        for (const u of toUnits(s.questions)) {
            const pid = u.questions[0].data.passageId;
            const last = out[out.length - 1];
            if (pid && last && last.section === section && last.questions[0].data.passageId === pid) last.questions.push(...u.questions);
            else out.push({id: u.id, questions: [...u.questions], section});
        }
    });
    return out;
}

/** Normalised text of a block, used to see the same passage/question in two exams that were just read. */
export const blockKey = (b: Block) => b.questions.map(q => plain(q.data.passage) + '|' + plain(q.data.question)).join('||').toLowerCase().replace(/\s+/g, ' ');

export type BlockDup = {exam: string; block: string; score: number; with?: string; inImport?: string; source?: MatchSource};

/** Blocks of `exam` that equal a block already in the bank (BE score ≥ SAME_BLOCK against something that is not this very file). */
export function bankDuplicates(exam: ImportedExam, duplicates: Record<string, DuplicateInfo>): BlockDup[] {
    const out: BlockDup[] = [];
    for (const b of blocksOf(exam)) {
        const hits = b.questions.map(q => duplicates[q.id]).filter(Boolean);
        const best = hits.sort((a, c) => c.score - a.score)[0];
        const match = best?.matches.find(m => !m.in_file && m.score >= SAME_BLOCK);
        if (best && best.score >= SAME_BLOCK && match) out.push({exam: exam.id, block: b.id, score: best.score, with: match.block || match.id, source: match});
    }
    return out;
}

/** Blocks that appear in two of the exams just read: the later one is the duplicate, `inImport` names the first exam. */
export function importDuplicates(exams: ImportedExam[]): BlockDup[] {
    const seen = new Map<string, ImportedExam>();
    const out: BlockDup[] = [];
    for (const e of exams) for (const b of blocksOf(e)) {
        const k = blockKey(b);
        if (!k.replace(/\|/g, '').trim()) continue;
        const first = seen.get(k);
        if (!first) seen.set(k, e);
        else if (first.id !== e.id) out.push({exam: e.id, block: b.id, score: 1, inImport: first.id});
    }
    return out;
}

/** The exam without the blocks in `drop` (empty sections go too). null = nothing left to save. */
export function withoutBlocks(exam: ImportedExam, drop: Set<string>): ImportedExam | null {
    if (!drop.size) return exam;
    const gone = new Set<string>();
    blocksOf(exam).filter(b => drop.has(b.id)).forEach(b => b.questions.forEach(q => gone.add(q.id)));
    const sections: ImportSection[] = exam.sections
        .map(s => ({...s, questions: s.questions.filter(q => !gone.has(q.id))}))
        .filter(s => s.questions.length);
    return sections.length ? {...exam, sections} : null;
}
