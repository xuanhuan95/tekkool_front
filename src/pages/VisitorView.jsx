import React, {Component} from 'react';
import { Routes, Route } from 'react-router-dom'
import TopToolbar from './TopToolbar'

import DoExam from './exam-creation/DoExam';
import Payment from './payment/Payment';
import PaymentResult from './payment/PaymentResult';
import Dashboard from './dashboard/Dashboard';

class VisitorView extends Component {
    render() {
        return (
            <div id="VisitorView">
                <TopToolbar />
                <Routes>
                  <Route path='/' element={<Dashboard/>}/>
                  <Route path='/do-exam/:examId' element={<DoExam/>}/>
                  <Route path='/payment/result' element={<PaymentResult/>}/>
                  <Route path='/payment/:examId' element={<Payment/>}/>
                </Routes>
            </div>
        )
    }
}

export default VisitorView;
