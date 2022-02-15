// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dynamicRequire<T = any>(id: string): T {
    if (typeof id !== 'string') {
        throw new TypeError('module id must be a string');
    }
    if (id.startsWith('.')) {
        throw new Error(`module id cannot be a relative path, id: "${id}"`);
    } 
    return require(/* webpackIgnore: true */ id);
}
