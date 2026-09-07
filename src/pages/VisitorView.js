import React, {Component} from 'react';
import { Switch, Route } from 'react-router-dom'
import TopToolbar from './TopToolbar'

import DoExam from './exam-creation/DoExam';
import Dashboard from './dashboard/Dashboard';

class VisitorView extends Component {
    render() {
        return (
            <div id="VisitorView">
                <TopToolbar />
                <Switch>
                  <Route exact path='/' component={Dashboard}/>
                  <Route path='/do-exam/:examId' component={DoExam}/>
                </Switch>
            </div>
        )
    }
}

export default VisitorView;
