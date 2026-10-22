import type {ReactNode} from 'react';

import Card from '../../components/ui/Card';
import './auth.css';

/** Shared frame of HS-DangNhap / HS-DangKy: big hand-drawn logo + wave, white card, footer link row. */
export default function AuthFrame({tagline, title, subtitle, footer, children}: {
    tagline?: string; title: string; subtitle: string; footer: ReactNode; children: ReactNode;
}) {
    return <div className='vt-paper vt-auth'>
        <div className='vt-auth-col'>
            <div className='vt-auth-brand'>
                <span className='vt-auth-logo'>viettestpro</span>
                <svg width='220' height='8' viewBox='0 0 220 8' aria-hidden='true' focusable='false'>
                    <path d='M1 4 C 22 2, 44 6, 70 4 S 112 2, 140 5 S 182 6, 204 3 S 214 4, 219 4' fill='none'
                          stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
                </svg>
                {tagline && <span className='vt-auth-tagline'>{tagline}</span>}
            </div>
            <Card as='section' className='vt-auth-card' aria-labelledby='vt-auth-title'>
                <div className='vt-auth-head'>
                    <h1 id='vt-auth-title' className='vt-auth-title'>{title}</h1>
                    <p className='vt-muted'>{subtitle}</p>
                </div>
                {children}
            </Card>
            <div className='vt-auth-footer'>{footer}</div>
        </div>
    </div>;
}
