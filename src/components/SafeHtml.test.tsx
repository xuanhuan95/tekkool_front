import {describe, it, expect} from 'vitest';
import {render, fireEvent} from '@testing-library/react';
import renderHTML from './SafeHtml';

// Students, preview and the submission review all show question HTML through here.
// Import stores formulas as <span data-latex>; if this stops drawing them the
// student sees a blank where the formula belongs.
const show = (html: string) => render(<div>{renderHTML(html)}</div>).container;

describe('SafeHtml', () => {
    it('draws span[data-latex] with KaTeX', () => {
        const c = show('<p>V = <span data-latex="\\frac{a^3}{6}"></span></p>');
        expect(c.querySelector('.katex')).not.toBeNull();
        expect(c.textContent).toContain('V =');
    });

    it('keeps sup, sub and data-URI images', () => {
        const c = show('<p>x<sup>2</sup>H<sub>2</sub>O<img src="data:image/png;base64,UE5H"></p>');
        expect(c.querySelector('sup')?.textContent).toBe('2');
        expect(c.querySelector('sub')?.textContent).toBe('2');
        expect(c.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,UE5H');
    });

    it('still strips scripts and handlers', () => {
        const c = show('<p onclick="x()">a<script>alert(1)</script><img src="x" onerror="y()"></p>');
        expect(c.querySelector('script')).toBeNull();
        expect(c.innerHTML).not.toMatch(/onclick|onerror/);
    });

    it('a broken image becomes the "Không tải được hình" box', () => {
        const c = show('<p><img src="https://x/missing.png"></p>');
        fireEvent.error(c.querySelector('img') as HTMLImageElement);
        expect(c.querySelector('img')).toBeNull();
        expect(c.textContent).toContain('Không tải được hình');
    });

    it('a broken formula does not throw', () => {
        expect(() => show('<span data-latex="\\frac{"></span>')).not.toThrow();
    });

    it('caps every image to its container, even when Word wrote width="1500"', () => {
        const img = show('<p><img src="data:image/png;base64,UE5H" width="1500" height="900" style="color:red"></p>').querySelector('img')!;
        expect(img.style.maxWidth).toBe('100%');
        expect(img.style.height).toBe('auto');
        expect(img.style.color).toBe('red');   // the author's own style survives
    });
});
