import React, {Component} from 'react';
import { Routes, Route } from 'react-router-dom'

import Dashboard from './dashboard/Dashboard';
import CreateExam from './exam-creation/CreateExam';
import DoExam from './exam-creation/DoExam';
import Payment from './payment/Payment';
import PaymentResult from './payment/PaymentResult';
import TopToolbar from './TopToolbar'


class AuthenticateView extends Component {
    render() {
        return (
            <div id="AuthenticateView">
                <TopToolbar />

                {/*<TopMenu />*/}
                <Routes>
                  <Route path='/' element={<Dashboard/>}/>
                  <Route path='/do-exam/:examId' element={<DoExam/>}/>
                  <Route path='/edit-exam/:examId' element={<CreateExam/>}/>
                  <Route path='/create-exam' element={<CreateExam/>}/>
                  <Route path='/payment/result' element={<PaymentResult/>}/>
                  <Route path='/payment/:examId' element={<Payment/>}/>
                  <Route path='*' element={<Dashboard/>}/>

                    {/*<Route path='/schedule' element={<Schedule/>}/>*/}
                </Routes>
            </div>
        )
    }
}

export default AuthenticateView;
