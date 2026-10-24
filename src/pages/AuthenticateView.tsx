import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'

import Dashboard from './dashboard/Dashboard';
import CreateExam from './exam-creation/CreateExam';
import TakeExam from './exam/TakeExam';
import ResultPage from './exam/ResultPage';
import ReviewPage from './exam/ReviewPage';
import HistoryPage from './exam/HistoryPage';
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
import ExamsPage from './hs/ExamsPage';
import ExamDetailPage from './hs/ExamDetailPage';
import RankingPage from './hs/RankingPage';
import AccountPage from './hs/AccountPage';
import Loading from '../components/Loading';
import {TeacherLayout} from '../components/ui';
import {usePendingCount} from '../queries/submissions';

// Admin area /manage/* (SPT-27/23/47): own layout, own chunk.
const ManageApp = lazy(() => import('./manage/ManageApp'));


/** Old student links /my-exams/:id → the design-D result screen. */
function ToResult() {
    const {id} = useParams();
    return <Navigate to={'/result/' + id} replace/>;
}

const TEACHER_D = /^\/(|(subject|create-exam|edit-exam|to-grade|my-exams|question-bank|import-exam|create-from-bank|draw-exam)(\/.*)?)$/;

function TeacherShell({children}: {children: ReactNode}) {
    const name = useAuthStore(s => s.user?.name);
    const {data: pending} = usePendingCount();
    return <TeacherLayout name={name} pending={pending}>{children}</TeacherLayout>;
}

export default function AuthenticateView() {
    const group = useAuthStore(s => s.user?.group);
    const isTeacher = group === 'teacher';
    const {pathname} = useLocation();

    // Admin only uses /manage/*; ManageApp redirects any other path there and shows 403 to non-admins.
    if (group === 'admin' || pathname.startsWith('/manage')) {
        return <Suspense fallback={<Loading/>}><ManageApp/></Suspense>;
    }
    // Taking an exam / paying are full-screen with their OWN design-D header (ExamHeader, pay bar):
    // no student shell and NOT the old TopToolbar either (QC B2).
    const fullScreen = /^\/(do-exam|payment)\//.test(pathname);
    const shell = !isTeacher && !fullScreen;

    const routes = (
            <Routes>
              <Route path='/' element={<Dashboard/>}/>
              <Route path='/do-exam/:examId' element={<TakeExam/>}/>
              {/* SPT-55/42/25: student home lives at '/', these are the other HS screens. */}
              <Route path='/exams' element={<ExamsPage/>}/>
              <Route path='/exams/:examId' element={<ExamDetailPage/>}/>
              <Route path='/ranking' element={<RankingPage/>}/>
              <Route path='/me' element={<AccountPage/>}/>
              {/* SPT-16/17: result, review, history */}
              <Route path='/result/:id' element={<ResultPage/>}/>
              <Route path='/review/:id' element={<ReviewPage/>}/>
              <Route path='/history' element={<HistoryPage/>}/>
              <Route path='/edit-exam/:examId' element={<CreateExam/>}/>
              <Route path='/create-exam' element={<CreateExam/>}/>
              <Route path='/import-exam' element={<ImportExam/>}/>
              <Route path='/create-from-bank' element={<CreateFromBank/>}/>
              <Route path='/draw-exam' element={<DrawExam/>}/>
              <Route path='/draw-exam/:subject' element={<DrawExam/>}/>
              <Route path='/draw-exam/bank/:bankId' element={<DrawExam/>}/>
              <Route path='/question-bank' element={<BankList/>}/>
              <Route path='/packages' element={<Packages/>}/>
              {/* Students: the old list moved to /history (HS-LichSu); teachers keep the old screen. */}
              <Route path='/my-exams' element={isTeacher ? <MySubmissions/> : <Navigate to='/history' replace/>}/>
              <Route path='/my-exams/:id' element={isTeacher ? <SubmissionDetail/> : <ToResult/>}/>
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
    if (fullScreen) return routes;
    // SPT-57: reskinned teacher screens get the design-D teacher shell; the rest keep TopToolbar for now.
    if (isTeacher && TEACHER_D.test(pathname)) return <TeacherShell>{routes}</TeacherShell>;
    return (
        <div id="AuthenticateView">
            <TopToolbar />
            {routes}
        </div>
    );
}
