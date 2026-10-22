import { Routes, Route } from 'react-router-dom'
import TopToolbar from './TopToolbar'

import TakeExam from './exam/TakeExam';
import ResultPage from './exam/ResultPage';
import ReviewPage from './exam/ReviewPage';
import Payment from './payment/Payment';
import PaymentResult from './payment/PaymentResult';
import Dashboard from './dashboard/Dashboard';
import Profile from './my/Profile';
import MySubmissions from './my/MySubmissions';
import PurchaseHistory from './pay/PurchaseHistory';

export default function VisitorView() {
    return (
        <div id="VisitorView">
            <TopToolbar />
            <Routes>
              <Route path='/' element={<Dashboard/>}/>
              <Route path='/do-exam/:examId' element={<TakeExam/>}/>
              <Route path='/result/:id' element={<ResultPage/>}/>
              <Route path='/review/:id' element={<ReviewPage/>}/>
              <Route path='/payment/result' element={<PaymentResult/>}/>
              <Route path='/payment/:packageId' element={<Payment/>}/>
              <Route path='/profile' element={<Profile/>}/>
              <Route path='/my-exams' element={<MySubmissions/>}/>
              <Route path='/billing' element={<PurchaseHistory/>}/>
              <Route path='/subject/:subjectId' element={<Dashboard/>}/>
            </Routes>
        </div>
    );
}
