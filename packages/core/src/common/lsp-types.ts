import { Range } from 'vscode-languageserver-protocol';
export interface TextDocumentContentChangeDelta {
    readonly range: Range;
    readonly rangeLength?: number;
    readonly text: string;
}
export namespace TextDocumentContentChangeDelta {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(arg: any): arg is TextDocumentContentChangeDelta {
        return !!arg && typeof arg['text'] === 'string' && (typeof arg['rangeLength'] === 'number' || typeof arg['rangeLength'] === 'undefined')
            && Range.is(arg['range']);
    }

}
