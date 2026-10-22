import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'

import App from './pages/App';

// Without #root the whole app does not mount — a loud error beats a blank page.
const root = document.getElementById('root');
if (!root) throw new Error('Thiếu <div id="root"> trong index.html');

createRoot(root).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
);
