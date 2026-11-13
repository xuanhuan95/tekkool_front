import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react';

import App from './pages/App';
import {reloadOnceOnPreloadError} from './lib/appStatus';

reloadOnceOnPreloadError();

// SPT-134: report runtime errors. Empty DSN (dev, vitest, e2e) = Sentry stays off.
// No replay, no tracing, no PII. Console breadcrumbs are dropped: they may echo exam content.
if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        beforeBreadcrumb: b => (b.category === 'console' ? null : b),
    });
}

// Without #root the whole app does not mount — a loud error beats a blank page.
const root = document.getElementById('root');
if (!root) throw new Error('Thiếu <div id="root"> trong index.html');

createRoot(root).render(
    // No fallback on purpose: keeps today's behaviour (React unmounts), Sentry only reports.
    <Sentry.ErrorBoundary>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </Sentry.ErrorBoundary>
);
