import React from 'react';
import {Link} from 'react-router-dom';
import {Menu, Icon, Button, Label} from 'semantic-ui-react';
import {connectGlobalState} from "../stateUtils";
import Api, {setToken} from '../services/api';
import StudentNav from './StudentNav';

class TopToolbar extends React.Component {

    state = {pending: 0};

    // Dem bai cho cham cho cai chuong. Dung lai GET exam/pending co san (man
    // /to-grade van dung chinh no) thay vi them endpoint chi de tra mot so —
    // danh sach cua mot giao vien khong du lon de dang mot API rieng.
    componentDidMount() {
        this.loadPending();
        // 60s/lan: hoc sinh nop bai luc nao cung duoc, khong refresh thi giao
        // vien phai F5 moi thay. Nhanh hon nua la goi phi, cham hon thi chuong
        // vo nghia.
        this.timer = setInterval(this.loadPending, 60000);
    }

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    loadPending = async () => {
        let {user} = this.globalState.auth;
        if (!user || user.group !== 'teacher') return;
        try {
            let subs = await Api.get('exam/pending');
            this.setState({pending: Array.isArray(subs) ? subs.length : 0});
        } catch (e) {
            // Mat mang / het phien: giu so cu, khong lam vo thanh dieu huong.
        }
    };

    doLogout = async () => {
        try { await Api.get('session/logout'); } catch (e) { /* phien co the da het han */ }
        setToken(null);
        window.location.href = '/';
    };

    render() {
        let {auth} = this.globalState;
        let {user} = auth;
        let {pending} = this.state;

        // Hoc sinh / khach dung thanh dieu huong rieng. Man giao vien giu
        // nguyen menu cu — doi ca hai mot luc la hai thu phai kiem tra.
        if (!user || user.group !== 'teacher') return <StudentNav user={user}/>;

        return <Menu id='topMenu' color='blue' inverted>
            <Menu.Item>
                <Link to='/'>
                    <Icon name='home'/> Thi thử SPT
                </Link>
            </Menu.Item>

            <Menu color='blue' inverted floated='right'>
                {/* Chuong = loi vao man cham bai, kiem bao "co bai moi". Truoc
                    day la muc chu "Can cham" — chu thi khong noi duoc CO MAY
                    BAI, giao vien van phai bam vao moi biet co viec hay khong. */}
                <Menu.Item as={Link} to='/to-grade' className='tk-bell'
                           title={pending ? pending + ' bài chờ chấm' : 'Không có bài chờ chấm'}>
                    <Icon name='bell outline' size='large' style={{margin: 0}}/>
                    {/* KHONG dung `floating` cua semantic: no day label len tren
                        mep muc, ma muc nay sat dinh thanh -> so bi cat mat nua
                        tren. Dinh vi tay trong .tk-bell. */}
                    {pending > 0 &&
                    <Label color='red' circular size='mini'>{pending}</Label>}
                </Menu.Item>

                <Menu.Item>
                    <Icon name='user'/>Chào bạn {user.name}
                </Menu.Item>

                <Menu.Item>
                    <Button onClick={this.doLogout}>Logout</Button>
                </Menu.Item>
            </Menu>
         </Menu>
    }
}

export default connectGlobalState(TopToolbar);
