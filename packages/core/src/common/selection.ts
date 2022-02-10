import URI from './uri';

export interface UriSelection {
    readonly uri: URI
}

export namespace UriSelection {

    export function is(arg: Object | undefined): arg is UriSelection {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return typeof arg === 'object' && ('uri' in arg) && (<any>arg)['uri'] instanceof URI;
    }

    export function getUri(selection: Object | undefined): URI | undefined {
        if (is(selection)) {
            return selection.uri;
        }
        if (Array.isArray(selection) && is(selection[0])) {
            return selection[0].uri;
        }
        return undefined;
    }

    export function getUris(selection: Object | undefined): URI[] {
        if (is(selection)) {
            return [selection.uri];
        }
        if (Array.isArray(selection)) {
            return selection.filter(is).map(s => s.uri);
        }
        return [];
    }

}
