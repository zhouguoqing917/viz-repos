
import { injectable } from 'inversify';
import { Emitter } from '../common/event';

export interface ContextKey<T> {
    set(value: T | undefined): void;
    reset(): void;
    get(): T | undefined;
}

export namespace ContextKey {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const None: ContextKey<any> = Object.freeze({
        set: () => { },
        reset: () => { },
        get: () => undefined
    });
}

export interface ContextKeyChangeEvent {
    affects(keys: Set<string>): boolean;
}

@injectable()
export class ContextKeyService {

    protected readonly onDidChangeEmitter = new Emitter<ContextKeyChangeEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;
    protected fireDidChange(event: ContextKeyChangeEvent): void {
        this.onDidChangeEmitter.fire(event);
    }

    createKey<T>(key: string, defaultValue: T | undefined): ContextKey<T> {
        return ContextKey.None;
    }
    /**
     * It should be implemented by an extension, e.g. by the monaco extension.
     */
    match(expression: string, context?: HTMLElement): boolean {
        return true;
    }

    /**
     * It should be implemented by an extension, e.g. by the monaco extension.
     */
    parseKeys(expression: string): Set<string> {
        return new Set<string>();
    }

}
