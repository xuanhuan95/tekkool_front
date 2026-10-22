// Count and cut text by the exam's word/character limit.
// Split out of Editor.tsx so tests can call the REAL function — Editor drags in
// all of tiptap, so this logic previously had no way to be tested on its own.

export type Unit = 'word' | 'char';

export const WORD: Unit = 'word';

/**
 * Count in the unit the teacher chose.
 *
 * 'word': split on spaces — correct for BOTH English ("I am a student" = 4 words)
 *   and Literature ("Trường Trung học phổ thông" = 5 words), because Vietnamese
 *   is written with each syllable separate, so "counting words/syllables" is
 *   exactly splitting on spaces.
 * 'char': ponytail: RAW count (no trim, no space collapsing) — with trim a
 *   trailing space counts 0, so you could type spaces forever at the 20/20 mark,
 *   which looks broken.
 */
export function measure(text: string, unit: Unit): number {
    if (unit !== WORD) return text.length;
    const t = text.trim();
    return t === '' ? 0 : t.split(/\s+/).length;
}
