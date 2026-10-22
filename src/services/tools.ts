/** Read an input's value by id, '' if absent — called from old code that manipulates the DOM directly. */
export function getValueById(id: string): string {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return el && el.value ? el.value : '';
}

/** 0 -> 'A', 1 -> 'B'... labels multiple-choice options. */
export function numToChar(n: number): string {
    return String.fromCharCode(65 + n);
}
