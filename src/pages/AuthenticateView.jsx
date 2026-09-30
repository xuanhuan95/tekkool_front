import React, {Component} from 'react';
import { Routes, Route } from 'react-router-dom'

import Dashboard from './dashboard/Dashboard';
import CreateExam from './exam-creation/CreateExam';
import DoExam from './exam-creation/DoExam';
import ImportExam from './exam-creation/ImportExam';
import MySubmissions from './my/MySubmissions';
import SubmissionDetail from './my/SubmissionDetail';
import ToGrade from './my/ToGrade';
import Billing from './my/Billing';
import Profile from './my/Profile';
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
                  <Route path='/import-exam' element={<ImportExam/>}/>
                  <Route path='/my-exams' element={<MySubmissions/>}/>
                  <Route path='/my-exams/:id' element={<SubmissionDetail/>}/>
                  <Route path='/to-grade' element={<ToGrade/>}/>
                  <Route path='/to-grade/:examId' element={<ToGrade/>}/>
                  <Route path='/billing' element={<Billing/>}/>
                  <Route path='/profile' element={<Profile/>}/>
                  <Route path='/payment/result' element={<PaymentResult/>}/>
                  <Route path='/payment/:examId' element={<Payment/>}/>
                  <Route path='/subject/:subjectId' element={<Dashboard/>}/>
                  <Route path='*' element={<Dashboard/>}/>

                    {/*<Route path='/schedule' element={<Schedule/>}/>*/}
                </Routes>
            </div>
        )
    }
}

export default AuthenticateView;
