import React, {Component, Fragment} from 'react';
import {Loader} from 'semantic-ui-react';

import {connectGlobalState} from "../stateUtils";

import AuthenticateView from './AuthenticateView';
import AnonymousView from './AnonymousView';
import VisitorView from './VisitorView';
import Api from "../services/api";
import { Toaster } from 'react-hot-toast';
import 'semantic-ui-css/semantic.min.css';
import './App.css';
import './questions.css';

class Home extends Component {
    state = {isReady: false, auth: {token: '', user: {}}};

    async componentWillMount() {
        let token = window.localStorage.getItem('sessionToken') ? window.localStorage.getItem('sessionToken') : '';

        let auth = await Api.get('session/init?token=' + token);

        window.localStorage.setItem('sessionToken', auth.id);
        window.token = auth.id;

        this.setGlobalState({auth});
        this.setState({isReady: true});
    }

    render() {
        let {isReady} = this.state;
        if (!isReady) {
            return <Loader active/>
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
