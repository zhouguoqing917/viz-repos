import { inject, injectable } from 'inversify';
import { Emitter, Event } from '../common/event';
import { Deferred } from '../common/promise-util';
import { ILogger } from '../common/logger';

export type FrontendApplicationState =
    'init'
    | 'started_contributions'
    | 'attached_shell'
    | 'initialized_layout'
    | 'ready'
    | 'closing_window';

@injectable()
export class FrontendApplicationStateService {

    @inject(ILogger)
    protected readonly logger: ILogger;

    private _state: FrontendApplicationState = 'init';

    protected deferred: { [state: string]: Deferred<void> } = {};
    protected readonly stateChanged = new Emitter<FrontendApplicationState>();

    get state(): FrontendApplicationState {
        return this._state;
    }

    set state(state: FrontendApplicationState) {
        if (state !== this._state) {
            if (this.deferred[this._state] === undefined) {
                this.deferred[this._state] = new Deferred();
            }
            const oldState = this._state;
            this._state = state;
            if (this.deferred[state] === undefined) {
                this.deferred[state] = new Deferred();
            }
            this.deferred[state].resolve();
            this.logger.info(`Changed application state from '${oldState}' to '${this._state}'.`);
            this.stateChanged.fire(state);
        }
    }

    get onStateChanged(): Event<FrontendApplicationState> {
        return this.stateChanged.event;
    }

    reachedState(state: FrontendApplicationState): Promise<void> {
        if (this.deferred[state] === undefined) {
            this.deferred[state] = new Deferred();
        }
        return this.deferred[state].promise;
    }

    reachedAnyState(...states: FrontendApplicationState[]): Promise<void> {
        return Promise.race(states.map(s => this.reachedState(s)));
    }

}
