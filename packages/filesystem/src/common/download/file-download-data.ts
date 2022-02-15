export interface FileDownloadData {
    readonly uris: string[];
}

export namespace FileDownloadData {
    export function is(arg: Object | undefined): arg is FileDownloadData {
        return !!arg && 'uris' in arg;
    }
}
