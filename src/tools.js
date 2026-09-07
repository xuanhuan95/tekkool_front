export var uuid = () => {
    let s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};

export var setNestedValue = (obj, nested, value) => {
    /**
     *
     * @type {*|string[]}
     *
     * Set nested value for object
     *
     * setNestedValue({a: {b: 1}}, 'a.b', 2)
     * => {a: {b: 2}
     *
     * setNestedValue({a: {b: [1, 2]}}, 'a.b[0]', 2)
     * => {{a: {b: [2, 2]}}
     *
     * setNestedValue({a: {b: [{c: 1}]}}, 'a.b[0].c', 2)
     * => {a: {b: [{c: 2}]}
     *
     * setNestedValue({a: [{id: 1, b: 1}, {id: 2, b: 2}]}, 'a[id=1].b', 5)
     * => { a: [ { id: 1, b: 5 }, { id: 2, b: 2 } ] }
     *
    */

    let splitted = nested.split('.');

    let _name, _nested;
    if (splitted.length > 1) {
        _name = splitted.splice(0, 1)[0];
        _nested = splitted.join('.');

        // Is nested name is for array
        let matched = _name.match(/^(\w+)\[(.+)\]$/);
        let _obj;

        if (matched) {
            let attr = matched[1];
            let idx = matched[2];

            // If index is searched by key: value
            if (idx.includes('=')) {
                let [k, v] = idx.split('=');

                obj[attr].forEach((item, _idx) => {
                    if (String(item[k]) === String(v)) {
                        idx = _idx
                    }
                })
            }

            _obj = obj[attr][idx];

        } else {
            _obj = obj[_name];
        }

        setNestedValue(_obj, _nested, value)


    } else {
        let matched = nested.match(/^(\w+)\[(.+)\]$/);

        // Is nested is array
        if (matched) {
            let attr = matched[1];
            let idx = matched[2];

            // If index is searched by key: value
            if (idx.includes('=')) {
                let [k, v] = idx.split('=');

                obj[attr] = obj[attr].map(item => {
                    if (String(item[k]) === String(v)) {
                        item = value
                    }
                    return item;
                })

            // If index is integer
            } else {
                obj[attr][idx] = value;
            }

        } else {
            obj[nested] = value;
        }


    }

    return obj;
};
