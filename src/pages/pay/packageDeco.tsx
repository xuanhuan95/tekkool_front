import type {Package} from '../../types/payment';
import {pricePerTurn} from '../../lib/format';

/** Sticker colour by rank (turns ascending): green, white, purple, then repeats. */
const FILLS = ['var(--vt-ok-bg)', '#ffffff', 'var(--vt-title-bg)'];
/** Where each of the 3 stacked tickets sits inside the 64×52 viewBox. */
const TICKETS = ['translate(2 14) rotate(-4 30 18)', 'translate(4 7) rotate(5 30 18)', 'translate(2 0) rotate(-2 30 18)'];

/** Hand-drawn stack of 1–3 tickets (package sticker; 3 yellow ones on the turns card). */
export function TicketSticker({count, fill, width = 64, height = 52, className = 'pk-stk'}: {
    count: number; fill: string; width?: number; height?: number; className?: string;
}) {
    return <svg className={className} width={width} height={height} viewBox='0 0 64 52' aria-hidden='true' focusable='false'>
        {TICKETS.slice(0, count).map(t => <g key={t} transform={t}>
            <path d='M3 4 Q3 2 5 2 H55 Q57 2 57 4 V13 Q52 14 52 18 Q52 22 57 23 V32 Q57 34 55 34 H5 Q3 34 3 32 V23 Q8 22 8 18 Q8 14 3 13 Z'
                  fill={fill} stroke='var(--vt-ink)' strokeWidth='2.4' strokeLinejoin='round'/>
            <path d='M17 6 V30' stroke='var(--vt-ink)' strokeWidth='1.6' strokeDasharray='3 3'/>
            <path d='M24 14 H46 M24 22 H40' stroke='var(--vt-ink)' strokeWidth='2' strokeLinecap='round'/>
        </g>)}
    </svg>;
}

export const Tick = () => <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6'
                               strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'><path d='M5 12.5l4.5 4.5L19 7.5'/></svg>;

/** What a package card needs to know about the others. Computed on the client from price/turns. */
export interface PackageDeco {
    rank: number;
    /** Highest price per turn among the packages (the "giá gốc"); null with fewer than 2 packages. */
    maxPer: number | null;
    baseName: string;
    /** Lowest price per turn, and not the featured one: gets the "Tiết kiệm nhất" tape. */
    cheapest: boolean;
}

/** "Gói Cơ bản"; a name that already starts with "Gói" is not prefixed again. */
export const packageLabel = (name: string) => /^gói(\s|$)/i.test(name) ? name : 'Gói ' + name;

export const stickerOf = (rank: number) => ({count: (rank % 3) + 1, fill: FILLS[rank % 3]});

/** Each package's deco (keyed by id). The list keeps the Admin order; only the sticker rank follows turns ascending. */
export function packageDecos(packages: Package[]): Record<string, PackageDeco> {
    const sorted = [...packages].sort((a, b) => a.turns - b.turns);
    const per = (p: Package) => pricePerTurn(p.price, p.turns);
    const priced = sorted.filter(p => per(p) !== null);
    const base = priced.reduce<Package | null>((m, p) => !m || per(p)! > per(m)! ? p : m, null);
    const low = priced.reduce<Package | null>((m, p) => !m || per(p)! < per(m)! ? p : m, null);
    const compare = packages.length >= 2 && base !== null;
    const decos: Record<string, PackageDeco> = {};
    sorted.forEach((p, rank) => {
        decos[p.id] = {rank, maxPer: compare ? per(base!) : null, baseName: base?.name || '',
                       cheapest: compare && low === p && !p.featured};
    });
    return decos;
}
