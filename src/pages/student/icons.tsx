import type {ReactNode} from 'react';

// Line icons: Lucide paths (ISC licence), 24px grid, round caps/joins — the same rounded
// outline look as the reference app. Copied in rather than adding lucide-react for ~10 icons.
type P = {size?: number; w?: number};

const Line = ({size = 20, w = 2, children}: P & {children: ReactNode}) =>
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={w}
         strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>{children}</svg>;

export const IconHome = (p: P) => <Line {...p}><path d='M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8'/><path d='M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/></Line>;
export const IconClock = (p: P) => <Line {...p}><circle cx='12' cy='12' r='10'/><path d='M12 6v6l4 2'/></Line>;
export const IconTrophy = (p: P) => <Line {...p}><path d='M6 9H4.5a2.5 2.5 0 0 1 0-5H6'/><path d='M18 9h1.5a2.5 2.5 0 0 0 0-5H18'/><path d='M4 22h16'/><path d='M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'/><path d='M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'/><path d='M18 2H6v7a6 6 0 0 0 12 0V2Z'/></Line>;
export const IconTicketLine = (p: P) => <Line {...p}><path d='M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z'/><path d='M13 5v2M13 17v2M13 11v2'/></Line>;
export const IconSearch = ({size = 18}: P) => <Line size={size}><circle cx='11' cy='11' r='8'/><path d='m21 21-4.3-4.3'/></Line>;
export const IconArrow = ({size = 18}: P) => <Line size={size} w={2.4}><path d='M5 12h14'/><path d='m12 5 7 7-7 7'/></Line>;
export const IconBack = () => <Line size={24} w={2.2}><path d='m15 18-6-6 6-6'/></Line>;
export const IconCheck = ({size = 12}: P) => <Line size={size} w={3}><path d='M20 6 9 17l-5-5'/></Line>;
export const IconPlay = ({size = 14}: P) =>
    <svg width={size} height={size} viewBox='0 0 24 24' aria-hidden='true'><path d='M7 4.5v15l12-7.5z' fill='currentColor'/></svg>;

// Colour illustrations: Microsoft Fluent Emoji 3D (MIT), 96px PNGs in public/icons3d.
export type Art = 'ticket' | 'crown' | 'trophy' | 'mountain' | 'bolt' | 'fire' | 'gem' | 'gift';
export const Icon3D = ({name, size = 20}: {name: Art; size?: number}) =>
    <img src={'/icons3d/' + name + '.png'} width={size} height={size} alt='' aria-hidden='true'
         style={{display: 'block', flex: 'none'}}/>;
export const IconTicket = ({size = 18}: P) => <Icon3D name='ticket' size={size}/>;
export const IconCrown = () => <Icon3D name='crown' size={26}/>;
