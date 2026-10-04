import React, {Component, Fragment} from 'react';
import Loading from '../components/Loading';

import {connectGlobalState} from "../stateUtils";

import AuthenticateView from './AuthenticateView';
import AnonymousView from './AnonymousView';
import VisitorView from './VisitorView';
import Api, {setToken} from "../services/api";
import { Toaster } from 'react-hot-toast';
import 'semantic-ui-css/semantic.min.css';
import './fonts.css';
import './App.css';
import './questions.css';
import './student.css';

class Home extends Component {
    state = {isReady: false, auth: {token: '', user: {}}};

    async componentWillMount() {
        let token = window.localStorage.getItem('sessionToken') ? window.localStorage.getItem('sessionToken') : '';

        let auth = await Api.get('session/init?token=' + token);

        setToken(auth.id);

        this.setGlobalState({auth});
        this.setState({isReady: true});
    }

    render() {
        let {isReady} = this.state;
        if (!isReady) {
            return <Loading/>
        }

        let {auth} = this.globalState;
        let {user} = auth;

        return <div id='App'>
            <Toaster position='top-right'/>
            {user ?
                <Fragment>
                    {user.group==='visitor' ?
                        <VisitorView/>
                    :
                        <AuthenticateView />
                    }
                </Fragment>
            :
                <AnonymousView />}
        </div>
    }
}

export default connectGlobalState(Home);
