import React, {Component} from 'react';
import { Routes, Route } from 'react-router-dom'

import Register from './auth/Register';
import Login from './auth/Login';

class AnonymousView extends Component {
    render() {
        return (
            <div id="AnonymousView">
                {/*<TopMenu />*/}
                <Routes>
                  <Route path='/' element={<Login/>}/>
                  <Route path='/register' element={<Register/>}/>
                  <Route path='*' element={<Login/>}/>
                </Routes>
            </div>
        )
    }
}

export default AnonymousView;
