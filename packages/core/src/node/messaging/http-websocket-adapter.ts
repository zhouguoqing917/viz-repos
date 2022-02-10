import * as ws from 'ws';
import { inject, injectable } from 'inversify';
import { CancellationTokenSource } from '../../common';
import { Deferred, timeout } from '../../common/promise-util';

export const HttpWebsocketAdapterFactory = Symbol('HttpWebsocketAdapterFactory');
export const HttpWebsocketAdapterTimeout = Symbol('HttpWebsocketAdapterTimeout');

export const DEFAULT_HTTP_WEBSOCKET_ADAPTER_TIMEOUT = 4000;

@injectable()
export class HttpWebsocketAdapter {

    @inject(HttpWebsocketAdapterTimeout)
    protected readonly adapterTimeout: number;

    readyState: number = ws.OPEN;
    alive: boolean = true;

    protected pendingTimeout?: CancellationTokenSource;
    protected pendingMessages: unknown[] = [];
    protected deferredMessageHandler: Deferred<unknown[]> = new Deferred();

    getPendingMessages(): Promise<unknown[]> {
        this.alive = true;
        this.deferredMessageHandler = new Deferred();
        if (!this.pendingMessages.length) {
            this.pendingTimeout = new CancellationTokenSource();
            timeout(this.adapterTimeout, this.pendingTimeout.token)
                .then(() => this.deferredMessageHandler.resolve([]))
                .catch(() => { });
        } else {
            this.deferredMessageHandler.resolve(this.pendingMessages);
            this.pendingMessages = [];
        }
        return this.deferredMessageHandler.promise;
    }

    protected _onerror: (error: Error) => void;
    protected _onclose: (code?: number, reason?: string) => void;
    protected _onmessage: (data: string) => void;

    onerror(error: Error): void {
        if (this._onerror) {
            this._onerror(error);
        }
    }

    onclose(code?: number, reason?: string): void {
        this.readyState = ws.CLOSING;
        if (this._onclose) {
            this._onclose(code, reason);
        }
        this.readyState = ws.CLOSED;
    }

    onmessage(data: string): void {
        if (this._onmessage) {
            this._onmessage(data);
        }
    }

    send(data: unknown): void {
        this.pendingMessages.push(data);
        if (this.deferredMessageHandler.state === 'unresolved') {
            this.pendingTimeout?.cancel();
            this.deferredMessageHandler.resolve(this.pendingMessages);
            this.pendingMessages = [];
        }
    }

    // Events
    on(event: 'close', listener: (this: WebSocket, code?: number, reason?: string) => void): this;
    on(event: 'error', listener: (this: WebSocket, err: Error) => void): this;
    on(event: 'message', listener: (this: WebSocket, data: ws.Data) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string | symbol, listener: (this: WebSocket, ...args: any[]) => void): this {
        if (event === 'error') {
            this.onerror = listener;
        } else if (event === 'message') {
            this.onmessage = listener;
        } else if (event === 'close') {
            this.onclose = listener;
        }
        return this;
    }
}
