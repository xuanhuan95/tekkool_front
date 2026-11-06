/** Visible text length of editor HTML (formulas and images count 0). Own file so tests that mock Editor keep it. */
export const textLength = (html: string) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent?.length ?? 0;
