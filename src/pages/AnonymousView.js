import React, {Component} from 'react';
import { Switch, Route } from 'react-router-dom'

import Register from './auth/Register';
import Login from './auth/Login';

class AnonymousView extends Component {
    render() {
        return (
            <div id="AnonymousView">
                {/*<TopMenu />*/}
                <Switch>
                  <Route exact path='/' component={Login}/>
                  <Route path='/register' component={Register}/>
                  <Route component={Login} />
                </Switch>
            </div>
        )
    }
}

export default AnonymousView;
