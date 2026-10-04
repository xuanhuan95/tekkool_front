export function uuid(): string {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

/** Object bất kỳ — setNestedValue đi xuyên qua cây nên không biết trước hình dạng. */
type AnyObject = Record<string, any>;

/**
 * Gán giá trị vào đường dẫn lồng nhau, SỬA TẠI CHỖ rồi trả về chính `obj`.
 *
 *   setNestedValue({a: {b: 1}}, 'a.b', 2)                     -> {a: {b: 2}}
 *   setNestedValue({a: {b: [1, 2]}}, 'a.b[0]', 2)             -> {a: {b: [2, 2]}}
 *   setNestedValue({a: [{id: 1, b: 1}]}, 'a[id=1].b', 5)      -> {a: [{id: 1, b: 5}]}
 *
 * Dạng `a[id=X]` so sánh bằng String() nên id số khớp với 'X' dạng chuỗi.
 */
export function setNestedValue<T extends AnyObject>(obj: T, nested: string, value: unknown): T {
    const splitted = nested.split('.');

    if (splitted.length > 1) {
        const _name = splitted.splice(0, 1)[0];
        const _nested = splitted.join('.');

        const matched = _name.match(/^(\w+)\[(.+)\]$/);
        let _obj: AnyObject;

        if (matched) {
            const attr = matched[1];
            let idx: string | number = matched[2];

            if (idx.includes('=')) {
                const [k, v] = idx.split('=');
                obj[attr].forEach((item: AnyObject, _idx: number) => {
                    if (String(item[k]) === String(v)) idx = _idx;
                });
            }

            _obj = obj[attr][idx];
        } else {
            _obj = obj[_name];
        }

        setNestedValue(_obj, _nested, value);
    } else {
        const matched = nested.match(/^(\w+)\[(.+)\]$/);

        if (matched) {
            const attr = matched[1];
            const idx = matched[2];

            if (idx.includes('=')) {
                const [k, v] = idx.split('=');
                (obj as AnyObject)[attr] = obj[attr].map((item: AnyObject) =>
                    String(item[k]) === String(v) ? value : item);
            } else {
                obj[attr][idx] = value;
            }
        } else {
            (obj as AnyObject)[nested] = value;
        }
    }

    return obj;
}
