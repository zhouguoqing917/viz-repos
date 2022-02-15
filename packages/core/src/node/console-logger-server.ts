
import { inject, injectable, postConstruct } from 'inversify';
import { LoggerWatcher } from '../common/logger-watcher';
import { LogLevelCliContribution } from './logger-cli-contribution';
import { ConsoleLogger, ILoggerClient, ILoggerServer } from '../common/logger-protocol';

@injectable()
export class ConsoleLoggerServer implements ILoggerServer {

    protected client: ILoggerClient | undefined = undefined;

    @inject(LoggerWatcher)
    protected watcher: LoggerWatcher;

    @inject(LogLevelCliContribution)
    protected cli: LogLevelCliContribution;

    @postConstruct()
    protected init(): void {
        for (const name of Object.keys(this.cli.logLevels)) {
            this.setLogLevel(name, this.cli.logLevels[name]);
        }
    }

    async setLogLevel(name: string, newLogLevel: number): Promise<void> {
        const event = {
            loggerName: name,
            newLogLevel
        };
        if (this.client !== undefined) {
            this.client.onLogLevelChanged(event);
        }
        this.watcher.fireLogLevelChanged(event);
    }

    async getLogLevel(name: string): Promise<number> {
        return this.cli.logLevelFor(name);
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    async log(name: string, logLevel: number, message: string, params: any[]): Promise<void> {
        const configuredLogLevel = await this.getLogLevel(name);
        if (logLevel >= configuredLogLevel) {
            ConsoleLogger.log(name, logLevel, message, params);
        }
    }

    async child(name: string): Promise<void> {
        this.setLogLevel(name, this.cli.logLevelFor(name));
    }

    dispose(): void { }

    setClient(client: ILoggerClient | undefined): void {
        this.client = client;
    }

}
