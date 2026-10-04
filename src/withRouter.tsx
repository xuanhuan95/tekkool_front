import React from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

/** 3 prop mà class component cũ đọc từ react-router v5. */
export type RouterProps = {
    match: {params: Record<string, string | undefined>};
    location: ReturnType<typeof useLocation>;
    history: {push: (to: string) => void; replace: (to: string) => void};
};

// ponytail: react-router v6 bỏ withRouter và chỉ còn hook, nhưng 6 class component
// đang đọc this.props.match/history/location. Dựng lại đúng 3 props đó (12 dòng)
// rẻ hơn nhiều so với chuyển 6 class sang function component.
export default function withRouter<P extends RouterProps>(
    Component: React.ComponentType<P>
) {
    return function Wrapper(props: Omit<P, keyof RouterProps>) {
        const navigate = useNavigate();
        return <Component
            {...(props as P)}
            match={{params: useParams()}}
            location={useLocation()}
            history={{push: navigate, replace: (to: string) => navigate(to, {replace: true})}}
        />
    }
}
