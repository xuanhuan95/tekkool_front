import renderHTML from '../../components/SafeHtml';
import {Avatar} from '../../components/ui';

/**
 * Teacher remark card (DS HS-Editor-NhanXet): purple, avatar + title + rich body.
 * ponytail: BE does not return the grader's name yet, so the title and avatar stay generic ("GV").
 */
export default function TeacherNote({html}: {html: string}) {
    return <div className='vt-tnote'>
        <div className='vt-tnote-head'><Avatar initials='GV'/><b>Nhận xét của giáo viên</b></div>
        <div className='vt-tnote-body'>{renderHTML(html)}</div>
    </div>;
}
