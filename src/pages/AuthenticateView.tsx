import { Routes, Route, useLocation } from 'react-router-dom'

import Dashboard from './dashboard/Dashboard';
import CreateExam from './exam-creation/CreateExam';
import DoExam from './exam-creation/DoExam';
import ImportExam from './exam-creation/ImportExam';
import DrawExam from './exam-creation/DrawExam';
import CreateFromBank from './exam-creation/CreateFromBank';
import BankList from './question-bank/BankList';
import MySubmissions from './my/MySubmissions';
import SubmissionDetail from './my/SubmissionDetail';
import ToGrade from './my/ToGrade';
import PurchaseHistory from './pay/PurchaseHistory';
import Profile from './my/Profile';
import Payment from './payment/Payment';
import Packages from './pay/Packages';
import PaymentResult from './payment/PaymentResult';
import TopToolbar from './TopToolbar'
import StudentShell from './student/StudentShell';
import {useAuthStore} from '../stores/authStore';


export default function AuthenticateView() {
    const isTeacher = useAuthStore(s => s.user?.group) === 'teacher';
    const {pathname} = useLocation();
    // Taking an exam / paying stay full-screen; every other student page sits in the app shell.
    const shell = !isTeacher && !/^\/(do-exam|payment)\//.test(pathname);

    const routes = (
            <Routes>
              <Route path='/' element={<Dashboard/>}/>
              <Route path='/do-exam/:examId' element={<DoExam/>}/>
              <Route path='/edit-exam/:examId' element={<CreateExam/>}/>
              <Route path='/create-exam' element={<CreateExam/>}/>
              <Route path='/import-exam' element={<ImportExam/>}/>
              <Route path='/create-from-bank' element={<CreateFromBank/>}/>
              <Route path='/draw-exam' element={<DrawExam/>}/>
              <Route path='/draw-exam/:subject' element={<DrawExam/>}/>
              <Route path='/draw-exam/bank/:bankId' element={<DrawExam/>}/>
              <Route path='/question-bank' element={<BankList/>}/>
              <Route path='/packages' element={<Packages/>}/>
              <Route path='/my-exams' element={<MySubmissions/>}/>
              <Route path='/my-exams/:id' element={<SubmissionDetail/>}/>
              <Route path='/to-grade' element={<ToGrade/>}/>
              <Route path='/to-grade/:examId' element={<ToGrade/>}/>
              <Route path='/billing' element={<PurchaseHistory/>}/>
              <Route path='/profile' element={<Profile/>}/>
              <Route path='/payment/result' element={<PaymentResult/>}/>
              <Route path='/payment/:packageId' element={<Payment/>}/>
              <Route path='/subject/:subjectId' element={<Dashboard/>}/>
              <Route path='*' element={<Dashboard/>}/>

                {/*<Route path='/schedule' element={<Schedule/>}/>*/}
            </Routes>
    );

    if (shell) return <StudentShell>{routes}</StudentShell>;
    return (
        <div id="AuthenticateView">
            <TopToolbar />
            {routes}
        </div>
    );
}
