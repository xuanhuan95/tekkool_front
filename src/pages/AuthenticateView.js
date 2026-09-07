import React, {Component} from 'react';
import { Switch, Route } from 'react-router-dom'

import Dashboard from './dashboard/Dashboard';
import CreateExam from './exam-creation/CreateExam';
import DoExam from './exam-creation/DoExam';
import TopToolbar from './TopToolbar'


class AuthenticateView extends Component {
    render() {
        return (
            <div id="AuthenticateView">
                <TopToolbar />

                {/*<TopMenu />*/}
                <Switch>
                  <Route exact path='/' component={Dashboard}/>
                  <Route path='/do-exam/:examId' component={DoExam}/>
                  <Route path='/edit-exam/:examId' component={CreateExam}/>
                  <Route path='/create-exam' component={CreateExam}/>
                  <Route component={Dashboard} />

                    {/*<Route path='/schedule' component={Schedule}/>*/}
                </Switch>
            </div>
        )
    }
}

export default AuthenticateView;
