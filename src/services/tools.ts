/** Đọc value của input theo id, '' nếu không có — gọi từ code cũ thao tác DOM thẳng. */
export function getValueById(id: string): string {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return el && el.value ? el.value : '';
}

/** 0 -> 'A', 1 -> 'B'... đánh nhãn phương án trắc nghiệm. */
export function numToChar(n: number): string {
    return String.fromCharCode(65 + n);
}
