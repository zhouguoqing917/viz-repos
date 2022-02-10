import { injectable } from 'inversify';
import { Emitter, Event } from './event';
import { ILoggerClient, ILogLevelChangedEvent } from './logger-protocol';

@injectable()
export class LoggerWatcher {

    getLoggerClient(): ILoggerClient {
        const emitter = this.onLogLevelChangedEmitter;
        return {
            onLogLevelChanged(event: ILogLevelChangedEvent): void {
                emitter.fire(event);
            }
        };
    }

    private onLogLevelChangedEmitter = new Emitter<ILogLevelChangedEvent>();

    get onLogLevelChanged(): Event<ILogLevelChangedEvent> {
        return this.onLogLevelChangedEmitter.event;
    }

    // FIXME: get rid of it, backend services should as well set a client on the server
    fireLogLevelChanged(event: ILogLevelChangedEvent): void {
        this.onLogLevelChangedEmitter.fire(event);
    }
}
