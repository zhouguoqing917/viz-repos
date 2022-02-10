/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import 'reflect-metadata';
import { inject, injectable, named } from 'inversify';
import { CommandRegistry, ContributionProvider, KeybindingRegistry, MaybePromise, MenuModelRegistry } from '../common';
import { ApplicationShell } from './shell';
import { Widget } from "./widgets";

/**
 * Clients can implement to get a callback for contributing widgets to a shell on start.
 */
export const FrontendApplicationContribution = Symbol("FrontendApplicationContribution");
export interface FrontendApplicationContribution {
    /**
    * Called on application startup before configure is called.
    */
    initialize?(): void;

    /**
    * Called before commands, key bindings and menus are initialized.
    * Should return a promise if it runs asynchronously.
    */
    configure?(app: FrontendApplication): MaybePromise<void>;
    /**
        * Called when the application is started. The application shell is not attached yet when this method runs.
        * Should return a promise if it runs asynchronously.
        */
    onStart?(app: FrontendApplication): MaybePromise<void>;

    /**
    * Called on `beforeunload` event, right before the window closes.
    * Return `true` or an OnWillStopAction in order to prevent exit.
    * Note: No async code allowed, this function has to run on one tick.
    */
    onWillStop?(app: FrontendApplication): boolean | undefined | OnWillStopAction;


    /**
     * Called when an application is stopped or unloaded.
     *
     * Note that this is implemented using `window.beforeunload` which doesn't allow any asynchronous code anymore.
     * I.e. this is the last tick.
     */
    onStop?(app: FrontendApplication): void;


    /**
    * Called after the application shell has been attached in case there is no previous workbench layout state.
    * Should return a promise if it runs asynchronously.
    */
    initializeLayout?(app: FrontendApplication): MaybePromise<void>;

    /**
  * An event is emitted when a layout is initialized, but before the shell is attached.
  */
    onDidInitializeLayout?(app: FrontendApplication): MaybePromise<void>;

}

export interface OnWillStopAction {
    /**
     * @resolves to `true` if it is safe to close the application; `false` otherwise.
     */
    action: () => MaybePromise<boolean>;
    /**
     * A descriptive string for the reason preventing close.
     */
    reason: string;
    /**
     * A number representing priority. Higher priority items are run later.
     * High priority implies that some options of this check will have negative impacts if
     * the user subsequently cancels the shutdown.
     */
    priority?: number;
}

export namespace OnWillStopAction {
    export function is(candidate: unknown): candidate is OnWillStopAction {
        return typeof candidate === 'object' && !!candidate && 'action' in candidate && 'reason' in candidate;
    }
}

const TIMER_WARNING_THRESHOLD = 100;

@injectable()
export abstract class DefaultFrontendApplicationContribution implements FrontendApplicationContribution {

    initialize(): void {
        // NOOP
    }

}
/**
 * Default frontend contribution that can be extended by clients if they do not want to implement any of the
 * methods from the interface but still want to contribute to the frontend application.
 */
@injectable()
export class FrontendApplication {

    protected _shell: ApplicationShell | undefined;

    constructor(
        @inject(CommandRegistry) protected readonly commands: CommandRegistry,
        @inject(MenuModelRegistry) protected readonly menus: MenuModelRegistry,
        @inject(KeybindingRegistry) protected readonly keybindings: KeybindingRegistry,
        @inject(ContributionProvider) @named(FrontendApplicationContribution)
        protected readonly contributions: ContributionProvider<FrontendApplicationContribution>
    ) { }

    get shell(): ApplicationShell {
        if (this._shell) {
            return this._shell;
        }
        throw new Error('The application has not been started yet.');
    }

    /**
     * Start the frontend application.
     *
     * Start up consists of the following steps:
     * - create the application shell
     * - start frontend contributions
     * - display the application shell
     */
    async start(): Promise<void> {

        if (this._shell) {
            throw new Error('The application is already running.');
        }
        this._shell = this.createShell();
        this.startContributions();
        this.attachShell();
    }

    protected createShell(): ApplicationShell {
        return new ApplicationShell();
    }

    protected attachShell(): void {
        Widget.attach(this.shell, this.host);
        const listener = () => this.shell.update();
        window.addEventListener('resize', listener);
    }

    protected get host(): HTMLElement {
        return this.getHost();
    }

    /**
    * Return a promise to the host element to which the application shell is attached.
    */
    protected getHost(): HTMLElement {
        return document.body;
    } 

    protected async startContributions(): Promise<void> {
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.initialize) {
                try {
                    await this.measure(contribution.constructor.name + '.initialize',
                        () => contribution.initialize!()
                    );
                } catch (error) {
                    console.error('Could not initialize contribution', error);
                }
            }
        }
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.configure) {
                try {
                    await this.measure(contribution.constructor.name + '.configure',
                        () => contribution.configure!(this)
                    );
                } catch (error) {
                    console.error('Could not configure contribution', error);
                }
            }
        }

        /**
         * FIXME:
         * - decouple commands & menus
         * - consider treat commands, keybindings and menus as frontend application contributions
         */

        await this.measure('commands.onStart',
            () => this.commands.onStart()
        );
        await this.measure('keybindings.onStart',
            () => this.keybindings.onStart()
        );
        await this.measure('menus.onStart',
            () => this.menus.onStart()
        );
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onStart) {
                try {
                    await this.measure(contribution.constructor.name + '.onStart',
                        () => contribution.onStart!(this)
                    );
                } catch (error) {
                    console.error('Could not start contribution', error);
                }
            }
        }
    }

    /**
 * Stop the frontend application contributions. This is called when the window is unloaded.
 */
    protected stopContributions(): void {
        console.info('>>> Stopping frontend contributions...');
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onStop) {
                try {
                    contribution.onStop(this);
                } catch (error) {
                    console.error('Could not stop contribution', error);
                }
            }
        }
        console.info('<<< All frontend contributions have been stopped.');
    }

    protected async measure<T>(name: string, fn: () => MaybePromise<T>): Promise<T> {
        const startMark = name + '-start';
        const endMark = name + '-end';
        performance.mark(startMark);
        const result = await fn();
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        for (const item of performance.getEntriesByName(name)) {
            const contribution = `Frontend ${item.name}`;
            if (item.duration > TIMER_WARNING_THRESHOLD) {
                console.warn(`${contribution} is slow, took: ${item.duration.toFixed(1)} ms`);
            } else {
                console.debug(`${contribution} took: ${item.duration.toFixed(1)} ms`);
            }
        }

        return result;
    }

}
