import React from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

/** The 3 props old class components read from react-router v5. */
export type RouterProps = {
    match: {params: Record<string, string | undefined>};
    location: ReturnType<typeof useLocation>;
    history: {push: (to: string) => void; replace: (to: string) => void};
};

// ponytail: react-router v6 dropped withRouter and only has hooks, but 6 class components
// still read this.props.match/history/location. Rebuilding exactly those 3 props (12 lines)
// is far cheaper than converting 6 classes to function components.
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
