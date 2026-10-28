import {Suspense, lazy, useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Toaster} from 'react-hot-toast';

import Loading from '../components/Loading';
import {useAuthStore, watchSessionExpiry} from '../stores/authStore';

import AuthenticateView from './AuthenticateView';
import AnonymousView from './AnonymousView';
import VisitorView from './VisitorView';

import 'semantic-ui-css/semantic.min.css';
import '../styles/tokens.css';
import './fonts.css';
import './App.css';
import './questions.css';
import './student.css';

// Design-D component catalogue for review (SPT-54). DEV ONLY: in `vite build` import.meta.env.DEV is
// the literal `false`, so this branch and the lazy chunk are dropped from the production bundle.
const DevUi = import.meta.env.DEV ? lazy(() => import('./dev/DevUi')) : null;
// Old Semantic catalogue: dev only too (it was reachable on production).
const DesignSystem = import.meta.env.DEV ? lazy(() => import('./DesignSystem')) : null;

/**
 * Create ONCE outside the component. Inside the function body every App re-render
 * would create a new client — the whole cache would be lost.
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Exams and attempts change by the minute, not by the second; react-query's
            // default (staleTime 0) refires the request on every screen change.
            staleTime: 30_000,
            // With a dead token, retrying 3 times still gives 400 — only slower.
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

export default function App() {
    const ready = useAuthStore(s => s.ready);
    const user = useAuthStore(s => s.user);
    const init = useAuthStore(s => s.init);
    const {pathname} = useLocation();

    useEffect(() => { watchSessionExpiry(); init(); }, [init]);

    // Component catalogue: no data, so no login needed (designers, probe).
    if (DesignSystem && pathname === '/design-system') return <Suspense fallback={null}><DesignSystem/></Suspense>;
    if (DevUi && pathname.startsWith('/dev/ui')) return <Suspense fallback={<Loading/>}><DevUi/></Suspense>;
    if (!ready) return <Loading/>;

    return <QueryClientProvider client={queryClient}>
        <div id='App'>
            <Toaster position='bottom-right'/>
            {!user
                ? <AnonymousView/>
                : user.group === 'visitor'
                    ? <VisitorView/>
                    : <AuthenticateView/>}
        </div>
    </QueryClientProvider>;
}
