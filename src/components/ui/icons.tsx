import type {ReactNode} from 'react';

/**
 * Line icons drawn on the design canvas (design/screens/DS-*.dc.html), copied path for path.
 * All decorative: aria-hidden; the control around them carries the label.
 */
type P = {size?: number; color?: string};

const Line = ({size = 20, w = 2, color = 'currentColor', children}: P & {w?: number; children: ReactNode}) =>
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth={w}
         strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>{children}</svg>;

export const IconStar = ({size = 16, color = 'var(--vt-sun)'}: P) =>
    <svg width={size} height={size} viewBox='0 0 24 24' fill={color} aria-hidden='true' focusable='false'>
        <path d='M12 2l3 7 7 .6-5.4 4.7 1.7 7.2L12 17.8 5.7 21.5l1.7-7.2L2 9.6 9 9z'/>
    </svg>;
export const IconTicket = ({size = 16, color = 'var(--vt-turn-icon)'}: P) =>
    <Line size={size} color={color}><path d='M5 7h14v10H5z'/><path d='M9 7V5h6v2'/></Line>;
export const IconCrown = ({size = 18, color = 'var(--vt-title-icon)'}: P) =>
    <Line size={size} color={color}><path d='M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z'/><path d='M5 21h14'/></Line>;
export const IconPencil = ({size = 18, color = 'var(--vt-sun-ink)'}: P) =>
    <Line size={size} color={color}><path d='M4 20l4-1 11-11-3-3L5 16z'/><path d='M14 6l3 3'/></Line>;
export const IconFlag = ({size = 14}: P) =>
    <Line size={size}><path d='M5 21V4h11l-2 4 2 4H5'/></Line>;
export const IconFlagFilled = ({size = 14}: P) =>
    <svg width={size} height={size} viewBox='0 0 24 24' fill='var(--vt-sun)' stroke='var(--vt-ink)' strokeWidth={1.6}
         strokeLinejoin='round' aria-hidden='true' focusable='false'><path d='M5 21V4h11l-2 4 2 4H5'/></svg>;
export const IconGrid = ({size = 14}: P) =>
    <Line size={size} w={2.2}><path d='M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'/></Line>;
export const IconBack = ({size = 20}: P) => <Line size={size} w={2.4}><path d='M15 6l-6 6 6 6'/></Line>;
export const IconClose = ({size = 20}: P) => <Line size={size} w={2.4}><path d='M6 6l12 12M18 6L6 18'/></Line>;
export const IconCheck = ({size = 13, color}: P) => <Line size={size} w={3} color={color}><path d='M5 12l4 4 10-10'/></Line>;
export const IconChevronDown = ({size = 16}: P) => <Line size={size} w={2.4}><path d='M6 9l6 6 6-6'/></Line>;
export const IconArrowDown = ({size = 14}: P) => <Line size={size} w={2.2}><path d='M12 5v14M6 13l6 6 6-6'/></Line>;
export const IconImage = ({size = 20}: P) =>
    <Line size={size}><rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='10' r='1.6'/><path d='M21 16l-5-5-8 8'/></Line>;
export const IconClip = ({size = 18}: P) =>
    <Line size={size}><path d='M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.5 8'/></Line>;
export const IconEdit = ({size = 16}: P) =>
    <Line size={size}><path d='M4 20h4L19 9l-4-4L4 16z'/><path d='M13 7l4 4'/></Line>;
export const IconOk = ({size = 20}: P) =>
    <Line size={size} w={2.6} color='var(--vt-ok-icon)'><circle cx='12' cy='12' r='9'/><path d='M8 12.5l2.8 2.8L16 10'/></Line>;
export const IconAlert = ({size = 20}: P) =>
    <Line size={size} w={2.6} color='var(--vt-err)'><circle cx='12' cy='12' r='9'/><path d='M12 7.5v5.5'/><path d='M12 16.5v.5'/></Line>;
export const IconWarn = ({size = 18}: P) =>
    <Line size={size} w={2.4} color='var(--vt-err)'><path d='M12 3l9.5 17h-19z'/><path d='M12 10v4.5'/><path d='M12 17.5v.5'/></Line>;
export const IconDoc = ({size = 40}: P) =>
    <Line size={size} w={1.6}><path d='M6 3h9l3 3v15H6z'/><path d='M9 10h6'/><path d='M9 14h6'/><path d='M9 18h3'/></Line>;
export const IconSaved = ({size = 14}: P) =>
    <Line size={size} w={2.6} color='var(--vt-ok-icon)'><path d='M5 12l4 4 10-10'/></Line>;

export const IconEye = ({size = 20}: P) =>
    <Line size={size}><path d='M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'/><circle cx='12' cy='12' r='3'/></Line>;
export const IconEyeOff = ({size = 20}: P) =>
    <Line size={size}><path d='M2 12s3.5-7 10-7c2 0 3.8.7 5.2 1.6M22 12s-3.5 7-10 7c-2 0-3.8-.7-5.2-1.6'/><path d='M9.9 9.9a3 3 0 0 0 4.2 4.2'/><path d='M3 3l18 18'/></Line>;

export const Spinner = ({size = 16}: P) =>
    <svg className='vt-spin' width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor'
         strokeWidth={2.6} strokeLinecap='round' aria-hidden='true' focusable='false'>
        <circle cx='12' cy='12' r='9' strokeOpacity='0.25'/><path d='M21 12a9 9 0 0 0-9-9'/>
    </svg>;

/* Admin action icons (SPT-77), paths from design AD-*.dc.html. */
export const IconLogout = ({size = 18}: P) =>
    <Line size={size}><path d='M10 4H5v16h5'/><path d='M15 8l4 4-4 4M19 12H9'/></Line>;
export const IconArrowRight = ({size = 18}: P) => <Line size={size}><path d='M5 12h14M13 6l6 6-6 6'/></Line>;
export const IconLock = ({size = 18, color}: P) =>
    <Line size={size} color={color}><rect x='5' y='11' width='14' height='9' rx='2'/><path d='M8 11V8a4 4 0 018 0v3'/></Line>;
export const IconUnlock = ({size = 18, color}: P) =>
    <Line size={size} color={color}><rect x='5' y='11' width='14' height='9' rx='2'/><path d='M8 11V8a4 4 0 017.5-2'/></Line>;
export const IconKey = ({size = 18}: P) => <Line size={size}><circle cx='8' cy='15' r='4'/><path d='M11 12l8-8M16 7l3 3'/></Line>;

