import {useEffect} from 'react';
import {Link, useLocation} from 'react-router-dom';

import {Badge, Card, PageTitle, buttonClass, cx} from '../../components/ui';
import {GUIDE} from './guideContent';
import './import-exam.css';

/** "Lỗi thường gặp" (IV2-LoiThuongGap): symptom → cause → how to fix the Word file, one anchor per entry. */
export default function ImportGuide() {
    const {hash} = useLocation();
    // The router does not scroll to #anchor by itself.
    useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({block: 'start'}); }, [hash]);

    return <div className='vt-imp'>
        <div className='vt-imp-head'>
            <div>
                <Link to='/import-exam' className='vt-imp-link'>← Nhập đề từ file Word</Link>
                <PageTitle>Lỗi thường gặp khi nhập đề</PageTitle>
            </div>
        </div>
        <div className='vt-guide'>
            <nav className='vt-guide-nav' aria-label='Các lỗi'>
                <b>Các lỗi</b>
                {GUIDE.map(g => <a key={g.id} href={'#' + g.id} className={cx('vt-imp-link', hash === '#' + g.id && 'on')}>
                    {g.title}{g.soon && <> <Badge tone='draft'>Sắp thêm</Badge></>}
                </a>)}
            </nav>
            <div className='vt-guide-list'>
                {GUIDE.map(g => <Card key={g.id} as='section' id={g.id} className='vt-guide-item' aria-labelledby={g.id + '-h'}>
                    <h2 id={g.id + '-h'}>{g.title}</h2>
                    <dl>
                        <dt>Triệu chứng</dt><dd>{g.symptom}</dd>
                        <dt>Nguyên nhân</dt><dd>{g.cause}</dd>
                        <dt>Cách sửa file Word</dt>
                        <dd><ol>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></dd>
                    </dl>
                    {(g.wrong || g.right) && <div className='vt-guide-eg'>
                        {g.wrong && <div className='bad'><Badge tone='err'>Sai</Badge><code>{g.wrong}</code></div>}
                        {g.right && <div className='good'><Badge tone='ok'>Đúng</Badge><code>{g.right}</code></div>}
                    </div>}
                </Card>)}
                <Card className='vt-guide-end'>
                    <b>Đã sửa file xong?</b>
                    <Link to='/import-exam' className={buttonClass({variant: 'primary'})}>Nhập lại file</Link>
                </Card>
            </div>
        </div>
    </div>;
}
