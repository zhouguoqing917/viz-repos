import { SelectionService } from "../common/selection-service";
import { UriSelection } from '../common/selection';
import { CommandHandler } from './command';
import { MaybeArray } from '.';
import URI from './uri';

export interface UriCommandHandler<T extends MaybeArray<URI>> {

    // tslint:disable-next-line:no-any
    execute(uri: T, ...args: any[]): any;

    // tslint:disable-next-line:no-any
    isEnabled?(uri: T, ...args: any[]): boolean;

    // tslint:disable-next-line:no-any
    isVisible?(uri: T, ...args: any[]): boolean;

}

/**
 * Handler for a single URI-based selection.
 */
export interface SingleUriCommandHandler extends UriCommandHandler<URI> {

}

/**
 * Handler for multiple URIs.
 */
export interface MultiUriCommandHandler extends UriCommandHandler<URI[]> {

}

export namespace UriAwareCommandHandler {

    /**
     * Further options for the URI aware command handler instantiation.
     */
    export interface Options {

        /**
         * `true` if the handler supports multiple selection. Otherwise, `false`. Defaults to `false`.
         */
        readonly multi?: boolean,

    }

}
export class UriAwareCommandHandler<T extends MaybeArray<URI>> implements CommandHandler {

    constructor(
        protected readonly selectionService: SelectionService,
        protected readonly handler: UriCommandHandler<T>,
        protected readonly options?: UriAwareCommandHandler.Options
    ) { }

    // tslint:disable-next-line:no-any
    protected getUri(...args: any[]): T | undefined {
        if (args && args[0] instanceof URI) {
            return (this.isMulti() ? [args[0]] : args[0]) as T;
        }
        const { selection } = this.selectionService;
        if (!this.isMulti()) {
            return UriSelection.getUri(selection) as T;
        }
        const uris = UriSelection.getUris(selection);
        return uris as T;
    }

    // tslint:disable-next-line:no-any
    execute(...args: any[]): object | undefined {
        const uri = this.getUri(...args);
        return uri ? this.handler.execute(uri, ...args) : undefined;
    }

    // tslint:disable-next-line:no-any
    isVisible(...args: any[]): boolean {
        const uri = this.getUri(...args);
        if (uri) {
            if (this.handler.isVisible) {
                return this.handler.isVisible(uri as T, ...args);
            }
            return true;
        }
        return false;
    }

    // tslint:disable-next-line:no-any
    isEnabled(...args: any[]): boolean {
        const uri = this.getUri(...args);
        if (uri) {
            if (this.handler.isEnabled) {
                return this.handler.isEnabled(uri as T, ...args);
            }
            return true;
        }
        return false;
    }

    protected isMulti() {
        return this.options && !!this.options.multi;
    }

}
