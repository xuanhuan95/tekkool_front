import {useEffect} from 'react';
import {Link, useLocation, useSearchParams} from 'react-router-dom';

import {Badge, Button, Card, Modal, PageTitle, buttonClass, cx} from '../../components/ui';
import {GUIDE, ctxQuery} from './guideContent';
import './import-exam.css';

/** The entries (symptom → cause → fix), shared by the page and the modal on the upload screen. */
function GuideEntries() {
    return <>
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
    </>;
}

/** "Lỗi thường gặp" as a dialog on the screen that holds the parsed file (leaving it would lose the work). */
export const GuideModal = ({open, onClose}: {open: boolean; onClose: () => void}) =>
    <Modal open={open} onClose={onClose} title='Lỗi thường gặp khi nhập đề' size='md' className='vt-guide-modal' showClose
           footer={<Button variant='secondary' onClick={onClose}>Đóng</Button>}>
        <div className='vt-guide-list'><GuideEntries/></div>
    </Modal>;

/** "Lỗi thường gặp" page (IV2-LoiThuongGap): symptom → cause → how to fix the Word file, one anchor per entry. */
export default function ImportGuide() {
    const {hash} = useLocation();
    const back = '/import-exam' + ctxQuery(useSearchParams()[0]);   // keep ?bank= / ?folder=
    // The router does not scroll to #anchor by itself.
    useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({block: 'start'}); }, [hash]);

    return <div className='vt-imp'>
        <div className='vt-imp-head'>
            <div>
                <Link to={back} className='vt-imp-link'>← Nhập đề từ file Word</Link>
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
                <GuideEntries/>
                <Card className='vt-guide-end'>
                    <b>Đã sửa file xong?</b>
                    <Link to={back} className={buttonClass({variant: 'primary'})}>Nhập lại file</Link>
                </Card>
            </div>
        </div>
    </div>;
}
