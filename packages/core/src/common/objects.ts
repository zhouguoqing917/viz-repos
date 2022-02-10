/**
 * object utils 
 */

export function deepClone<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof RegExp) {
        return obj;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prop = (<any>obj)[key];
        if (prop && typeof prop === 'object') {
            result[key] = deepClone(prop);
        } else {
            result[key] = prop;
        }
    });
    return result;
}

export function deepFreeze<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stack: any[] = [obj];
    while (stack.length > 0) {
        const objectToFreeze = stack.shift();
        Object.freeze(objectToFreeze);
        for (const key in objectToFreeze) {
            if (_hasOwnProperty.call(objectToFreeze, key)) {
                const prop = objectToFreeze[key];
                if (typeof prop === 'object' && !Object.isFrozen(prop)) {
                    stack.push(prop);
                }
            }
        }
    }
    return obj;
}

const _hasOwnProperty = Object.prototype.hasOwnProperty;

export function notEmpty<T>(arg: T | undefined | null): arg is T {
    // eslint-disable-next-line no-null/no-null
    return arg !== undefined && arg !== null;
}

/**
 * `true` if the argument is an empty object. Otherwise, `false`.
 */
export function isEmpty(arg: Object): boolean {
    return Object.keys(arg).length === 0 && arg.constructor === Object;
}
