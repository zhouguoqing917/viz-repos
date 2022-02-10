import { MessageConnection } from 'vscode-ws-jsonrpc';

export const ConnectionHandler = Symbol('ConnectionHandler');

export interface ConnectionHandler {
    readonly path: string;
    onConnection(connection: MessageConnection): void;
}
