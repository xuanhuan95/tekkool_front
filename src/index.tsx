import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'

import App from './pages/App';

// Không có #root thì cả app không mount — lỗi to tiếng còn hơn trang trắng.
const root = document.getElementById('root');
if (!root) throw new Error('Thiếu <div id="root"> trong index.html');

createRoot(root).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
);
