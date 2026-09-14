import React from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

// ponytail: react-router v6 bỏ withRouter và chỉ còn hook, nhưng 6 class component
// đang đọc this.props.match/history/location. Dựng lại đúng 3 props đó (12 dòng)
// rẻ hơn nhiều so với chuyển 6 class sang function component.
export default function withRouter(Component) {
    return function Wrapper(props) {
        const navigate = useNavigate();
        return <Component
            {...props}
            match={{params: useParams()}}
            location={useLocation()}
            history={{push: navigate, replace: to => navigate(to, {replace: true})}}
        />
    }
}
