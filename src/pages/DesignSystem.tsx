import {useEffect, useState, type CSSProperties, type ReactNode} from 'react';
import {Button, Icon, Label} from 'semantic-ui-react';

import Loading from '../components/Loading';
import {blockLabel, BLOCK_STYLES} from './exam-creation/blockTypes';
import './design-system.css';

/**
 * /design-system: every token and shared component of the app on one page,
 * each state as a static example side by side.
 *
 * ponytail: renders the REAL classes and components (tk-*, semantic-ui), not
 * copies — change a token in src/styles/tokens.css or a rule in App.css and
 * this page shows it. Forced hover/focus live in design-system.css.
 */

type Swatch = {token: string; pair: string; note: string};

// pair = the color this one is actually used with; contrast is measured on it.
const SWATCHES: Swatch[] = [
    {token: '--tk-primary', pair: '#ffffff', note: 'nút chính, chữ trắng'},
    {token: '--tk-primary-dark', pair: '--tk-primary-soft', note: 'rê nút, chữ trên nền nhạt'},
    {token: '--tk-primary-soft', pair: '--tk-primary-dark', note: 'nền nhấn nhạt'},
    {token: '--tk-ink', pair: '--tk-card', note: 'chữ thân'},
    {token: '--tk-muted', pair: '--tk-card', note: 'chữ phụ'},
    {token: '--tk-muted', pair: '--tk-bg', note: 'chữ phụ trên nền trang'},
    {token: '--tk-faint', pair: '--tk-card', note: 'placeholder, tay kéo — không dùng cho chữ'},
    {token: '--tk-line', pair: '', note: 'viền'},
    {token: '--tk-bg', pair: '--tk-ink', note: 'nền trang'},
    {token: '--tk-card', pair: '--tk-ink', note: 'nền thẻ'},
    {token: '--tk-green', pair: '--tk-green-soft', note: 'thành công'},
    {token: '--tk-warn', pair: '--tk-warn-soft', note: 'cảnh báo'},
    {token: '--tk-danger', pair: '--tk-danger-soft', note: 'lỗi'},
];

const BLOCK_TOKENS = Object.entries(BLOCK_STYLES).map(([type, s]) => ({
    type, token: s.color.slice(4, -1),   // 'var(--x)' -> '--x'
}));

function readToken(name: string): string {
    if (!name.startsWith('--')) return name;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// WCAG 2.x relative luminance; tokens are 6-digit hex.
function luminance(hex: string): number {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function State({label, demo, children}: {label: string; demo?: string; children: ReactNode}) {
    return <div className='ds-state'>
        <small>{label}</small>
        {/* inert: forced-state demos look interactive but must not take focus or clicks.
            React 18 has no `inert` prop type; '' renders the bare attribute. */}
        {demo ? <div {...({inert: ''} as object)} data-demo-state={demo}>{children}</div> : children}
    </div>;
}

function Section({title, hint, children}: {title: string; hint?: string; children: ReactNode}) {
    return <section className='ds-section'>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
        {children}
    </section>;
}

function ColorCard({token, pair, note}: Swatch) {
    const [values, setValues] = useState<{c: string; p: string} | null>(null);
    useEffect(() => setValues({c: readToken(token), p: pair ? readToken(pair) : ''}), [token, pair]);
    const ratio = values && values.p ? contrast(values.c, values.p) : null;

    return <div className='ds-swatch'>
        <div className='ds-swatch-color' style={{background: `var(${token})`,
            color: pair ? (pair.startsWith('--') ? `var(${pair})` : pair) : undefined}}>
            {pair && 'Aa'}
        </div>
        <div className='ds-swatch-meta'>
            <code>{token}</code>
            <span>{values?.c} · {note}</span>
            {ratio !== null && <span className={ratio < 4.5 ? 'ds-low' : ''}>
                {ratio.toFixed(2)}:1 với {pair}{ratio < 4.5 && ' — Dưới 4.5:1'}
            </span>}
        </div>
    </div>;
}

const TYPE_SCALE: {label: string; style: CSSProperties; text: string}[] = [
    {label: 'Tiêu đề trang · 28 / 700', style: {fontFamily: 'var(--tk-font-title)', fontSize: 28, fontWeight: 700},
        text: 'Đề thi thử Ngữ văn lớp 12'},
    {label: 'Tiêu đề khối · 19 / 600', style: {fontSize: 19, fontWeight: 600}, text: 'Phần I. Đọc hiểu văn bản'},
    {label: 'Tiêu đề thẻ · 17 / 600', style: {fontSize: 17, fontWeight: 600}, text: 'Thông tin tài khoản'},
    {label: 'Tên dòng · 16 / 600', style: {fontSize: 16, fontWeight: 600}, text: 'Kiểm tra giữa kỳ — Toán'},
    {label: 'Thân · 15 / 400', style: {fontSize: 15}, text: 'Học sinh đọc kỹ đề trước khi trả lời từng câu hỏi.'},
    {label: 'Phụ · 14 / 400', style: {fontSize: 14, color: 'var(--tk-muted)'}, text: 'Mỗi học sinh làm được ba lần không lặp.'},
    {label: 'Meta · 13 / 400', style: {fontSize: 13, color: 'var(--tk-muted)'}, text: '45 phút · 40 câu · đã nộp hôm qua'},
];

export default function DesignSystem() {
    const reading = BLOCK_STYLES.DocHieu;

    return <div className='tk tk-wrap'>
        <h1 className='tk-title'>Design system</h1>
        <p className='tk-sub'>Đổi màu, font, bo góc ở <code>src/styles/tokens.css</code> — mọi component đổi theo.</p>

        <Section title='Màu' hint='Tỉ lệ tương phản đo với màu đi kèm thật. Chữ thân cần từ 4.5:1.'>
            <div className='ds-swatches'>
                {SWATCHES.map(s => <ColorCard key={s.token + s.pair} {...s}/>)}
            </div>
            <h3 className='ds-h3'>Màu loại khối (chữ trắng trên nền)</h3>
            <div className='ds-swatches'>
                {BLOCK_TOKENS.map(b => <ColorCard key={b.type} token={b.token} pair='#ffffff' note={blockLabel(b.type)}/>)}
            </div>
        </Section>

        <Section title='Chữ' hint='Inter cho chữ thân, Newsreader cho tiêu đề trang.'>
            {TYPE_SCALE.map(t => <div key={t.label} className='ds-type-row'>
                <small>{t.label}</small><span style={t.style}>{t.text}</span>
            </div>)}
        </Section>

        <Section title='Bo góc, viền, bóng'>
            <div className='ds-row'>
                <State label='--tk-r · 14px (thẻ)'><div className='ds-shape' style={{borderRadius: 'var(--tk-r)'}}>thẻ</div></State>
                <State label='--tk-r-sm · 8px (nút, ô nhập)'><div className='ds-shape' style={{borderRadius: 'var(--tk-r-sm)'}}>ô nhỏ</div></State>
                <State label='--tk-shadow (thẻ)'><div className='ds-shape' style={{borderRadius: 'var(--tk-r)', boxShadow: 'var(--tk-shadow)'}}>nổi nhẹ</div></State>
                <State label='--tk-shadow-lift (đang kéo, rê)'><div className='ds-shape' style={{borderRadius: 'var(--tk-r)', boxShadow: 'var(--tk-shadow-lift)'}}>nhấc lên</div></State>
            </div>
        </Section>

        <Section title='Nút' hint='Nút chính là semantic Button primary; .tk-btn cho màn học sinh; .tk-icon-btn cho nút chỉ có icon.'>
            <div className='ds-row'>
                <State label='Thường'><Button primary>Lưu đề</Button></State>
                <State label='Rê chuột' demo='hover'><Button primary>Lưu đề</Button></State>
                <State label='Focus bàn phím' demo='focus'><Button primary>Lưu đề</Button></State>
                <State label='Khoá'><Button primary disabled>Lưu đề</Button></State>
                <State label='Đang tải'><Button primary loading>Lưu đề</Button></State>
                <State label='Phụ'><Button basic>Huỷ</Button></State>
            </div>
            <div className='ds-row' style={{marginTop: 16}}>
                <State label='.tk-btn thường'><button type='button' className='tk-btn'>Cập nhật</button></State>
                <State label='Rê chuột' demo='hover'><button type='button' className='tk-btn'>Cập nhật</button></State>
                <State label='Focus' demo='focus'><button type='button' className='tk-btn'>Cập nhật</button></State>
                <State label='Khoá'><button type='button' className='tk-btn' disabled>Cập nhật</button></State>
                <State label='.tk-icon-btn'><button type='button' className='tk-icon-btn' aria-label='Thông báo'><Icon name='bell outline'/></button></State>
                <State label='Rê chuột' demo='hover'><button type='button' className='tk-icon-btn' aria-label='Thông báo'><Icon name='bell outline'/></button></State>
            </div>
        </Section>

        <Section title='Nhãn và chip'>
            <div className='ds-row'>
                <State label='Chip thường'><button type='button' className='tk-chip'><Icon name='book'/>Ngữ văn</button></State>
                <State label='Rê chuột' demo='hover'><button type='button' className='tk-chip'><Icon name='book'/>Ngữ văn</button></State>
                <State label='Đang chọn'><button type='button' className='tk-chip active'><Icon name='book'/>Ngữ văn</button></State>
                <State label='Focus' demo='focus'><button type='button' className='tk-chip'><Icon name='book'/>Ngữ văn</button></State>
            </div>
            <div className='ds-row' style={{marginTop: 16}}>
                <State label='Điểm cao'><Label size='small' color='green'>9 / 10</Label></State>
                <State label='Điểm thấp'><Label size='small' color='red'>3 / 10</Label></State>
                <State label='Chờ chấm'><Label size='small' color='yellow'>chờ chấm (2 câu)</Label></State>
                <State label='Giá có phí'><span className='tk-price paid'>49.000 đ</span></State>
                <State label='Miễn phí'><span className='tk-price free'>Miễn phí</span></State>
            </div>
            <div className='ds-row' style={{marginTop: 16}}>
                <State label='Thông báo thành công'><div className='tk-note ok'>Đã lưu thay đổi.</div></State>
                <State label='Thông báo lỗi'><div className='tk-note err'>Không lưu được, thử lại sau.</div></State>
            </div>
        </Section>

        <Section title='Ô nhập' hint='Lỗi nằm ngay dưới ô sai.'>
            <div className='ds-row'>
                <State label='Thường'><div className='tk-field'><label>Họ tên</label><input defaultValue='Nguyễn Văn An'/></div></State>
                <State label='Focus' demo='focus'><div className='tk-field'><label>Họ tên</label><input defaultValue='Nguyễn Văn An'/></div></State>
                <State label='Khoá'><div className='tk-field'><label>Email</label><input defaultValue='an@truong.edu.vn' disabled/>
                    <div className='tk-field-hint'>Email không đổi được.</div></div></State>
                <State label='Lỗi'><div className='tk-field'><label>Mật khẩu mới</label><input type='password' defaultValue='123'/>
                    <div className='tk-field-error'>Mật khẩu cần ít nhất 8 ký tự.</div></div></State>
            </div>
        </Section>

        <Section title='Thẻ'>
            <div className='ds-row'>
                <div className='ds-grow'>
                    <State label='.tk-card'>
                        <div className='tk-card' style={{marginBottom: 0}}>
                            <h3>Thông tin tài khoản</h3>
                            <div className='tk-card-hint'>Tên này hiện trên bài nộp của bạn.</div>
                            <div className='tk-field' style={{marginBottom: 0}}><label>Họ tên</label><input defaultValue='Nguyễn Văn An'/></div>
                        </div>
                    </State>
                </div>
                <div className='ds-grow'>
                    <State label='Đang tải'>
                        <div className='tk-card' style={{marginBottom: 0}}><Loading/></div>
                    </State>
                </div>
            </div>
        </Section>

        <Section title='Dòng danh sách'>
            <div className='ds-row'>
                {(['', 'hover', 'focus'] as const).map(st =>
                    <div key={st} className='ds-grow'>
                        <State label={st === 'hover' ? 'Rê chuột' : st === 'focus' ? 'Focus' : 'Thường'} demo={st || undefined}>
                            <button type='button' className='tk-exam'>
                                <span className='tk-exam-icon'><Icon name='file alternate outline'/></span>
                                <span className='tk-exam-main'>
                                    <span className='tk-exam-name' style={{display: 'block'}}>Kiểm tra giữa kỳ — Ngữ văn</span>
                                    <span className='tk-exam-meta'><span><Icon name='clock outline'/>90 phút</span><span>4 phần</span></span>
                                </span>
                                <span className='tk-price free'>Miễn phí</span>
                            </button>
                        </State>
                    </div>)}
            </div>
        </Section>

        <Section title='Modal' hint='semantic Modal; đây là bản tĩnh của popup hết lượt.'>
            <State label='Thường'>
                <div className='ui tiny modal ds-modal'>
                    <div className='content'>
                        <div className='text-center'>
                            <div className='tk-out-icon'><Icon name='ticket' size='big'/></div>
                            <h2 className='tk-out-title'>Bạn đã hết lượt thi</h2>
                            <p className='text-muted'>Mua thêm gói để làm tiếp đề này.</p>
                        </div>
                    </div>
                    <div className='actions'>
                        <Button basic><Icon name='arrow left'/> Về trang đề</Button>
                        <Button primary>Xem gói</Button>
                    </div>
                </div>
            </State>
        </Section>

        <Section title='Trạng thái rỗng'>
            <div className='tk-empty'>
                <Icon name='inbox'/>
                <div className='tk-empty-title'>Chưa có bài nộp nào</div>
                <div>Làm xong đề đầu tiên, bài sẽ hiện ở đây.</div>
            </div>
        </Section>

        <Section title='Riêng của app' hint='Thẻ loại khối khi tạo đề; đồng hồ, tiến độ, bảng câu khi làm bài.'>
            <h3 className='ds-h3'>Thẻ loại khối</h3>
            <div className='ds-row'>
                {([['Thường', ''], ['Rê chuột', 'hover'], ['Hết khối', 'off']] as const).map(([label, st]) =>
                    <div key={label} className='ds-grow'>
                        <State label={label} demo={st === 'hover' ? 'hover' : undefined}>
                            <div className={'tk-cfb-type' + (st === 'off' ? ' off' : '')}
                                 style={{'--block-color': reading.color} as CSSProperties}>
                                <span className='tk-cfb-type-icon'><Icon name={reading.icon}/></span>
                                <div className='tk-cfb-type-text'>
                                    <b>{blockLabel('DocHieu')}</b>
                                    <small>{st === 'off' ? 'có 0 khối' : 'dùng 2 / có 6 khối'}</small>
                                </div>
                                <button type='button' aria-label='Thêm' disabled={st === 'off'}><Icon name='plus'/></button>
                            </div>
                        </State>
                    </div>)}
            </div>

            <h3 className='ds-h3'>Đồng hồ</h3>
            <div className='ds-row'>
                {([['Còn nhiều', '', '42:10', 70], ['Sắp hết (≤ 5 phút)', ' time-low', '4:32', 10], ['Hết giờ (≤ 1 phút)', ' time-up', '0:41', 2]] as const)
                    .map(([label, cls, time, pct]) =>
                        <div key={label} style={{width: 200}}>
                            <State label={label}>
                                <div className={'tk-timer text-center' + cls}>
                                    <Icon name='clock outline'/>
                                    <h1>{time}</h1>
                                    <div className='tk-timer-bar'><span style={{width: pct + '%'}}/></div>
                                </div>
                            </State>
                        </div>)}
            </div>

            <h3 className='ds-h3'>Tiến độ và bảng câu</h3>
            <div className='ds-row'>
                <div style={{width: 260}}>
                    <State label='Đã làm 3/8'>
                        <div className='tk-progress'>
                            <div className='tk-progress-text'><span>Đã làm</span><b>3/8 câu</b></div>
                            <div className='tk-progress-bar'><span style={{width: '37.5%'}}/></div>
                        </div>
                    </State>
                </div>
                <State label='Chưa làm'><button type='button' className='tk-qnav-cell'>4</button></State>
                <State label='Rê chuột' demo='hover'><button type='button' className='tk-qnav-cell'>4</button></State>
                <State label='Focus' demo='focus'><button type='button' className='tk-qnav-cell'>4</button></State>
                <State label='Đã làm'><button type='button' className='tk-qnav-cell done'>1</button></State>
            </div>
        </Section>
    </div>;
}
