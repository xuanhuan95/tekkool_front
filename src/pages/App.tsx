import {useEffect} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Toaster} from 'react-hot-toast';

import Loading from '../components/Loading';
import {useAuthStore} from '../stores/authStore';

import AuthenticateView from './AuthenticateView';
import AnonymousView from './AnonymousView';
import VisitorView from './VisitorView';

import 'semantic-ui-css/semantic.min.css';
import './fonts.css';
import './App.css';
import './questions.css';
import './student.css';

/**
 * Tạo MỘT lần ở ngoài component. Đặt trong thân hàm thì mỗi lần App vẽ lại
 * là một client mới — toàn bộ cache mất sạch.
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Đề và bài nộp đổi theo phút chứ không theo giây; mặc định của
            // react-query (staleTime 0) bắn lại request mỗi lần đổi màn.
            staleTime: 30_000,
            // Token chết thì retry 3 lần cũng vẫn 400 — chỉ tổ chậm.
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

export default function App() {
    const ready = useAuthStore(s => s.ready);
    const user = useAuthStore(s => s.user);
    const init = useAuthStore(s => s.init);

    useEffect(() => { init(); }, [init]);

    if (!ready) return <Loading/>;

    return <QueryClientProvider client={queryClient}>
        <div id='App'>
            <Toaster position='top-right'/>
            {!user
                ? <AnonymousView/>
                : user.group === 'visitor'
                    ? <VisitorView/>
                    : <AuthenticateView/>}
        </div>
    </QueryClientProvider>;
}
