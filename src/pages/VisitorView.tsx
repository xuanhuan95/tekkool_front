import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import TopToolbar from './TopToolbar'

import TakeExam from './exam/TakeExam';
import ResultPage from './exam/ResultPage';
import ReviewPage from './exam/ReviewPage';
import Payment from './payment/Payment';
import PaymentResult from './payment/PaymentResult';
import Dashboard from './dashboard/Dashboard';
import Profile from './my/Profile';
import HistoryPage from './exam/HistoryPage';
import PurchaseHistory from './pay/PurchaseHistory';

export default function VisitorView() {
    // Exam room / payment bring their own header (QC B2).
    const fullScreen = /^\/(do-exam|payment)\//.test(useLocation().pathname);
    return (
        <div id="VisitorView">
            {!fullScreen && <TopToolbar />}
            <Routes>
              <Route path='/' element={<Dashboard/>}/>
              <Route path='/do-exam/:examId' element={<TakeExam/>}/>
              <Route path='/result/:id' element={<ResultPage/>}/>
              <Route path='/review/:id' element={<ReviewPage/>}/>
              <Route path='/payment/result' element={<PaymentResult/>}/>
              <Route path='/payment/:packageId' element={<Payment/>}/>
              <Route path='/profile' element={<Profile/>}/>
              <Route path='/my-exams' element={<Navigate to='/history' replace/>}/>
              <Route path='/history' element={<HistoryPage/>}/>
              <Route path='/billing' element={<PurchaseHistory/>}/>
              <Route path='/subject/:subjectId' element={<Dashboard/>}/>
            </Routes>
        </div>
    );
}
