import { Routes, Route } from 'react-router-dom'

import Register from './auth/Register';
import Login from './auth/Login';

export default function AnonymousView() {
    return (
        <div id="AnonymousView">
            {/*<TopMenu />*/}
            <Routes>
              <Route path='/' element={<Login/>}/>
              <Route path='/register' element={<Register/>}/>
              <Route path='*' element={<Login/>}/>
            </Routes>
        </div>
    );
}
