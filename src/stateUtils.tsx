// ponytail: @ts-nocheck CO CHU DICH. File nay se bi XOA o lat zustand —
// connectGlobalState lam `class X extends <bien>` nen khong the go kieu tu te,
// va no dua vao componentWillMount ma React 18 da bo. Go kieu cho code sap xoa
// la lang phi; chi can kieu o BIEN GIOI (chu ky connectGlobalState ben duoi) de
// 17 file goi no van duoc kiem kieu.
// @ts-nocheck
import React from "react";

let printCallStack = () => {
    let stack = new Error().stack;
    console.log('DEBUG:', stack);
};

let uuid = () => {
    let s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};

let _propagateGlobalState = async function(newState, currentContext, listenners, globalState) {
    let updatedAttrs = Object.keys(newState);

    // If value is Promise then we have to wait for having value
    let _update = new Promise(resolve => {
        updatedAttrs.forEach(async (attr) => {
            let newVal = newState[attr];
            if (typeof (newVal) === 'object' && 'then' in newVal) {
                newVal = await newVal;
            }

            currentContext.globalState[attr] = newVal;
            resolve();
        });
    });

    // Wait for all value updated
    await _update;

    // Update only component which listens to updated attr
    listenners.forEach(listennerContext => {
        let shouldUpdate = false;

        updatedAttrs.forEach(attr => {
            if (listennerContext._global.has(attr)) {
                shouldUpdate = true;
            }
        });

        listennerContext._isMounted && shouldUpdate && listennerContext.forceUpdate();
    });
};


// connectGlobalState ======================================================================= //
let _components = [];
let _globalState = {};

/**
 * Set globalState using function setGlobalState
 * @param WrappedComponent
 * @param debug: print out call stack when setGlobalState is called
 *
 * In wrapped component: just use this.globalState.varName
 * by get value from globalState, we add watcher automatically to component
 * and component will re-render only when this varName is changed from globalState
 *
 * For changing global state: use this.setGlobalState, everything just work like this.setState
 */
export function connectGlobalState<P extends object>(
    WrappedComponent: React.ComponentClass<P>
): React.ComponentClass<P> {
    return class ConnectedGlobalState extends (WrappedComponent as any) {
        // Do not use array function, use 'function' instead for having 'this' pointing to WrappedComponent
        setGlobalState(newState, debug=false) {
            debug && printCallStack();
            _propagateGlobalState(newState, this, _components, _globalState);
        };

        componentWillMount() {
            let component = this;
            component._uid = WrappedComponent.name + '_' + uuid();

            component._global = new Set();

            component.globalState = new Proxy({}, {
                get: (target, name) => {
                    if (name === '_all') {
                        return _globalState;
                    }

                    component._global.add(name);
                    return _globalState[name];
                },
                set: (target, name, value) => {
                    component._global.add(name);
                    _globalState[name] = value;
                    return true;
                }
            });
            _components.push(component);

            // Call parent lifecycle
            if (super.componentWillMount) {
                super.componentWillMount();
            }

            component._isMounted = true;
        };

        componentWillUnmount() {
            let component = this;
            _components = _components.filter(c => c._uid !== component._uid);

            // Call parent lifecycle
            if (super.componentWillUnmount) {
                super.componentWillUnmount();
            }

            component._isMounted = false;
        }

        render = super.render;
    } as unknown as React.ComponentClass<P>;
}
